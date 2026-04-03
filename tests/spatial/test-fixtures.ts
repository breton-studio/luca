/**
 * Reusable test factories for spatial analysis tests.
 * Creates CanvasNodeInfo and CanvasEdgeInfo objects with sensible defaults.
 */

import type { CanvasNodeInfo } from '../../src/types/canvas';
import type { CanvasEdgeInfo } from '../../src/spatial/types';

let nodeCounter = 0;

/**
 * Create a CanvasNodeInfo with defaults, overridable per field.
 * Each call increments the internal counter for unique IDs.
 */
export function makeNode(overrides: Partial<CanvasNodeInfo> = {}): CanvasNodeInfo {
  nodeCounter++;
  return {
    id: overrides.id ?? `node-${nodeCounter}`,
    type: overrides.type ?? 'text',
    x: overrides.x ?? 0,
    y: overrides.y ?? 0,
    width: overrides.width ?? 200,
    height: overrides.height ?? 100,
    content: overrides.content ?? `Node ${nodeCounter}`,
    color: overrides.color,
  };
}

/**
 * Create a CanvasEdgeInfo linking two nodes.
 */
export function makeEdge(fromNode: string, toNode: string, label?: string): CanvasEdgeInfo {
  return {
    id: `edge-${fromNode}-${toNode}`,
    fromNode,
    toNode,
    label,
  };
}

/**
 * Sparse canvas: 3 nodes spread far apart.
 */
export function sparseCanvas(): CanvasNodeInfo[] {
  return [
    makeNode({ id: 'a', x: 0, y: 0 }),
    makeNode({ id: 'b', x: 800, y: 0 }),
    makeNode({ id: 'c', x: 0, y: 600 }),
  ];
}

/**
 * Dense canvas: 6 nodes packed tightly together.
 */
export function denseCanvas(): CanvasNodeInfo[] {
  return [
    makeNode({ id: 'd1', x: 0, y: 0 }),
    makeNode({ id: 'd2', x: 50, y: 0 }),
    makeNode({ id: 'd3', x: 100, y: 0 }),
    makeNode({ id: 'd4', x: 0, y: 50 }),
    makeNode({ id: 'd5', x: 50, y: 50 }),
    makeNode({ id: 'd6', x: 100, y: 50 }),
  ];
}

/**
 * Clustered canvas: two clusters with a gap, plus an outlier.
 */
export function clusteredCanvas(): CanvasNodeInfo[] {
  return [
    // Cluster 1: top-left area
    makeNode({ id: 'c1a', x: 0, y: 0 }),
    makeNode({ id: 'c1b', x: 50, y: 0 }),
    makeNode({ id: 'c1c', x: 25, y: 50 }),
    // Cluster 2: bottom-right area (far away)
    makeNode({ id: 'c2a', x: 800, y: 600 }),
    makeNode({ id: 'c2b', x: 850, y: 600 }),
    makeNode({ id: 'c2c', x: 825, y: 650 }),
    // Outlier
    makeNode({ id: 'out', x: 400, y: 300 }),
  ];
}

/**
 * Single node canvas -- edge case testing.
 */
export function singleNode(): CanvasNodeInfo[] {
  return [makeNode({ id: 'solo', x: 100, y: 100 })];
}

/**
 * Reset the node counter between tests to ensure deterministic IDs.
 */
export function resetNodeCounter(): void {
  nodeCounter = 0;
}
