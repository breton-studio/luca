/**
 * Proximity analysis module for spatial intelligence.
 *
 * Computes distances, relevance scores, and proximity graphs
 * from canvas node positions. Pure math -- no Obsidian imports.
 *
 * Key design decisions:
 * - Node centers computed from top-left (x,y) + half (width,height) per Pitfall 1
 * - Relevance uses exponential decay (not linear) per D-02
 * - Edge connections add a relevance boost per D-03
 * - Adaptive threshold adjusts to canvas density per D-01
 * - Works with 1-3 nodes (edge cases) per D-04
 */

import type { CanvasNodeInfo } from '../types/canvas';
import type {
  Point,
  CanvasEdgeInfo,
  ProximityPair,
  ProximityGraph,
  SpatialConfig,
} from './types';
import { DEFAULT_SPATIAL_CONFIG } from './types';

/**
 * Compute the center point of a canvas node from its top-left position and dimensions.
 * IMPORTANT: Never use raw x,y as "position" -- always compute center (Pitfall 1).
 */
export function computeCenter(node: CanvasNodeInfo): Point {
  return {
    x: node.x + node.width / 2,
    y: node.y + node.height / 2,
  };
}

/**
 * Euclidean distance between two 2D points.
 */
export function euclideanDistance(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Compute relevance score (0.0-1.0) from distance using exponential decay.
 *
 * Formula: exp(-decayFactor * normalized) where normalized = min(distance / maxDistance, 1.0)
 * If hasEdgeConnection, add edgeBoost and clamp to 1.0.
 *
 * @param distance - Euclidean distance between node centers
 * @param maxDistance - Maximum distance for normalization (adaptive threshold)
 * @param hasEdgeConnection - Whether nodes are connected by a canvas edge
 * @param edgeBoost - Additive boost for edge-connected nodes (default 0.3)
 * @param decayFactor - Steepness of exponential decay (default 3.0)
 * @returns Relevance score clamped to [0.0, 1.0]
 */
export function computeRelevance(
  distance: number,
  maxDistance: number,
  hasEdgeConnection: boolean,
  edgeBoost: number = DEFAULT_SPATIAL_CONFIG.edgeBoost,
  decayFactor: number = DEFAULT_SPATIAL_CONFIG.decayFactor
): number {
  // Handle edge case: if maxDistance is 0, all nodes are co-located
  const normalized = maxDistance > 0 ? Math.min(distance / maxDistance, 1.0) : 0;

  let relevance = Math.exp(-decayFactor * normalized);

  if (hasEdgeConnection) {
    relevance += edgeBoost;
  }

  // Clamp to [0.0, 1.0] and round to 3 decimal places
  relevance = Math.min(1.0, Math.max(0.0, relevance));
  return Math.round(relevance * 1000) / 1000;
}

/**
 * Compute adaptive threshold based on canvas node density (D-01).
 *
 * Algorithm: For each node, find distance to nearest neighbor.
 * Take the median of all nearest-neighbor distances.
 * Multiply by adaptiveMultiplier to get the threshold.
 *
 * Returns Infinity if fewer than 2 nodes (D-04).
 *
 * @param nodes - All canvas nodes
 * @param multiplier - Multiplier for median nearest-neighbor distance (default 2.0)
 * @returns Adaptive distance threshold in pixels
 */
export function computeAdaptiveThreshold(
  nodes: CanvasNodeInfo[],
  multiplier: number = DEFAULT_SPATIAL_CONFIG.adaptiveMultiplier
): number {
  if (nodes.length < 2) return Infinity;

  // Compute centers for all nodes
  const centers = nodes.map((n) => computeCenter(n));

  // Find nearest-neighbor distance for each node
  const nearestDistances: number[] = [];
  for (let i = 0; i < centers.length; i++) {
    let minDist = Infinity;
    for (let j = 0; j < centers.length; j++) {
      if (i === j) continue;
      const dist = euclideanDistance(centers[i], centers[j]);
      if (dist < minDist) {
        minDist = dist;
      }
    }
    nearestDistances.push(minDist);
  }

  // Compute median of nearest-neighbor distances
  nearestDistances.sort((a, b) => a - b);
  const mid = Math.floor(nearestDistances.length / 2);
  const median =
    nearestDistances.length % 2 === 0
      ? (nearestDistances[mid - 1] + nearestDistances[mid]) / 2
      : nearestDistances[mid];

  return median * multiplier;
}

/**
 * Build a proximity graph from canvas nodes and edges.
 *
 * Computes all pairwise distances and relevance scores,
 * using adaptive threshold for distance normalization.
 * Edge-connected pairs receive a relevance boost (D-03).
 *
 * @param nodes - All canvas nodes
 * @param edges - Canvas edges (for edge-boosted relevance)
 * @param config - Partial spatial config overrides
 * @returns ProximityGraph with pairs sorted by distance ascending
 */
export function buildProximityGraph(
  nodes: CanvasNodeInfo[],
  edges: CanvasEdgeInfo[],
  config?: Partial<SpatialConfig>
): ProximityGraph {
  const cfg = { ...DEFAULT_SPATIAL_CONFIG, ...config };

  if (nodes.length < 2) {
    return {
      pairs: [],
      maxDistance: 0,
      adaptiveThreshold: Infinity,
    };
  }

  // Build edge lookup set for O(1) edge checking
  const edgeSet = new Set<string>();
  for (const edge of edges) {
    // Store both directions for undirected lookup
    edgeSet.add(`${edge.fromNode}:${edge.toNode}`);
    edgeSet.add(`${edge.toNode}:${edge.fromNode}`);
  }

  // Compute centers
  const centers = new Map<string, Point>();
  for (const node of nodes) {
    centers.set(node.id, computeCenter(node));
  }

  // Compute all pairwise distances
  const pairs: ProximityPair[] = [];
  let maxDistance = 0;

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const nodeA = nodes[i];
      const nodeB = nodes[j];
      const centerA = centers.get(nodeA.id)!;
      const centerB = centers.get(nodeB.id)!;
      const distance = euclideanDistance(centerA, centerB);

      if (distance > maxDistance) {
        maxDistance = distance;
      }

      pairs.push({
        nodeA: nodeA.id,
        nodeB: nodeB.id,
        distance,
        relevance: 0, // placeholder, computed after maxDistance is known
      });
    }
  }

  // Compute adaptive threshold
  const adaptiveThreshold = computeAdaptiveThreshold(nodes, cfg.adaptiveMultiplier);

  // Use adaptive threshold as normalization base for relevance,
  // but ensure it's at least maxDistance to avoid over-scoring distant nodes
  const normalizationDistance = Math.max(adaptiveThreshold, maxDistance);

  // Compute relevance scores now that we have maxDistance
  for (const pair of pairs) {
    const hasEdge = edgeSet.has(`${pair.nodeA}:${pair.nodeB}`);
    pair.relevance = computeRelevance(
      pair.distance,
      normalizationDistance,
      hasEdge,
      cfg.edgeBoost,
      cfg.decayFactor
    );
  }

  // Sort by distance ascending
  pairs.sort((a, b) => a.distance - b.distance);

  return {
    pairs,
    maxDistance,
    adaptiveThreshold,
  };
}
