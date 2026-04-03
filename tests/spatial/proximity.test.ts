import {
  computeCenter,
  euclideanDistance,
  computeRelevance,
  computeAdaptiveThreshold,
  buildProximityGraph,
} from '../../src/spatial/proximity';
import { DEFAULT_SPATIAL_CONFIG } from '../../src/spatial/types';
import {
  makeNode,
  makeEdge,
  sparseCanvas,
  denseCanvas,
  singleNode,
  resetNodeCounter,
} from './test-fixtures';

beforeEach(() => {
  resetNodeCounter();
});

describe('computeCenter', () => {
  test('computes center from top-left x,y plus half width/height', () => {
    const node = makeNode({ x: 100, y: 100, width: 200, height: 100 });
    const center = computeCenter(node);
    expect(center.x).toBe(200); // 100 + 200/2
    expect(center.y).toBe(150); // 100 + 100/2
  });

  test('computes center for zero-origin node', () => {
    const node = makeNode({ x: 0, y: 0, width: 200, height: 100 });
    const center = computeCenter(node);
    expect(center.x).toBe(100);
    expect(center.y).toBe(50);
  });

  test('computes center for large node', () => {
    const node = makeNode({ x: 500, y: 300, width: 400, height: 600 });
    const center = computeCenter(node);
    expect(center.x).toBe(700); // 500 + 400/2
    expect(center.y).toBe(600); // 300 + 600/2
  });
});

describe('euclideanDistance', () => {
  test('returns correct distance for 3-4-5 triangle', () => {
    const dist = euclideanDistance({ x: 0, y: 0 }, { x: 3, y: 4 });
    expect(dist).toBe(5);
  });

  test('returns 0 for same point', () => {
    const dist = euclideanDistance({ x: 0, y: 0 }, { x: 0, y: 0 });
    expect(dist).toBe(0);
  });

  test('returns correct distance for negative coordinates', () => {
    const dist = euclideanDistance({ x: -3, y: -4 }, { x: 0, y: 0 });
    expect(dist).toBe(5);
  });

  test('is symmetric', () => {
    const a = { x: 10, y: 20 };
    const b = { x: 30, y: 50 };
    expect(euclideanDistance(a, b)).toBe(euclideanDistance(b, a));
  });
});

describe('computeRelevance', () => {
  test('returns ~1.0 for distance 0', () => {
    const relevance = computeRelevance(0, 1000, false);
    expect(relevance).toBeCloseTo(1.0, 1);
  });

  test('returns value near 0.05 for max distance', () => {
    const relevance = computeRelevance(1000, 1000, false);
    expect(relevance).toBeLessThan(0.1);
    expect(relevance).toBeGreaterThan(0.0);
  });

  test('returns higher value with edge connection', () => {
    const withoutEdge = computeRelevance(500, 1000, false);
    const withEdge = computeRelevance(500, 1000, true, 0.3);
    expect(withEdge).toBeGreaterThan(withoutEdge);
    expect(withEdge - withoutEdge).toBeCloseTo(0.3, 1);
  });

  test('clamps edge-boosted values to max 1.0', () => {
    // Distance 0 gives relevance ~1.0, plus edge boost should still clamp to 1.0
    const relevance = computeRelevance(0, 1000, true, 0.3);
    expect(relevance).toBe(1.0);
  });

  test('uses default decay factor when not provided', () => {
    const relevance = computeRelevance(500, 1000, false);
    // With decay factor 3.0: exp(-3.0 * 0.5) = exp(-1.5) ~ 0.223
    expect(relevance).toBeCloseTo(0.223, 1);
  });

  test('uses custom decay factor', () => {
    const relevance = computeRelevance(500, 1000, false, 0, 1.0);
    // With decay factor 1.0: exp(-1.0 * 0.5) = exp(-0.5) ~ 0.607
    expect(relevance).toBeCloseTo(0.607, 1);
  });

  test('handles zero maxDistance without NaN', () => {
    const relevance = computeRelevance(0, 0, false);
    expect(relevance).toBeCloseTo(1.0, 1);
    expect(Number.isNaN(relevance)).toBe(false);
  });
});

