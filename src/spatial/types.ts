/**
 * Spatial type definitions for Phase 2: Spatial Intelligence.
 *
 * These types define the spatial analysis data structures used by
 * proximity analysis, clustering, placement, and context building.
 * No Obsidian imports -- pure data types only.
 */

/**
 * Normalized edge data extracted from canvas.
 * Used for edge-boosted relevance scoring (D-03).
 */
export interface CanvasEdgeInfo {
  id: string;
  fromNode: string; // node ID
  toNode: string; // node ID
  label?: string;
}

/**
 * Relationship between two nodes with distance and relevance.
 * Core unit of the proximity graph.
 */
export interface ProximityPair {
  nodeA: string; // node ID
  nodeB: string; // node ID
  distance: number; // Euclidean distance between centers
  relevance: number; // 0.0-1.0, exponential decay per D-02
}

/**
 * Complete set of pairwise relationships for a canvas.
 * Includes computed thresholds for downstream modules.
 */
export interface ProximityGraph {
  pairs: ProximityPair[];
  maxDistance: number; // largest distance in the graph
  adaptiveThreshold: number; // computed from canvas density per D-01
}

/**
 * Simple 2D coordinate.
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Canvas viewport state (zoom and pan).
 * Used for viewport-aware context building (SPAT-10).
 */
export interface ViewportState {
  x: number; // viewport X offset in canvas coords
  y: number; // viewport Y offset in canvas coords
  zoom: number; // current zoom scale
}

/**
 * Tunable spatial parameters.
 * Values chosen based on research and canvas analysis patterns.
 */
export interface SpatialConfig {
  relevanceThreshold: number; // min relevance to include in context, default 0.15
  edgeBoost: number; // additive boost for edge-connected nodes, default 0.3
  adaptiveMultiplier: number; // multiplier for median nearest-neighbor distance, default 2.0
  minPoints: number; // DBSCAN minPoints parameter, default 2
  placementGap: number; // gap between nodes in pixels, default 40
  maxSearchRadius: number; // max outward scan multiplier, default 5
  decayFactor: number; // exponential decay steepness, default 3.0
}

export const DEFAULT_SPATIAL_CONFIG: SpatialConfig = {
  relevanceThreshold: 0.15,
  edgeBoost: 0.3,
  adaptiveMultiplier: 2.0,
  minPoints: 2,
  placementGap: 40,
  maxSearchRadius: 5,
  decayFactor: 3.0,
};
