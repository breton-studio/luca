/**
 * DBSCAN clustering with adaptive epsilon and focus cluster detection.
 *
 * Identifies dense node groups on the canvas (D-05) using DBSCAN
 * with adaptive epsilon that adjusts to canvas density (D-01).
 * Isolated nodes are flagged as outliers (D-07), not clusters of one.
 * Focus cluster is the one nearest to the most recently edited node (D-08).
 *
 * Pure math -- no Obsidian imports.
 */

import type { CanvasNodeInfo } from '../types/canvas';
import type { Point, SpatialConfig } from './types';
import { DEFAULT_SPATIAL_CONFIG } from './types';
import { computeCenter, euclideanDistance } from './proximity';

/**
 * Result of DBSCAN clustering.
 */
export interface ClusterResult {
  clusters: string[][]; // Each cluster is array of node IDs
  noise: string[]; // Node IDs that are outliers (D-07)
}

/**
 * Detailed info about a single cluster.
 */
export interface ClusterInfo {
  id: number; // cluster index
  nodeIds: string[]; // node IDs in this cluster
  centroid: Point; // geometric center of the cluster
  nodes: CanvasNodeInfo[]; // full node data for narrative building
}

// DBSCAN label constants
const UNVISITED = -1;
const NOISE = -2;

/**
 * Compute adaptive epsilon based on canvas node density (D-01).
 *
 * Algorithm: For each node, find distance to nearest neighbor.
 * Sort all nearest-neighbor distances, take the median.
 * Return median * multiplier (default 2.0).
 *
 * The multiplier of 2.0 ensures conservative clustering per D-06 --
 * "fewer, larger clusters".
 *
 * Returns Infinity if fewer than 2 nodes.
 *
 * @param nodes - All canvas nodes
 * @param multiplier - Multiplier for median nearest-neighbor distance (default 2.0)
 * @returns Adaptive epsilon distance
 */
export function computeAdaptiveEpsilon(
  nodes: CanvasNodeInfo[],
  multiplier: number = DEFAULT_SPATIAL_CONFIG.adaptiveMultiplier
): number {
  if (nodes.length < 2) return Infinity;

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

  // Compute median
  nearestDistances.sort((a, b) => a - b);
  const mid = Math.floor(nearestDistances.length / 2);
  const median =
    nearestDistances.length % 2 === 0
      ? (nearestDistances[mid - 1] + nearestDistances[mid]) / 2
      : nearestDistances[mid];

  return median * multiplier;
}

/**
 * Compute the centroid (geometric center) of a set of nodes.
 *
 * @param nodeIds - Node IDs in the cluster
 * @param nodes - All canvas nodes (for lookup)
 * @returns Centroid point (average of all node centers)
 */
function computeClusterCentroid(nodeIds: string[], nodes: CanvasNodeInfo[]): Point {
  const nodeMap = new Map<string, CanvasNodeInfo>();
  for (const n of nodes) {
    nodeMap.set(n.id, n);
  }

  let sumX = 0;
  let sumY = 0;
  let count = 0;
  for (const id of nodeIds) {
    const node = nodeMap.get(id);
    if (node) {
      const center = computeCenter(node);
      sumX += center.x;
      sumY += center.y;
      count++;
    }
  }

  if (count === 0) return { x: 0, y: 0 };
  return { x: sumX / count, y: sumY / count };
}

/**
 * DBSCAN clustering algorithm.
 *
 * Standard DBSCAN: for each unvisited node, find neighbors within epsilon.
 * If neighbors.length >= minPoints, start new cluster and expand.
 * Otherwise mark as NOISE.
 *
 * Per D-07: NOISE nodes are outliers, NOT clusters of one.
 *
 * @param nodes - Canvas nodes to cluster
 * @param epsilon - Maximum distance for neighborhood
 * @param minPoints - Minimum neighbors to form a cluster
 * @returns ClusterResult with clusters and noise arrays
 */
export function dbscan(
  nodes: CanvasNodeInfo[],
  epsilon: number,
  minPoints: number
): ClusterResult {
  if (nodes.length === 0) {
    return { clusters: [], noise: [] };
  }

  const centers = nodes.map((n) => computeCenter(n));
  const labels = new Array<number>(nodes.length).fill(UNVISITED);
  let clusterCount = 0;

  /**
   * Find all node indices within epsilon distance of the given index.
   */
  function regionQuery(idx: number): number[] {
    const neighbors: number[] = [];
    for (let j = 0; j < centers.length; j++) {
      if (euclideanDistance(centers[idx], centers[j]) <= epsilon) {
        neighbors.push(j);
      }
    }
    return neighbors;
  }

  /**
   * Expand a cluster from a seed point.
   */
  function expandCluster(
    pointIdx: number,
    neighbors: number[],
    clusterId: number
  ): void {
    labels[pointIdx] = clusterId;
    const queue = [...neighbors];
    const visited = new Set<number>([pointIdx]);

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      if (labels[current] === NOISE) {
        // Border point -- absorb into cluster
        labels[current] = clusterId;
      }

      if (labels[current] !== UNVISITED) continue;

      labels[current] = clusterId;

      const currentNeighbors = regionQuery(current);
      if (currentNeighbors.length >= minPoints) {
        // Core point -- add its neighbors to the queue
        for (const n of currentNeighbors) {
          if (!visited.has(n)) {
            queue.push(n);
          }
        }
      }
    }
  }

  // Main DBSCAN loop
  for (let i = 0; i < nodes.length; i++) {
    if (labels[i] !== UNVISITED) continue;

    const neighbors = regionQuery(i);
    if (neighbors.length < minPoints) {
      labels[i] = NOISE;
    } else {
      expandCluster(i, neighbors, clusterCount);
      clusterCount++;
    }
  }

  // Build result
  const clusterMap = new Map<number, string[]>();
  const noise: string[] = [];

  for (let i = 0; i < nodes.length; i++) {
    if (labels[i] === NOISE) {
      noise.push(nodes[i].id);
    } else {
      const clusterId = labels[i];
      if (!clusterMap.has(clusterId)) {
        clusterMap.set(clusterId, []);
      }
      clusterMap.get(clusterId)!.push(nodes[i].id);
    }
  }

  const clusters: string[][] = [];
  for (const [, nodeIds] of clusterMap) {
    clusters.push(nodeIds);
  }

  return { clusters, noise };
}

/**
 * Find the focus cluster -- the one nearest to the most recently edited node (D-08).
 *
 * @param clusters - Array of ClusterInfo objects
 * @param triggerNodeId - ID of the most recently edited node
 * @param nodes - All canvas nodes (for trigger node lookup)
 * @returns The nearest ClusterInfo, or null if no clusters or trigger not found
 */
export function findFocusCluster(
  clusters: ClusterInfo[],
  triggerNodeId: string,
  nodes: CanvasNodeInfo[]
): ClusterInfo | null {
  if (clusters.length === 0) return null;

  const triggerNode = nodes.find((n) => n.id === triggerNodeId);
  if (!triggerNode) return null;

  const triggerCenter = computeCenter(triggerNode);

  let nearest: ClusterInfo | null = null;
  let minDist = Infinity;

  for (const cluster of clusters) {
    const dist = euclideanDistance(triggerCenter, cluster.centroid);
    if (dist < minDist) {
      minDist = dist;
      nearest = cluster;
    }
  }

  return nearest;
}