describe('computeAdaptiveThreshold', () => {
  test('returns Infinity for single node', () => {
    const nodes = singleNode();
    const threshold = computeAdaptiveThreshold(nodes);
    expect(threshold).toBe(Infinity);
  });

  test('returns Infinity for empty array', () => {
    const threshold = computeAdaptiveThreshold([]);
    expect(threshold).toBe(Infinity);
  });

  test('returns distance * multiplier for two nodes', () => {
    const nodes = [
      makeNode({ id: 'a', x: 0, y: 0, width: 200, height: 100 }),
      makeNode({ id: 'b', x: 300, y: 0, width: 200, height: 100 }),
    ];
    const threshold = computeAdaptiveThreshold(nodes, 2.0);
    // Center a = (100, 50), center b = (400, 50)
    // Distance = 300
    // Threshold = 300 * 2.0 = 600
    expect(threshold).toBe(600);
  });

  test('sparse canvas returns larger threshold than dense canvas', () => {
    const sparse = sparseCanvas();
    const dense = denseCanvas();
    const sparseThreshold = computeAdaptiveThreshold(sparse);
    const denseThreshold = computeAdaptiveThreshold(dense);
    expect(sparseThreshold).toBeGreaterThan(denseThreshold);
  });

  test('uses default multiplier of 2.0', () => {
    const nodes = [
      makeNode({ id: 'a', x: 0, y: 0, width: 200, height: 100 }),
      makeNode({ id: 'b', x: 300, y: 0, width: 200, height: 100 }),
    ];
    const withDefault = computeAdaptiveThreshold(nodes);
    const withExplicit = computeAdaptiveThreshold(nodes, 2.0);
    expect(withDefault).toBe(withExplicit);
  });
});

describe('buildProximityGraph', () => {
  test('returns empty pairs array for single node', () => {
    const nodes = singleNode();
    const graph = buildProximityGraph(nodes, []);
    expect(graph.pairs).toEqual([]);
  });

  test('returns correct distances for two nodes', () => {
    const nodes = [
      makeNode({ id: 'a', x: 0, y: 0, width: 200, height: 100 }),
      makeNode({ id: 'b', x: 300, y: 0, width: 200, height: 100 }),
    ];
    const graph = buildProximityGraph(nodes, []);
    expect(graph.pairs).toHaveLength(1);
    expect(graph.pairs[0].distance).toBe(300);
    expect(graph.pairs[0].nodeA).toBe('a');
    expect(graph.pairs[0].nodeB).toBe('b');
  });

  test('pairs are sorted by distance ascending', () => {
    const nodes = [
      makeNode({ id: 'a', x: 0, y: 0, width: 200, height: 100 }),
      makeNode({ id: 'b', x: 500, y: 0, width: 200, height: 100 }),
      makeNode({ id: 'c', x: 100, y: 0, width: 200, height: 100 }),
    ];
    const graph = buildProximityGraph(nodes, []);
    for (let i = 1; i < graph.pairs.length; i++) {
      expect(graph.pairs[i].distance).toBeGreaterThanOrEqual(
        graph.pairs[i - 1].distance
      );
    }
  });

  test('edge-connected pairs have higher relevance', () => {
    const nodes = [
      makeNode({ id: 'a', x: 0, y: 0, width: 200, height: 100 }),
      makeNode({ id: 'b', x: 300, y: 0, width: 200, height: 100 }),
    ];
    const edges = [makeEdge('a', 'b')];
    const graphWithEdges = buildProximityGraph(nodes, edges);
    const graphWithout = buildProximityGraph(nodes, []);

    expect(graphWithEdges.pairs[0].relevance).toBeGreaterThan(
      graphWithout.pairs[0].relevance
    );
  });

  test('includes maxDistance in graph', () => {
    const nodes = sparseCanvas();
    const graph = buildProximityGraph(nodes, []);
    expect(graph.maxDistance).toBeGreaterThan(0);
    // maxDistance should equal the largest pairwise distance
    const maxPairDist = Math.max(...graph.pairs.map((p) => p.distance));
    expect(graph.maxDistance).toBe(maxPairDist);
  });

  test('includes adaptiveThreshold in graph', () => {
    const nodes = sparseCanvas();
    const graph = buildProximityGraph(nodes, []);
    expect(graph.adaptiveThreshold).toBeGreaterThan(0);
    expect(graph.adaptiveThreshold).toBeLessThan(Infinity);
  });

  test('relevance scores are between 0.0 and 1.0', () => {
    const nodes = sparseCanvas();
    const edges = [makeEdge('a', 'b')];
    const graph = buildProximityGraph(nodes, edges);
    for (const pair of graph.pairs) {
      expect(pair.relevance).toBeGreaterThanOrEqual(0.0);
      expect(pair.relevance).toBeLessThanOrEqual(1.0);
    }
  });

  test('accepts partial SpatialConfig override', () => {
    const nodes = [
      makeNode({ id: 'a', x: 0, y: 0, width: 200, height: 100 }),
      makeNode({ id: 'b', x: 300, y: 0, width: 200, height: 100 }),
    ];
    const graph = buildProximityGraph(nodes, [], { edgeBoost: 0.5 });
    expect(graph.pairs).toHaveLength(1);
  });

  test('empty canvas returns empty graph', () => {
    const graph = buildProximityGraph([], []);
    expect(graph.pairs).toEqual([]);
    expect(graph.maxDistance).toBe(0);
    expect(graph.adaptiveThreshold).toBe(Infinity);
  });
});
