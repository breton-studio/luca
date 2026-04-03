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
}

// Re-export spatial edge type for convenience
export type { CanvasEdgeInfo } from '../spatial/types';

/**
 * Normalized canvas data (nodes + edges).
 * Used by file-based fallback and spatial analysis (Phase 2).
 */
export interface CanvasSnapshot {
  nodes: CanvasNodeInfo[];
  edges: CanvasEdgeInfo[];
  filePath: string;
}
