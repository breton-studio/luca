/**
 * Public API for the spatial analysis module.
 *
 * Phase 3 imports from here -- this is the only import consumers need.
 *
 * Usage:
 *   import { buildSpatialContext, SpatialContext, DEFAULT_SPATIAL_CONFIG } from '../spatial';
 */

// Top-level orchestrator (the main entry point)
export { buildSpatialContext } from './context-builder';

// Output types
export type { SpatialContext, RelevantNode, OutlierNode } from './context-builder';
export type { ClusterInfo } from './clustering';
export type { PlacementCoordinate, BoundingBox } from './placement';
export type { ProximityGraph, ProximityPair, CanvasEdgeInfo, ViewportState, Point } from './types';

// Configuration
export type { SpatialConfig } from './types';
export { DEFAULT_SPATIAL_CONFIG } from './types';

// Individual functions (for advanced use or testing)
export { computeCenter, euclideanDistance, computeRelevance, buildProximityGraph } from './proximity';
export { dbscan, computeAdaptiveEpsilon, findFocusCluster } from './clustering';
export {
  checkCollision,
  findOpenDirection,
  computeEdgeAlignedPlacements,
  computeIterationPlacement,
} from './placement';
export { serializeNarrative, filterRelevantNodes, describeDirection } from './context-builder';
