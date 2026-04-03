/**
 * Tests for DBSCAN clustering with adaptive epsilon and focus cluster detection.
 *
 * Covers: D-01 (adaptive epsilon), D-05 (dense group detection),
 * D-06 (conservative clustering), D-07 (outlier handling), D-08 (focus cluster).
 */

import {
  dbscan,
  computeAdaptiveEpsilon,
  findFocusCluster,
  ClusterResult,
  ClusterInfo,
} from '../../src/spatial/clustering';
import { computeCenter } from '../../src/spatial/proximity';
import {
  makeNode,
  sparseCanvas,
  denseCanvas,
  clusteredCanvas,
  singleNode,
  resetNodeCounter,
} from './test-fixtures';

beforeEach(() => {
  resetNodeCounter();
});

describe('dbscan', () => {
  it('should find 1 cluster of 2 with tight nodes and covering epsilon', () => {
    const nodes = [
      makeNode({ id: 'a', x: 0, y: 0, width: 200, height: 100 }),
      makeNode({ id: 'b', x: 50, y: 0, width: 200, height: 100 }),
    ];
    // Centers: a=(100,50), b=(150,50) => distance ~50
    const result = dbscan(nodes, 100, 2);
    expect(result.clusters).toHaveLength(1);
    expect(result.clusters[0]).toContain('a');
    expect(result.clusters[0]).toContain('b');
    expect(result.noise).toHaveLength(0);
  });

  it('should find 2 clusters with outlier from clusteredCanvas (D-07)', () => {
    const nodes = clusteredCanvas();
    // Two clusters of 3 + 1 outlier
    const epsilon = computeAdaptiveEpsilon(nodes);
    const result = dbscan(nodes, epsilon, 2);
    expect(result.clusters).toHaveLength(2);
    // Each cluster should have 3 nodes
    for (const cluster of result.clusters) {
      expect(cluster).toHaveLength(3);
    }
    // Outlier 'out' should be noise
    expect(result.noise).toContain('out');
    expect(result.noise).toHaveLength(1);
  });

  it('should produce 0 clusters and all noise with sparseCanvas and small epsilon', () => {
    const nodes = sparseCanvas();
    // Small epsilon that won't reach any neighbor
    const result = dbscan(nodes, 10, 2);
    expect(result.clusters).toHaveLength(0);
    expect(result.noise).toHaveLength(nodes.length);
  });

  it('should produce at least 1 cluster with sparseCanvas and adaptive epsilon', () => {
    const nodes = sparseCanvas();
    const epsilon = computeAdaptiveEpsilon(nodes);
    const result = dbscan(nodes, epsilon, 2);
    expect(result.clusters.length).toBeGreaterThanOrEqual(1);
  });

  it('should produce 0 clusters and 1 noise with single node', () => {
    const nodes = singleNode();
    const result = dbscan(nodes, 100, 2);
    expect(result.clusters).toHaveLength(0);
    expect(result.noise).toHaveLength(1);
    expect(result.noise[0]).toBe('solo');
  });

  it('should produce 0 clusters and 0 noise with empty array', () => {
    const result = dbscan([], 100, 2);
    expect(result.clusters).toHaveLength(0);
    expect(result.noise).toHaveLength(0);
  });

  it('should mark outliers as NOISE, not clusters of one (D-07)', () => {
    // One tight pair + one far outlier
    const nodes = [
      makeNode({ id: 'close1', x: 0, y: 0 }),
      makeNode({ id: 'close2', x: 50, y: 0 }),
      makeNode({ id: 'far', x: 5000, y: 5000 }),
    ];
    const result = dbscan(nodes, 200, 2);
    expect(result.clusters).toHaveLength(1);
    expect(result.noise).toContain('far');
    // The outlier is NOT in any cluster
    for (const cluster of result.clusters) {
      expect(cluster).not.toContain('far');
    }
  });
});

