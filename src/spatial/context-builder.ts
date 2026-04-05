/**
 * Context builder -- top-level orchestrator for the spatial analysis pipeline.
 *
 * Takes raw CanvasNodeInfo[] and edges, runs proximity analysis, clustering,
 * placement, and produces a structured narrative string for Claude's system prompt.
 *
 * Key design decisions:
 * - Structured narrative format per D-13 with natural language
 * - Only relevant nodes above threshold sent per D-14 / SPAT-07
 * - Spatial directions in narrative per D-15
 * - Outliers briefly mentioned per D-16
 * - Single entry point: buildSpatialContext()
 *
 * Pure math -- no Obsidian imports.
 */

import type { CanvasNodeInfo } from '../types/canvas';
import type { CanvasEdgeInfo, ProximityGraph, SpatialConfig } from './types';
import { DEFAULT_SPATIAL_CONFIG } from './types';
import { buildProximityGraph, computeCenter } from './proximity';
import { dbscan, computeAdaptiveEpsilon, findFocusCluster } from './clustering';
import type { ClusterInfo, ClusterResult } from './clustering';
import { computeEdgeAlignedPlacements } from './placement';
import type { PlacementCoordinate } from './placement';

/**
 * A node that passed the relevance threshold filter.
 */
export interface RelevantNode {
  node: CanvasNodeInfo;
  relevance: number; // 0.0-1.0
  directionFromTrigger: string; // e.g. "above, to the left"
}

/**
 * A node flagged as DBSCAN noise -- mentioned briefly in the narrative.
 */
export interface OutlierNode {
  node: CanvasNodeInfo;
  directionFromTrigger: string;
}

/**
 * Complete spatial context produced by the analysis pipeline.
 * Phase 3 injects this into Claude's system prompt.
 */
export interface SpatialContext {
  focusCluster: ClusterInfo | null;
  relevantNodes: RelevantNode[];
  outliers: OutlierNode[];
  narrative: string;
  placementSuggestions: PlacementCoordinate[];
  triggerNodeId: string;
  totalNodes: number;
}

/**
 * Truncate text to a maximum length, appending '...' if truncated.
 */
function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '...';
}

/**
 * Describe the spatial direction from one node to another.
 *
 * Per D-15: include spatial directions (above, below, to the left, to the right).
 * Uses computeCenter (never raw x,y) per Pitfall 1.
 * Canvas Y increases DOWNWARD: negative dy = above, positive dy = below.
 * Threshold of 30px for directional significance.
 *
 * @param from - The reference node (trigger)
 * @param to - The target node
 * @returns Direction string like "above, to the left" or "nearby"
 */
export function describeDirection(from: CanvasNodeInfo, to: CanvasNodeInfo): string {
  const fromCenter = computeCenter(from);
  const toCenter = computeCenter(to);

  const dx = toCenter.x - fromCenter.x;
  const dy = toCenter.y - fromCenter.y;

  const parts: string[] = [];

  // Canvas Y-down: negative dy = target is above
  if (Math.abs(dy) > 30) {
    parts.push(dy < 0 ? 'above' : 'below');
  }

  if (Math.abs(dx) > 30) {
    parts.push(dx < 0 ? 'to the left' : 'to the right');
  }

  return parts.length > 0 ? parts.join(', ') : 'nearby';
}

/**
 * Filter nodes by relevance threshold (D-14, SPAT-07).
 *
 * For each node (excluding the trigger), find the ProximityPair linking it
 * to the trigger node. If relevance >= threshold, include in the relevant list.
 * The trigger node itself is always included.
 * Results sorted by relevance descending.
 *
 * @param nodes - All canvas nodes
 * @param proximityGraph - Computed proximity graph
 * @param triggerNodeId - ID of the trigger node
 * @param threshold - Minimum relevance to include (default 0.15)
 * @returns Object with relevant and excluded node lists
 */
