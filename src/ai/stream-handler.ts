/**
 * Stream handler with buffered updates, watchdog, and typed node boundary detection
 * (GENP-03, GENP-04, GENP-11, D-01, D-03).
 *
 * Streams Claude responses with:
 * - Buffered text flushing at BUFFER_INTERVAL_MS intervals
 * - Tag-aware accumulation that strips <node type="...">/<\/node> from visible text
 * - Typed node tag parsing: extracts type and optional lang attributes (D-01)
 * - Mid-stream </node> boundary detection with onNodeBoundary callback + TypedNodeMeta
 * - Timeout watchdog that fires after 30s of silence
 * - AbortSignal support for cancellation
 */

import type Anthropic from '@anthropic-ai/sdk';
import { BUFFER_INTERVAL_MS } from '../types/settings';
import type { SystemPromptBlock } from './prompt-builder';
import type { TypedNodeMeta } from '../types/generation';

export type { TypedNodeMeta } from '../types/generation';

const WATCHDOG_TIMEOUT_MS = 30_000; // 30 seconds (GENP-11)

/**
 * Maximum output tokens per Claude response.
 *
 * Opus 4.6 standard supports up to 32,768 output tokens. 16,384 gives
 * roughly a 60k-character budget for generated content — enough headroom
 * for realistic multi-medium responses including substantial code output.
 *
 * Phase 5 gap closure: the prior 4,096 cap truncated a tachometer-dashboard
 * code response at ~10,079 characters (~3,500-4,000 tokens), leaving the
 * code node unclosed and suppressing companion-node creation. See also
 * main.ts streamWithRetry completion fallback for belt-and-braces handling
 * of incomplete streams.
 */
export const MAX_OUTPUT_TOKENS = 16384;

/**
 * Regex for matching typed node opening tags (D-01).
 * Matches: <node type="text">, <node type="code" lang="typescript">, etc.
 */
const TYPED_NODE_OPEN_RE = /<node\s+type="(text|code|mermaid|image)"(?:\s+lang="([^"]*)")?\s*>/;

/**
 * Regex for matching any node opening tag (typed or untyped).
 * Used for finding opening tags in accumulated text.
 */
const ANY_NODE_OPEN_RE = /<node(?:\s+type="(text|code|mermaid|image)"(?:\s+lang="([^"]*)")?)?\s*>/g;

export interface StreamResult {
  text: string;
  usage: { input_tokens: number; output_tokens: number };
  nodeContents: string[]; // Parsed from <node> delimiters
}

export interface StreamCallbacks {
  onFirstToken: () => void;              // Remove pulsing, set status to streaming
  onTextUpdate: (text: string, meta: TypedNodeMeta) => void;  // Buffered text flush with node type metadata
  onTimeout: () => void;                 // Watchdog fired (GENP-11)
  /**
   * Called when a </node> closing tag is detected mid-stream (D-03).
   * Provides the completed node's content (tags stripped), its
   * zero-based index, and its TypedNodeMeta. The caller should use
   * this to finalize the current canvas node and pre-allocate the
   * next one. After this callback returns, subsequent onTextUpdate
   * calls will contain the NEW node's content with its own meta.
   */
  onNodeBoundary: (completedNodeContent: string, nodeIndex: number, meta: TypedNodeMeta) => void;
}

/**
 * Parse streamed response into individual node contents (D-02).
 * Splits on <node type="...">...</node> delimiters.
 * Falls back to untyped <node>...</node> for backward compatibility.
 * If no delimiters found, treats entire text as a single node.
 */
export function parseNodeContent(responseText: string): string[] {
  // Try typed tags first
  const typedRegex = /<node\s+type="(?:text|code|mermaid|image)"(?:\s+lang="[^"]*")?\s*>([\s\S]*?)<\/node>/g;
  const matches: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = typedRegex.exec(responseText)) !== null) {
    matches.push(match[1].trim());
  }

  if (matches.length > 0) return matches;

  // Fall back to untyped tags for backward compatibility
  const untypedRegex = /<node>([\s\S]*?)<\/node>/g;
  while ((match = untypedRegex.exec(responseText)) !== null) {
    matches.push(match[1].trim());
  }

  if (matches.length > 0) return matches;

  return [responseText.trim()];
}

// Possible partial closing tag prefixes to hold back from visible text
const PARTIAL_CLOSE_TAGS = ['</', '</n', '</no', '</nod', '</node'];

/**
 * Check if text ends with a partial tag that should be held back.
 * Returns the length of the partial tag suffix, or 0 if none.
 *
 * Handles both untyped <node> and typed <node type="..." lang="..."> patterns.
 * For typed tags, detects partial patterns like '<node t', '<node type="co', etc.
 */
