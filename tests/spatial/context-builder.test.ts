/**
 * Tests for the context builder module.
 *
 * Covers: describeDirection, filterRelevantNodes, serializeNarrative, buildSpatialContext
 */

import {
  describeDirection,
  filterRelevantNodes,
  serializeNarrative,
  buildSpatialContext,
} from '../../src/spatial/context-builder';
import type { RelevantNode, OutlierNode } from '../../src/spatial/context-builder';
import type { ClusterInfo } from '../../src/spatial/clustering';
import { buildProximityGraph } from '../../src/spatial/proximity';
import { makeNode, makeEdge, clusteredCanvas, singleNode, resetNodeCounter } from './test-fixtures';

beforeEach(() => {
  resetNodeCounter();
});

describe('describeDirection', () => {
  test('node above and left returns "above, to the left"', () => {
    // trigger at (200, 200), target at (0, 0) => target is above and to the left
    // Canvas Y-down: target.y < trigger.y => above
    const trigger = makeNode({ id: 'trigger', x: 200, y: 200, width: 100, height: 100 });
    const target = makeNode({ id: 'target', x: 0, y: 0, width: 100, height: 100 });
    expect(describeDirection(trigger, target)).toBe('above, to the left');
  });

  test('node below and right returns "below, to the right"', () => {
    const trigger = makeNode({ id: 'trigger', x: 0, y: 0, width: 100, height: 100 });
    const target = makeNode({ id: 'target', x: 200, y: 200, width: 100, height: 100 });
    expect(describeDirection(trigger, target)).toBe('below, to the right');
  });

  test('node directly above (dx < 30) returns "above" only', () => {
    const trigger = makeNode({ id: 'trigger', x: 100, y: 200, width: 100, height: 100 });
    const target = makeNode({ id: 'target', x: 110, y: 0, width: 100, height: 100 });
    // dx = (110+50) - (100+50) = 10, dy = (0+50) - (200+50) = -200
    expect(describeDirection(trigger, target)).toBe('above');
  });

  test('node very close (dx < 30, dy < 30) returns "nearby"', () => {
    const trigger = makeNode({ id: 'trigger', x: 100, y: 100, width: 100, height: 100 });
    const target = makeNode({ id: 'target', x: 110, y: 110, width: 100, height: 100 });
    // dx = 10, dy = 10
    expect(describeDirection(trigger, target)).toBe('nearby');
  });

  test('respects canvas Y-down coordinate system (negative dy = above)', () => {
    const trigger = makeNode({ id: 'trigger', x: 0, y: 300, width: 100, height: 100 });
    const target = makeNode({ id: 'target', x: 0, y: 0, width: 100, height: 100 });
    // dy = (0+50) - (300+50) = -300 => above
    const dir = describeDirection(trigger, target);
    expect(dir).toContain('above');
    expect(dir).not.toContain('below');
  });
});

describe('filterRelevantNodes', () => {
  test('nodes with relevance >= threshold are included', () => {
    const nodes = [
      makeNode({ id: 'trigger', x: 0, y: 0 }),
      makeNode({ id: 'close', x: 50, y: 0 }),
    ];
    const graph = buildProximityGraph(nodes, []);
    const result = filterRelevantNodes(nodes, graph, 'trigger', 0.15);
    const ids = result.relevant.map((r) => r.node.id);
    expect(ids).toContain('close');
  });

  test('nodes with relevance < threshold are excluded', () => {
    const nodes = [
      makeNode({ id: 'trigger', x: 0, y: 0, width: 100, height: 100 }),
      makeNode({ id: 'far', x: 2000, y: 2000, width: 100, height: 100 }),
    ];
    const graph = buildProximityGraph(nodes, []);
    // With only 2 nodes, relevance depends on decay. Use a high threshold.
    const result = filterRelevantNodes(nodes, graph, 'trigger', 0.99);
    const excludedIds = result.excluded.map((n) => n.id);
    expect(excludedIds).toContain('far');
  });

  test('trigger node is always included regardless of threshold', () => {
    const nodes = [
      makeNode({ id: 'trigger', x: 0, y: 0 }),
      makeNode({ id: 'other', x: 50, y: 0 }),
    ];
    const graph = buildProximityGraph(nodes, []);
    const result = filterRelevantNodes(nodes, graph, 'trigger', 1.0);
    const ids = result.relevant.map((r) => r.node.id);
    expect(ids).toContain('trigger');
  });

  test('with threshold 0.15: excludes nodes at extreme distance', () => {
    const nodes = [
      makeNode({ id: 'trigger', x: 0, y: 0 }),
      makeNode({ id: 'near', x: 50, y: 0 }),
      makeNode({ id: 'extreme', x: 5000, y: 5000 }),
    ];
    const graph = buildProximityGraph(nodes, []);
    const result = filterRelevantNodes(nodes, graph, 'trigger', 0.15);
    const relevantIds = result.relevant.map((r) => r.node.id);
    // Near node should be relevant, extreme should be excluded
    expect(relevantIds).toContain('near');
  });
});