describe('computeAdaptiveEpsilon', () => {
  it('should return smaller epsilon for denseCanvas than sparseCanvas (D-01)', () => {
    const dense = denseCanvas();
    const sparse = sparseCanvas();
    const denseEps = computeAdaptiveEpsilon(dense);
    const sparseEps = computeAdaptiveEpsilon(sparse);
    expect(denseEps).toBeLessThan(sparseEps);
  });

  it('should return Infinity for 1 node', () => {
    const nodes = singleNode();
    expect(computeAdaptiveEpsilon(nodes)).toBe(Infinity);
  });

  it('should return Infinity for 0 nodes', () => {
    expect(computeAdaptiveEpsilon([])).toBe(Infinity);
  });

  it('should scale with multiplier', () => {
    const nodes = denseCanvas();
    const eps1 = computeAdaptiveEpsilon(nodes, 1.0);
    const eps2 = computeAdaptiveEpsilon(nodes, 2.0);
    expect(eps2).toBeCloseTo(eps1 * 2, 5);
  });
});

describe('findFocusCluster', () => {
  it('should select cluster whose centroid is nearest to trigger node (D-08)', () => {
    // Create two well-separated clusters
    const nodes = clusteredCanvas();
    const epsilon = computeAdaptiveEpsilon(nodes);
    const result = dbscan(nodes, epsilon, 2);

    // Build ClusterInfo objects
    const clusterInfos: ClusterInfo[] = result.clusters.map((nodeIds, idx) => {
      const clusterNodes = nodeIds.map((id) => nodes.find((n) => n.id === id)!);
      const centers = clusterNodes.map((n) => computeCenter(n));
      const centroid = {
        x: centers.reduce((sum, c) => sum + c.x, 0) / centers.length,
        y: centers.reduce((sum, c) => sum + c.y, 0) / centers.length,
      };
      return { id: idx, nodeIds, centroid, nodes: clusterNodes };
    });

    // Trigger node near cluster 1 (top-left area)
    const triggerNode = makeNode({ id: 'trigger', x: 10, y: 10 });
    const allNodes = [...nodes, triggerNode];

    const focus = findFocusCluster(clusterInfos, 'trigger', allNodes);
    expect(focus).not.toBeNull();
    // The focus cluster should contain the top-left cluster nodes
    expect(focus!.nodeIds).toContain('c1a');
    expect(focus!.nodeIds).toContain('c1b');
    expect(focus!.nodeIds).toContain('c1c');
  });

  it('should return null with no clusters', () => {
    const nodes = singleNode();
    const result = findFocusCluster([], 'solo', nodes);
    expect(result).toBeNull();
  });

  it('should return null when trigger node is not found', () => {
    const nodes = clusteredCanvas();
    const epsilon = computeAdaptiveEpsilon(nodes);
    const result = dbscan(nodes, epsilon, 2);

    const clusterInfos: ClusterInfo[] = result.clusters.map((nodeIds, idx) => {
      const clusterNodes = nodeIds.map((id) => nodes.find((n) => n.id === id)!);
      const centers = clusterNodes.map((n) => computeCenter(n));
      const centroid = {
        x: centers.reduce((sum, c) => sum + c.x, 0) / centers.length,
        y: centers.reduce((sum, c) => sum + c.y, 0) / centers.length,
      };
      return { id: idx, nodeIds, centroid, nodes: clusterNodes };
    });

    const focus = findFocusCluster(clusterInfos, 'nonexistent', nodes);
    expect(focus).toBeNull();
  });

  it('should select cluster containing trigger node when trigger is inside a cluster', () => {
    const nodes = clusteredCanvas();
    const epsilon = computeAdaptiveEpsilon(nodes);
    const result = dbscan(nodes, epsilon, 2);

    const clusterInfos: ClusterInfo[] = result.clusters.map((nodeIds, idx) => {
      const clusterNodes = nodeIds.map((id) => nodes.find((n) => n.id === id)!);
      const centers = clusterNodes.map((n) => computeCenter(n));
      const centroid = {
        x: centers.reduce((sum, c) => sum + c.x, 0) / centers.length,
        y: centers.reduce((sum, c) => sum + c.y, 0) / centers.length,
      };
      return { id: idx, nodeIds, centroid, nodes: clusterNodes };
    });

    // 'c1a' is inside the top-left cluster
    const focus = findFocusCluster(clusterInfos, 'c1a', nodes);
    expect(focus).not.toBeNull();
    expect(focus!.nodeIds).toContain('c1a');
  });
});