function partialTagSuffixLength(text: string): number {
  // Check close tags first (higher priority)
  for (let i = PARTIAL_CLOSE_TAGS.length - 1; i >= 0; i--) {
    const partial = PARTIAL_CLOSE_TAGS[i];
    if (text.endsWith(partial)) return partial.length;
  }

  // Check for partial/complete-but-unclosed opening tag: <node...> not yet closed with >
  // Find last '<' and check if it starts a node tag without closing '>'
  const lastAngle = text.lastIndexOf('<');
  if (lastAngle >= 0) {
    const tail = text.substring(lastAngle);
    // If tail starts with '<node' and has no '>', hold it back (typed tag being built)
    if (tail.startsWith('<node') && !tail.includes('>')) {
      return tail.length;
    }
    // Also check shorter partial prefixes: '<', '<n', '<no', '<nod'
    if (['<', '<n', '<no', '<nod'].some(p => tail === p)) {
      return tail.length;
    }
  }

  return 0;
}

/**
 * Find all node opening tags in text and return their positions and metadata.
 * Returns array of { index, length, meta } for each opening tag found.
 */
function findNodeOpenings(rawText: string): Array<{ index: number; length: number; meta: TypedNodeMeta }> {
  const results: Array<{ index: number; length: number; meta: TypedNodeMeta }> = [];
  const regex = new RegExp(ANY_NODE_OPEN_RE.source, 'g');
  let match: RegExpExecArray | null;

  while ((match = regex.exec(rawText)) !== null) {
    const type = (match[1] || 'text') as TypedNodeMeta['type'];
    const lang = match[2] || undefined;
    const meta: TypedNodeMeta = lang ? { type, lang } : { type };
    results.push({
      index: match.index,
      length: match[0].length,
      meta,
    });
  }

  return results;
}

/**
 * Extract visible text from raw accumulated text for the current node.
 * Strips any <node ...> or </node> tags and holds back partial tag suffixes.
 * Handles both typed <node type="..."> and untyped <node> opening tags.
 */
function extractCurrentNodeVisibleText(rawAccumulated: string, nodeIndex: number): string {
  // Find all opening tags
  const openings = findNodeOpenings(rawAccumulated);

  if (openings.length === 0 || nodeIndex >= openings.length) {
    // No opening tag yet for this node index -- return empty
    return '';
  }

  // Skip past completed nodes to find the current one
  // We need to track close tags to determine which nodes are complete
  let closeCount = 0;
  let searchFrom = 0;
  while (closeCount < nodeIndex) {
    const closeIdx = rawAccumulated.indexOf('</node>', searchFrom);
    if (closeIdx === -1) break;
    searchFrom = closeIdx + '</node>'.length;
    closeCount++;
  }

  // The current node's opening tag
  const currentOpening = openings[nodeIndex];
  const contentStart = currentOpening.index + currentOpening.length;

  // Get everything after the opening tag
  let content = rawAccumulated.substring(contentStart);

  // Remove any closing </node> tag if present
  const closeIdx = content.indexOf('</node>');
  if (closeIdx !== -1) {
    content = content.substring(0, closeIdx);
  }

  // Hold back partial tags at the end
  const partialLen = partialTagSuffixLength(content);
  if (partialLen > 0) {
    content = content.substring(0, content.length - partialLen);
  }

  return content;
}

/**
 * Stream a Claude response with buffered updates and typed node boundary detection
 * (GENP-03, GENP-04, D-01, D-03).
 *
 * Key behavior for multi-node streaming (D-03):
 * - Accumulates raw text deltas from the API
 * - Tracks which <node type="..."> we're currently inside (nodeIndex)
 * - Parses type and lang attributes from opening tags into TypedNodeMeta
 * - Strips typed node tags from the text flushed to onTextUpdate
 * - When </node> is detected mid-stream, calls onNodeBoundary with the
 *   completed node content, its index, and its TypedNodeMeta
 * - Passes current TypedNodeMeta to onTextUpdate so callers can route rendering
 * - Flushes accumulated visible text to onTextUpdate at BUFFER_INTERVAL_MS
 * - Calls onFirstToken once when the first text delta arrives
 * - Watchdog fires onTimeout after 30s of no deltas (GENP-11)
 * - Respects AbortSignal for cancellation
 * - Returns accumulated text and usage after stream completes
 */
