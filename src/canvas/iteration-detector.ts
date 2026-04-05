/**
 * Iteration detection for Phase 5 gap closure.
 *
 * Feature: the user can draw a canvas edge FROM an AI-generated node TO a
 * new text node, then write iteration instructions in the text node. The
 * plugin detects this pattern and treats the text-node edit as an "iteration
 * request" on the linked AI node, producing a new version of the same type
 * anchored below the source.
 *
 * This module is a pure function — no Obsidian imports, no canvas API
 * calls, no DOM manipulation. It takes already-extracted canvas data
 * (nodes, edges, aiNodeIds) and returns either an IterationContext
 * describing the iteration, or null for the normal (non-iteration) flow.
 *
 * Key design notes:
 *  - aiNodeIds is a JS Set, which preserves insertion order. We use that
 *    order to determine which AI source is "most recent" for multi-source
 *    merge: the primary source is the one with the highest insertion index.
 *  - Source type is classified from node content, not from any schema flag.
 *    This keeps V1 stateless — we don't need to extend aiNodeIds to track
 *    per-node types, and it handles the truncation fallback case (a code
 *    node created from a partial stream still looks like a fenced code
 *    block if it has the opener).
 *  - For image sources (canvas file nodes with image extensions), content
 *    is the file path. V1 does not persist the original Runware prompt;
 *    the iteration prompt asks Claude to infer visual intent from the user's
 *    instructions alone.
 */

import type { CanvasNodeInfo } from '../types/canvas';
import type { CanvasEdgeInfo } from '../spatial/types';

export type IterationSourceType = 'code' | 'text' | 'mermaid' | 'image';

export interface IterationSource {
  /** The original AI-created canvas node being iterated on. */
  node: CanvasNodeInfo;
  /** Inferred medium of the source. */
  type: IterationSourceType;
  /**
   * Unwrapped content:
   *  - code/mermaid: fence stripped, inner body only
   *  - text: raw markdown (no processing)
   *  - image: file path (vault-relative)
   */
  content: string;
  /** Populated only for `type === 'code'`. `undefined` if the fence had no lang marker. */
  lang?: string;
  /**
   * Position in `aiNodeIds` insertion order. Lower = older. Used to determine
   * the primary source when the user links multiple AI nodes to one text node.
   */
  createdIndex: number;
}

export interface IterationContext {
  /** The most recently created AI source — determines target type and placement anchor. */
  primarySource: IterationSource;
  /** Other linked AI sources, ordered most-recent-first. Empty for single-source iteration. */
  additionalSources: IterationSource[];
  /** The user-written text node the edges point INTO — where the trigger edit happened. */
  triggerTextNode: CanvasNodeInfo;
  /** The trigger text node's content, trimmed. Guaranteed non-empty when this struct exists. */
  userInstructions: string;
  /** Alias for `primarySource.type` — the medium the iteration output must be. */
  targetType: IterationSourceType;
  /** Alias for `primarySource.lang` — only populated for code iterations. */
  targetLang?: string;
}

// ---------- Content classifiers ----------

/**
 * Matches a fenced code block at the very start of the content, captures an
 * optional lang and the body. Handles content that may have trailing whitespace
 * or partial truncation (missing trailing fence), since the anchor is the
 * opening fence + lang marker.
 */
const FENCE_RE = /^```([\w+-]+)?\s*\n([\s\S]*?)(?:\n```\s*)?$/;

/** Recognized image file extensions. Lowercase comparison. */
const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg']);

function getFileExtension(path: string): string {
  const lastDot = path.lastIndexOf('.');
  if (lastDot === -1 || lastDot === path.length - 1) return '';
  return path.substring(lastDot + 1).toLowerCase();
}

/**
 * Classify an AI-created canvas node into an IterationSource by inspecting
 * its content. Returns `null` if the node is not in `aiNodeIds` (user node).
 *
 * Note: `createdIndex` is set to -1 here because this helper has no visibility
 * into the insertion order. `detectIterationContext` fills it in from its own
 * `aiOrder` array.
 */
