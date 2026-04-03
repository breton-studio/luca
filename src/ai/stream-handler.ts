/**
 * Stream handler with buffered updates, watchdog, and node boundary detection
 * (GENP-03, GENP-04, GENP-11, D-03).
 *
 * Streams Claude responses with:
 * - Buffered text flushing at BUFFER_INTERVAL_MS intervals
 * - Tag-aware accumulation that strips <node>/<\/node> from visible text
 * - Mid-stream </node> boundary detection with onNodeBoundary callback
 * - Timeout watchdog that fires after 30s of silence
 * - AbortSignal support for cancellation
 */

import type Anthropic from '@anthropic-ai/sdk';
import { BUFFER_INTERVAL_MS } from '../types/settings';
import type { SystemPromptBlock } from './prompt-builder';

const WATCHDOG_TIMEOUT_MS = 30_000; // 30 seconds (GENP-11)

export interface StreamResult {
  text: string;
  usage: { input_tokens: number; output_tokens: number };
  nodeContents: string[]; // Parsed from <node> delimiters
}

export interface StreamCallbacks {
  onFirstToken: () => void;              // Remove pulsing, set status to streaming
  onTextUpdate: (text: string) => void;  // Buffered text flush -- current node's visible content only
  onTimeout: () => void;                 // Watchdog fired (GENP-11)
  /**
   * Called when a </node> closing tag is detected mid-stream (D-03).
   * Provides the completed node's content (tags stripped) and its
   * zero-based index. The caller should use this to finalize the
   * current canvas node and pre-allocate the next one. After this
   * callback returns, subsequent onTextUpdate calls will contain
   * the NEW node's content (the caller should redirect updates to
   * the newly created canvas node).
   */
  onNodeBoundary: (completedNodeContent: string, nodeIndex: number) => void;
}

/**
 * Parse streamed response into individual node contents (D-02).
 * Splits on <node>...</node> delimiters. If no delimiters found,
 * treats entire text as a single node.
 */
export function parseNodeContent(responseText: string): string[] {
  const regex = /<node>([\s\S]*?)<\/node>/g;
  const matches: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(responseText)) !== null) {
    matches.push(match[1].trim());
  }

  if (matches.length === 0) {
    return [responseText.trim()];
  }

  return matches;
}

// Possible partial tag prefixes to hold back from visible text
const PARTIAL_OPEN_TAGS = ['<', '<n', '<no', '<nod', '<node'];
const PARTIAL_CLOSE_TAGS = ['</', '</n', '</no', '</nod', '</node'];

/**
 * Check if text ends with a partial tag that should be held back.
 * Returns the length of the partial tag suffix, or 0 if none.
 */
function partialTagSuffixLength(text: string): number {
  // Check close tags first (longer prefixes first for greedy match)
  for (let i = PARTIAL_CLOSE_TAGS.length - 1; i >= 0; i--) {
    const partial = PARTIAL_CLOSE_TAGS[i];
    if (text.endsWith(partial)) return partial.length;
  }
  // Check open tags
  for (let i = PARTIAL_OPEN_TAGS.length - 1; i >= 0; i--) {
    const partial = PARTIAL_OPEN_TAGS[i];
    if (text.endsWith(partial)) return partial.length;
  }
  return 0;
}

/**
 * Extract visible text from raw accumulated text for the current node.
 * Strips any <node> or </node> tags and holds back partial tag suffixes.
 */
function extractCurrentNodeVisibleText(rawAccumulated: string, nodeIndex: number): string {
  // Find the start of the current node's content
  let searchFrom = 0;
  let nodesFound = 0;

  // Skip past completed nodes
  while (nodesFound < nodeIndex) {
    const closeIdx = rawAccumulated.indexOf('</node>', searchFrom);
    if (closeIdx === -1) break;
    searchFrom = closeIdx + '</node>'.length;
    nodesFound++;
  }

  // Find the opening <node> tag for the current node
  const openIdx = rawAccumulated.indexOf('<node>', searchFrom);
  if (openIdx === -1) {
    // No opening tag yet for this node index -- return empty
    return '';
  }

  const contentStart = openIdx + '<node>'.length;

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
 * Stream a Claude response with buffered updates and node boundary detection
 * (GENP-03, GENP-04, D-03).
 *
 * Key behavior for multi-node streaming (D-03):
 * - Accumulates raw text deltas from the API
 * - Tracks which <node> we're currently inside (nodeIndex)
 * - Strips <node>/<\/node> tags from the text flushed to onTextUpdate
 * - When </node> is detected mid-stream, calls onNodeBoundary with the
 *   completed node content and its index
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
  // Track how many <node> openings we've processed
  let processedOpenCount = 0;

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
      callbacks.onTextUpdate(visibleText);
      lastFlushTime = Date.now();
    }
  }

  // Process tag boundaries in the accumulated text
  function processTagBoundaries(): void {
    // Count <node> openings
    let searchFrom = 0;
    let openCount = 0;
    while (true) {
      const idx = rawAccumulated.indexOf('<node>', searchFrom);
      if (idx === -1) break;
      openCount++;
      searchFrom = idx + '<node>'.length;
    }

    // Count </node> closings
    searchFrom = 0;
    let closeCount = 0;
    while (true) {
      const idx = rawAccumulated.indexOf('</node>', searchFrom);
      if (idx === -1) break;
      closeCount++;
      searchFrom = idx + '</node>'.length;
    }

    // Process any new openings
    if (openCount > processedOpenCount) {
      insideNode = true;
      processedOpenCount = openCount;
    }

    // Process any new closings
    while (closeCount > processedCloseCount) {
      // A node just closed
      const nodeContent = extractNodeContentByIndex(rawAccumulated, processedCloseCount);
      callbacks.onNodeBoundary(nodeContent, processedCloseCount);
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
      max_tokens: 4096,
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
    callbacks.onTextUpdate(finalVisibleText);
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
 */
function extractNodeContentByIndex(rawText: string, nodeIndex: number): string {
  const regex = /<node>([\s\S]*?)<\/node>/g;
  let match: RegExpExecArray | null;
  let currentIndex = 0;

  while ((match = regex.exec(rawText)) !== null) {
    if (currentIndex === nodeIndex) {
      return match[1].trim();
    }
    currentIndex++;
  }

  return '';
}