export async function streamIntoNode(
  client: Anthropic,
  systemPrompt: SystemPromptBlock[],
  userMessage: string,
  signal: AbortSignal,
  callbacks: StreamCallbacks
): Promise<StreamResult> {
  let rawAccumulated = '';
  let nodeIndex = 0;
  let insideNode = false;
  let firstTokenFired = false;
  let lastFlushTime = Date.now();
  const completedNodes: string[] = [];

  // Track how many </node> closings we've processed
  let processedCloseCount = 0;
  // Track how many opening tags we've processed
  let processedOpenCount = 0;

  // Track metadata for each node opening tag (indexed by open order)
  const nodeMetas: TypedNodeMeta[] = [];

  // Watchdog timer
  let watchdogTimer: ReturnType<typeof setTimeout> | null = null;

  function resetWatchdog(): void {
    if (watchdogTimer !== null) {
      clearTimeout(watchdogTimer);
    }
    watchdogTimer = setTimeout(() => {
      callbacks.onTimeout();
    }, WATCHDOG_TIMEOUT_MS);
  }

  function clearWatchdog(): void {
    if (watchdogTimer !== null) {
      clearTimeout(watchdogTimer);
      watchdogTimer = null;
    }
  }

  // Buffer flush timer
  let flushTimer: ReturnType<typeof setTimeout> | null = null;

  function scheduleFlush(): void {
    if (flushTimer !== null) return; // already scheduled
    flushTimer = setTimeout(() => {
      flushTimer = null;
      flushCurrentNodeText();
    }, BUFFER_INTERVAL_MS);
  }

  function flushCurrentNodeText(): void {
    const visibleText = extractCurrentNodeVisibleText(rawAccumulated, nodeIndex);
    if (visibleText.length > 0) {
      const currentMeta = nodeMetas[nodeIndex] ?? { type: 'text' as const };
      callbacks.onTextUpdate(visibleText, currentMeta);
      lastFlushTime = Date.now();
    }
  }

  // Process tag boundaries in the accumulated text
  function processTagBoundaries(): void {
    // Find all opening tags and their metadata
    const openings = findNodeOpenings(rawAccumulated);
    const openCount = openings.length;

    // Count </node> closings
    let searchFrom = 0;
    let closeCount = 0;
    while (true) {
      const idx = rawAccumulated.indexOf('</node>', searchFrom);
      if (idx === -1) break;
      closeCount++;
      searchFrom = idx + '</node>'.length;
    }

    // Process any new openings -- store their metadata
    while (processedOpenCount < openCount) {
      nodeMetas[processedOpenCount] = openings[processedOpenCount].meta;
      processedOpenCount++;
      insideNode = true;
    }

    // Process any new closings
    while (closeCount > processedCloseCount) {
      // A node just closed
      const nodeContent = extractNodeContentByIndex(rawAccumulated, processedCloseCount);
      const meta = nodeMetas[processedCloseCount] ?? { type: 'text' as const };
      callbacks.onNodeBoundary(nodeContent, processedCloseCount, meta);
      completedNodes.push(nodeContent);
      processedCloseCount++;
      nodeIndex = processedCloseCount;
      insideNode = false;
    }
  }

  // Start the stream via the Anthropic SDK
  const stream = client.messages.stream(
    {
      model: 'claude-opus-4-6',
      max_tokens: MAX_OUTPUT_TOKENS,
      system: systemPrompt as any,
      messages: [{ role: 'user', content: userMessage }],
    },
    { signal }
  );

  // Register text handler
  stream.on('text', (delta: string) => {
    if (signal.aborted) return;

    // Accumulate raw text
    rawAccumulated += delta;

    // Reset watchdog on every delta
    resetWatchdog();

    // Fire onFirstToken exactly once
    if (!firstTokenFired) {
      firstTokenFired = true;
      callbacks.onFirstToken();
    }

    // Check for tag boundaries
    processTagBoundaries();

    // Schedule buffered flush
    scheduleFlush();
  });

  // Wait for the stream to complete
  const finalMessage = await stream.finalMessage();

  // Clear timers
  clearWatchdog();
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  // Final flush of any remaining text
  const finalVisibleText = extractCurrentNodeVisibleText(rawAccumulated, nodeIndex);
  if (finalVisibleText.length > 0) {
    const currentMeta = nodeMetas[nodeIndex] ?? { type: 'text' as const };
    callbacks.onTextUpdate(finalVisibleText, currentMeta);
  }

  return {
    text: rawAccumulated,
    usage: {
      input_tokens: finalMessage.usage.input_tokens,
      output_tokens: finalMessage.usage.output_tokens,
    },
    nodeContents: parseNodeContent(rawAccumulated),
  };
}

/**
 * Extract the content of a specific node by its zero-based index.
 * Used internally when a node boundary is detected.
 * Handles both typed and untyped opening tags.
 */
function extractNodeContentByIndex(rawText: string, nodeIndex: number): string {
  // Find all opening tags
  const openings = findNodeOpenings(rawText);

  if (nodeIndex >= openings.length) return '';

  const opening = openings[nodeIndex];
  const contentStart = opening.index + opening.length;
  const remaining = rawText.substring(contentStart);

  // Find the matching </node>
  const closeIdx = remaining.indexOf('</node>');
  if (closeIdx === -1) return remaining.trim();

  return remaining.substring(0, closeIdx).trim();
}