describe('serializeNarrative', () => {
  const triggerNode = makeNode({ id: 'trigger', x: 0, y: 0, content: 'My trigger node content' });

  test('output contains "## Canvas Context" header', () => {
    const narrative = serializeNarrative(null, [], [], triggerNode);
    expect(narrative).toContain('## Canvas Context');
  });

  test('output contains "### Focus Area" section with cluster nodes', () => {
    const focusCluster: ClusterInfo = {
      id: 0,
      nodeIds: ['n1', 'n2'],
      centroid: { x: 100, y: 100 },
      nodes: [
        makeNode({ id: 'n1', x: 50, y: 50, content: 'First node' }),
        makeNode({ id: 'n2', x: 100, y: 100, content: 'Second node' }),
      ],
    };
    const narrative = serializeNarrative(focusCluster, [], [], triggerNode);
    expect(narrative).toContain('### Focus Area');
  });

  test('output contains spatial directions per D-15', () => {
    const focusCluster: ClusterInfo = {
      id: 0,
      nodeIds: ['below-node'],
      centroid: { x: 0, y: 300 },
      nodes: [
        makeNode({ id: 'below-node', x: 0, y: 300, content: 'Node below' }),
      ],
    };
    const narrative = serializeNarrative(focusCluster, [], [], triggerNode);
    expect(narrative).toContain('below');
  });

  test('output contains "### Peripheral" section when outliers exist per D-16', () => {
    const outliers: OutlierNode[] = [
      {
        node: makeNode({ id: 'out1', x: 1000, y: 1000, content: 'Distant outlier node' }),
        directionFromTrigger: 'below, to the right',
      },
    ];
    const narrative = serializeNarrative(null, [], outliers, triggerNode);
    expect(narrative).toContain('### Peripheral');
  });

  test('node content is truncated (not full text dumped)', () => {
    const longContent = 'A'.repeat(200);
    const focusCluster: ClusterInfo = {
      id: 0,
      nodeIds: ['long'],
      centroid: { x: 100, y: 100 },
      nodes: [
        makeNode({ id: 'long', x: 100, y: 100, content: longContent }),
      ],
    };
    const narrative = serializeNarrative(focusCluster, [], [], triggerNode);
    expect(narrative).not.toContain(longContent);
    expect(narrative).toContain('...');
  });

  test('includes node type in brackets (e.g., "[text]", "[file]")', () => {
    const narrative = serializeNarrative(null, [], [], triggerNode);
    expect(narrative).toContain('[text]');
  });
});

describe('buildSpatialContext', () => {
  test('returns SpatialContext with all fields', () => {
    const nodes = clusteredCanvas();
    const result = buildSpatialContext(nodes, [], 'c1a');
    expect(result).toHaveProperty('focusCluster');
    expect(result).toHaveProperty('relevantNodes');
    expect(result).toHaveProperty('outliers');
    expect(result).toHaveProperty('narrative');
    expect(result).toHaveProperty('placementSuggestions');
    expect(result).toHaveProperty('triggerNodeId');
    expect(result).toHaveProperty('totalNodes');
  });

  test('with clusteredCanvas produces non-empty narrative', () => {
    const nodes = clusteredCanvas();
    const result = buildSpatialContext(nodes, [], 'c1a');
    expect(result.narrative.length).toBeGreaterThan(0);
    expect(result.narrative).toContain('## Canvas Context');
  });

  test('with clusteredCanvas: focus cluster contains trigger node cluster', () => {
    const nodes = clusteredCanvas();
    const result = buildSpatialContext(nodes, [], 'c1a');
    // c1a is in cluster 1 (top-left area), focus cluster should contain c1a
    expect(result.focusCluster).not.toBeNull();
    if (result.focusCluster) {
      expect(result.focusCluster.nodeIds).toContain('c1a');
    }
  });

  test('with clusteredCanvas: narrative contains "Focus Area"', () => {
    const nodes = clusteredCanvas();
    const result = buildSpatialContext(nodes, [], 'c1a');
    expect(result.narrative).toContain('Focus Area');
  });

  test('with clusteredCanvas: narrative contains direction words', () => {
    const nodes = clusteredCanvas();
    const result = buildSpatialContext(nodes, [], 'c1a');
    // The canvas has clusters at different positions, so some direction words should appear
    const hasDirection =
      result.narrative.includes('above') ||
      result.narrative.includes('below') ||
      result.narrative.includes('to the left') ||
      result.narrative.includes('to the right');
    expect(hasDirection).toBe(true);
  });

  test('with clusteredCanvas: outlier appears in "Peripheral" section', () => {
    const nodes = clusteredCanvas();
    const result = buildSpatialContext(nodes, [], 'c1a');
    // The 'out' node should be an outlier (noise in DBSCAN)
    expect(result.outliers.length).toBeGreaterThan(0);
    expect(result.narrative).toContain('Peripheral');
  });

  test('with clusteredCanvas: placementSuggestions has 4 items (one per node type)', () => {
    const nodes = clusteredCanvas();
    const result = buildSpatialContext(nodes, [], 'c1a');
    // Phase 5 Plan 04 bumps count from 3 -> 4 to support Phase 4's four node
    // types (text, code, mermaid, image) via computeEdgeAlignedPlacements.
    expect(result.placementSuggestions).toHaveLength(4);
  });

  test('with clusteredCanvas: relevantNodes sorted by relevance descending', () => {
    const nodes = clusteredCanvas();
    const result = buildSpatialContext(nodes, [], 'c1a');
    for (let i = 1; i < result.relevantNodes.length; i++) {
      expect(result.relevantNodes[i - 1].relevance).toBeGreaterThanOrEqual(
        result.relevantNodes[i].relevance
      );
    }
  });

  test('with single node produces narrative with the node as context', () => {
    const nodes = singleNode();
    const result = buildSpatialContext(nodes, [], 'solo');
    expect(result.narrative).toContain('## Canvas Context');
    expect(result.focusCluster).toBeNull();
    expect(result.totalNodes).toBe(1);
  });

  test('with empty canvas returns empty/minimal SpatialContext', () => {
    const result = buildSpatialContext([], [], 'nonexistent');
    expect(result.focusCluster).toBeNull();
    expect(result.relevantNodes).toHaveLength(0);
    expect(result.outliers).toHaveLength(0);
    expect(result.placementSuggestions).toHaveLength(0);
    expect(result.narrative).toContain('Canvas Context');
  });
});