export function classifyAiNode(
  node: CanvasNodeInfo,
  aiNodeIds: Set<string>
): IterationSource | null {
  if (!aiNodeIds.has(node.id)) return null;

  // Image: canvas file node with an image extension. Content is the file path.
  if (node.type === 'file') {
    const ext = getFileExtension(node.content);
    if (IMAGE_EXTS.has(ext)) {
      return {
        node,
        type: 'image',
        content: node.content,
        createdIndex: -1,
      };
    }
    // File node that isn't an image (e.g., linked .md) falls through to text.
  }

  // Fenced block: either mermaid or code.
  const trimmed = node.content.trimStart();
  const match = trimmed.match(FENCE_RE);
  if (match) {
    const lang = match[1]; // may be undefined
    const body = match[2] ?? '';
    if (lang === 'mermaid') {
      return {
        node,
        type: 'mermaid',
        content: body,
        createdIndex: -1,
      };
    }
    return {
      node,
      type: 'code',
      content: body,
      lang: lang || undefined,
      createdIndex: -1,
    };
  }

  // Plain markdown — text iteration.
  return {
    node,
    type: 'text',
    content: node.content,
    createdIndex: -1,
  };
}

// ---------- Top-level detection ----------

export interface DetectIterationParams {
  triggerNodeId: string;
  nodes: CanvasNodeInfo[];
  edges: CanvasEdgeInfo[];
  aiNodeIds: Set<string>;
}

/**
 * Returns an IterationContext if the trigger node has one or more incoming
 * edges from AI-created nodes with classifiable content, otherwise `null`.
 *
 * Non-iteration cases (return null):
 *  - Trigger node not found in `nodes`
 *  - Trigger is itself in `aiNodeIds` (shouldn't happen via normal gates, defense-in-depth)
 *  - Trigger content is empty or whitespace-only
 *  - Trigger has no incoming edges
 *  - No incoming edge source is in `aiNodeIds`
 *
 * Multi-source behavior: the PRIMARY source is the one with the highest
 * `createdIndex` (most recently added to `aiNodeIds`). All other linked AI
 * sources become `additionalSources`, ordered most-recent-first.
 */
export function detectIterationContext(
  params: DetectIterationParams
): IterationContext | null {
  const { triggerNodeId, nodes, edges, aiNodeIds } = params;

  // 1. Trigger must exist.
  const triggerNode = nodes.find(n => n.id === triggerNodeId);
  if (!triggerNode) return null;

  // 2. Defense-in-depth: trigger must not be an AI node.
  if (aiNodeIds.has(triggerNodeId)) return null;

  // 3. Defense-in-depth: trigger must have non-empty content.
  const instructions = triggerNode.content.trim();
  if (instructions.length === 0) return null;

  // 4. Build insertion-order lookup once.
  const aiOrder = Array.from(aiNodeIds);

  // 5. Collect incoming edges, classify each source.
  const sources: IterationSource[] = [];
  for (const edge of edges) {
    if (edge.toNode !== triggerNodeId) continue;
    const sourceNode = nodes.find(n => n.id === edge.fromNode);
    if (!sourceNode) continue;
    const classified = classifyAiNode(sourceNode, aiNodeIds);
    if (!classified) continue;
    classified.createdIndex = aiOrder.indexOf(sourceNode.id);
    sources.push(classified);
  }

  if (sources.length === 0) return null;

  // 6. Sort descending by createdIndex (most recent first).
  sources.sort((a, b) => b.createdIndex - a.createdIndex);

  const primarySource = sources[0];
  const additionalSources = sources.slice(1);

  return {
    primarySource,
    additionalSources,
    triggerTextNode: triggerNode,
    userInstructions: instructions,
    targetType: primarySource.type,
    targetLang: primarySource.lang,
  };
}