export function filterRelevantNodes(
  nodes: CanvasNodeInfo[],
  proximityGraph: ProximityGraph,
  triggerNodeId: string,
  threshold: number
): { relevant: RelevantNode[]; excluded: CanvasNodeInfo[] } {
  const triggerNode = nodes.find((n) => n.id === triggerNodeId);
  if (!triggerNode) {
    return { relevant: [], excluded: [...nodes] };
  }

  const relevant: RelevantNode[] = [];
  const excluded: CanvasNodeInfo[] = [];

  // Always include the trigger node
  relevant.push({
    node: triggerNode,
    relevance: 1.0,
    directionFromTrigger: 'nearby',
  });

  for (const node of nodes) {
    if (node.id === triggerNodeId) continue;

    // Find the proximity pair linking this node to the trigger
    const pair = proximityGraph.pairs.find(
      (p) =>
        (p.nodeA === triggerNodeId && p.nodeB === node.id) ||
        (p.nodeB === triggerNodeId && p.nodeA === node.id)
    );

    const relevance = pair ? pair.relevance : 0;

    if (relevance >= threshold) {
      relevant.push({
        node,
        relevance,
        directionFromTrigger: describeDirection(triggerNode, node),
      });
    } else {
      excluded.push(node);
    }
  }

  // Sort by relevance descending (trigger stays first since it's 1.0)
  relevant.sort((a, b) => b.relevance - a.relevance);

  return { relevant, excluded };
}

/**
 * Serialize spatial analysis into a structured narrative for Claude.
 *
 * Per D-13: structured narrative format with natural language.
 * Per D-15: spatial directions included.
 * Per D-16: outliers briefly mentioned as peripheral context.
 *
 * @param focusCluster - The focus cluster (or null if none)
 * @param relevantNodes - Nodes above the relevance threshold
 * @param outliers - DBSCAN noise nodes
 * @param triggerNode - The trigger node
 * @returns Formatted narrative string
 */
