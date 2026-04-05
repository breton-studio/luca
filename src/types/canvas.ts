/**
 * Normalized canvas node information used by the plugin.
 * This is the stable interface -- internal API details stay in CanvasAdapter.
 */
export interface CanvasNodeInfo {
  id: string;
  type: 'text' | 'file' | 'link' | 'group';
  x: number;
  y: number;
  width: number;
  height: number;
  content: string; // text content, file path, or URL depending on type
  color?: string;
  /**
   * If this node is a Phase 5 companion render node, points at the AI code
   * node it renders. Populated from `unknownData.companionOf` in the adapter.
   * Used by the iteration detector to redirect edges drawn from the
   * companion (the rendered visual) to its underlying code source.
   */
  companionOf?: string;
}

// Re-export spatial edge type for convenience
import type { CanvasEdgeInfo } from '../spatial/types';
export type { CanvasEdgeInfo };

/**
 * Normalized canvas data (nodes + edges).
 * Used by file-based fallback and spatial analysis (Phase 2).
 */
export interface CanvasSnapshot {
  nodes: CanvasNodeInfo[];
  edges: CanvasEdgeInfo[];
  filePath: string;
}