export function serializeNarrative(
  focusCluster: ClusterInfo | null,
  relevantNodes: RelevantNode[],
  outliers: OutlierNode[],
  triggerNode: CanvasNodeInfo
): string {
  const lines: string[] = [];

  lines.push('## Canvas Context');
  lines.push('');
  lines.push('The user just edited a node. Here is the spatial context of their canvas:');
  lines.push('');

  // Active Node section
  lines.push('### Active Node');
  lines.push(`- [${triggerNode.type}] "${truncate(triggerNode.content, 100)}"`);
  lines.push('');

  // Focus Area section (if cluster exists)
  if (focusCluster && focusCluster.nodes.length > 0) {
    lines.push(`### Focus Area (${focusCluster.nodes.length} nodes)`);
    for (const node of focusCluster.nodes) {
      if (node.id === triggerNode.id) continue; // Don't duplicate trigger
      const direction = describeDirection(triggerNode, node);
      lines.push(`- [${node.type}] "${truncate(node.content, 100)}" (${direction})`);
    }
    lines.push('');
  }

  // Nearby Context section (relevant nodes not in focus cluster)
  const focusNodeIds = new Set(focusCluster?.nodeIds ?? []);
  const nearbyNodes = relevantNodes.filter(
    (r) => r.node.id !== triggerNode.id && !focusNodeIds.has(r.node.id)
  );

  if (nearbyNodes.length > 0) {
    lines.push(`### Nearby Context (${nearbyNodes.length} nodes)`);
    for (const rn of nearbyNodes) {
      lines.push(
        `- [${rn.node.type}] "${truncate(rn.node.content, 100)}" (${rn.directionFromTrigger}, relevance: ${rn.relevance.toFixed(3)})`
      );
    }
    lines.push('');
  }

  // Peripheral section (outliers, per D-16)
  if (outliers.length > 0) {
    lines.push(`### Peripheral (${outliers.length} distant nodes)`);
    for (const out of outliers) {
      lines.push(
        `- "${truncate(out.node.content, 50)}" (far ${out.directionFromTrigger})`
      );
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Build a complete SpatialContext from raw canvas data.
 *
 * This is the top-level orchestrator function. Phase 3 calls this
 * with canvas nodes and edges, and receives everything needed for
 * the Claude system prompt and node placement.
 *
 * Steps:
 * 1. Build proximity graph
 * 2. Compute adaptive epsilon
 * 3. Run DBSCAN clustering
 * 4. Build ClusterInfo[] from results
 * 5. Find focus cluster
 * 6. Filter relevant nodes
 * 7. Build outlier list
 * 8. Compute placement suggestions
 * 9. Serialize narrative
 * 10. Return complete SpatialContext
 *
 * @param nodes - All canvas nodes
 * @param edges - Canvas edges
 * @param triggerNodeId - ID of the most recently edited node
 * @param config - Optional partial config overrides
 * @returns Complete SpatialContext
 */
export function buildSpatialContext(
  nodes: CanvasNodeInfo[],
  edges: CanvasEdgeInfo[],
  triggerNodeId: string,
  config?: Partial<SpatialConfig>
): SpatialContext {
  const mergedConfig = { ...DEFAULT_SPATIAL_CONFIG, ...config };

  // Edge case: no nodes at all
  if (nodes.length === 0) {
    return {
      focusCluster: null,
      relevantNodes: [],
      outliers: [],
      narrative: '## Canvas Context\n\nThe canvas is empty.',
      placementSuggestions: [],
      triggerNodeId,
      totalNodes: 0,
    };
  }

  // Find the trigger node (fallback to first node if not found)
  let triggerNode = nodes.find((n) => n.id === triggerNodeId);
  if (!triggerNode) {
    triggerNode = nodes[0];
  }

  // Step 1: Build proximity graph
  const graph = buildProximityGraph(nodes, edges, mergedConfig);

  // Step 2: Compute adaptive epsilon
  const epsilon = computeAdaptiveEpsilon(nodes, mergedConfig.adaptiveMultiplier);

  // Step 3: Run DBSCAN clustering
  const clusterResult: ClusterResult = dbscan(nodes, epsilon, mergedConfig.minPoints);

  // Step 4: Build ClusterInfo[] from ClusterResult
  const nodeMap = new Map<string, CanvasNodeInfo>();
  for (const n of nodes) {
    nodeMap.set(n.id, n);
  }

  const clusterInfos: ClusterInfo[] = clusterResult.clusters.map((clusterNodeIds, idx) => {
    const clusterNodes = clusterNodeIds
      .map((id) => nodeMap.get(id))
      .filter((n): n is CanvasNodeInfo => n !== undefined);

    // Compute centroid
    let sumX = 0;
    let sumY = 0;
    for (const n of clusterNodes) {
      const center = computeCenter(n);
      sumX += center.x;
      sumY += center.y;
    }
    const centroid =
      clusterNodes.length > 0
        ? { x: sumX / clusterNodes.length, y: sumY / clusterNodes.length }
        : { x: 0, y: 0 };

    return {
      id: idx,
      nodeIds: clusterNodeIds,
      centroid,
      nodes: clusterNodes,
    };
  });

  // Step 5: Find focus cluster
  const focusCluster = findFocusCluster(clusterInfos, triggerNode.id, nodes);

  // Step 6: Filter relevant nodes
  const { relevant: relevantNodes } = filterRelevantNodes(
    nodes,
    graph,
    triggerNode.id,
    mergedConfig.relevanceThreshold
  );

  // Step 7: Build outlier list from DBSCAN noise nodes
  const outliers: OutlierNode[] = clusterResult.noise
    .map((id) => nodeMap.get(id))
    .filter((n): n is CanvasNodeInfo => n !== undefined)
    .map((node) => ({
      node,
      directionFromTrigger: describeDirection(triggerNode!, node),
    }));

  // Step 8: Compute placement suggestions (D-09, D-10, D-11, Pitfall 6).
  // Edge-aligned placement with default sizing for up to 4 node types
  // (text + code + mermaid + image per Phase 4 D-03).
  //
  // Trade-off: placements are pre-computed with a standard type order
  // (text/code/mermaid/image), but Claude may emit types in a different order.
  // Size mismatch is bounded by Math.max(sizes) vs Math.min(sizes) = 212px,
  // which is within the slide-down search ceiling. The streaming pipeline
  // (main.ts streamWithRetry) overrides width/height to match the actual
  // emitted type when creating the node, so visual collisions are rare but
  // theoretically possible in edge cases.
  const defaultSizesForContext: Array<{ width: number; height: number }> = [
    { width: 300, height: 200 }, // text
    { width: 400, height: 250 }, // code
    { width: 400, height: 300 }, // mermaid
    { width: 512, height: 512 }, // image
  ];
  const placementSuggestions = computeEdgeAlignedPlacements(
    triggerNode,
    4,
    defaultSizesForContext,
    nodes,
    mergedConfig.placementGap
  );

  // Step 9: Serialize narrative
  const narrative = serializeNarrative(focusCluster, relevantNodes, outliers, triggerNode);

  // Step 10: Return complete SpatialContext
  return {
    focusCluster,
    relevantNodes,
    outliers,
    narrative,
    placementSuggestions,
    triggerNodeId: triggerNode.id,
    totalNodes: nodes.length,
  };
}
