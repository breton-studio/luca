/**
 * Tests for edge-aligned placement with slide-down + clockwise fallback.
 *
 * Covers: D-09 (right-edge alignment), D-10 (vertical stacking),
 * D-11 (gap enforcement), Pitfall 6 (slide-down before direction fallback),
 * Pitfall 7 (canvas coordinates).
 *
 * Also keeps tests for preserved primitives: checkCollision and findOpenDirection.
 */

import {
  checkCollision,
  findOpenDirection,
  computeEdgeAlignedPlacements,
  computeIterationPlacement,
  BoundingBox,
} from '../../src/spatial/placement';
import { makeNode, resetNodeCounter } from './test-fixtures';

beforeEach(() => {
  resetNodeCounter();
});

describe('checkCollision', () => {
  it('should return true when candidate overlaps an existing node', () => {
    const candidate: BoundingBox = { x: 50, y: 50, width: 100, height: 50 };
    const existing: BoundingBox[] = [{ x: 0, y: 0, width: 200, height: 100 }];
    expect(checkCollision(candidate, existing, 0)).toBe(true);
  });

  it('should return true when candidate is adjacent but within gap (D-11)', () => {
    // Existing node at (0,0) with width 200, height 100
    // Candidate at (210, 0) -- 10px away from existing edge
    // With gap 40, collision should be detected
    const candidate: BoundingBox = { x: 210, y: 0, width: 100, height: 50 };
    const existing: BoundingBox[] = [{ x: 0, y: 0, width: 200, height: 100 }];
    expect(checkCollision(candidate, existing, 40)).toBe(true);
  });

  it('should return false when candidate is beyond gap distance', () => {
    // Existing at (0,0) 200x100, candidate at (300, 0) = 100px gap, well beyond 40
    const candidate: BoundingBox = { x: 300, y: 0, width: 100, height: 50 };
    const existing: BoundingBox[] = [{ x: 0, y: 0, width: 200, height: 100 }];
    expect(checkCollision(candidate, existing, 40)).toBe(false);
  });

  it('should return false with no existing nodes', () => {
    const candidate: BoundingBox = { x: 50, y: 50, width: 100, height: 50 };
    expect(checkCollision(candidate, [], 40)).toBe(false);
  });

  it('should enforce 40px gap on all sides -- node at 160px from 200-wide node at x=0 still collides', () => {
    // Existing node: x=0, width=200 => right edge at 200
    // Candidate at x=160 with width 50 => left edge at 160
    // Physical gap = 200 - 160 = overlap (candidate starts before existing right edge)
    // Even without gap, this overlaps
    const candidate: BoundingBox = { x: 160, y: 0, width: 50, height: 50 };
    const existing: BoundingBox[] = [{ x: 0, y: 0, width: 200, height: 100 }];
    expect(checkCollision(candidate, existing, 40)).toBe(true);
  });

  it('should detect gap violation even when no pixel overlap exists', () => {
    // Existing at (0,0) 200x100, right edge at 200
    // Candidate at (220, 0), left edge at 220, 20px gap -- less than 40
    const candidate: BoundingBox = { x: 220, y: 0, width: 100, height: 50 };
    const existing: BoundingBox[] = [{ x: 0, y: 0, width: 200, height: 100 }];
    expect(checkCollision(candidate, existing, 40)).toBe(true);
  });

  it('should handle vertical gap enforcement', () => {
    // Existing at (0,0) 200x100, bottom edge at 100
    // Candidate at (0, 110), top edge at 110, 10px gap -- less than 40
    const candidate: BoundingBox = { x: 0, y: 110, width: 100, height: 50 };
    const existing: BoundingBox[] = [{ x: 0, y: 0, width: 200, height: 100 }];
    expect(checkCollision(candidate, existing, 40)).toBe(true);
  });
});

describe('findOpenDirection', () => {
  it('should return angle pointing left when nodes are only to the right', () => {
    const center = { x: 100, y: 100 };
    const rightNodes = [
      makeNode({ x: 300, y: 50 }),
      makeNode({ x: 400, y: 100 }),
      makeNode({ x: 350, y: 150 }),
    ];
    const angle = findOpenDirection(center, rightNodes);
    // Should point roughly leftward (around PI radians)
    // Accept anything in the left half-plane: PI/2 <= angle <= 3*PI/2
    // (including straight up/down which is still away from the right side)
    const normalized = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    expect(normalized).toBeGreaterThanOrEqual(Math.PI / 2);
    expect(normalized).toBeLessThanOrEqual(3 * Math.PI / 2);
  });

  it('should return 0 (rightward default) with no other nodes', () => {
    const center = { x: 100, y: 100 };
    expect(findOpenDirection(center, [])).toBe(0);
  });

  it('should find open direction opposite to where nodes concentrate', () => {
    const center = { x: 500, y: 500 };
    // Nodes concentrated below and to the right
    const nodes = [
      makeNode({ x: 600, y: 600 }),
      makeNode({ x: 700, y: 650 }),
      makeNode({ x: 650, y: 700 }),
    ];
    const angle = findOpenDirection(center, nodes);
    // Should point toward upper-left quadrant (PI/2 to PI in standard math coordinates,
    // or 3*PI/2 to 2*PI considering y-axis inversion)
    // The point is it should NOT point toward lower-right
    const normalized = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    // Lower-right is approximately 0 to PI/2 in canvas coords (y increases downward)
    // Open direction should NOT be in that range
    const lowerRight = normalized >= 0 && normalized <= Math.PI / 4;
    expect(lowerRight).toBe(false);
  });
});

describe('computeEdgeAlignedPlacements (D-09, D-10, D-11)', () => {
  it('places a single node at right edge + gap, top-aligned', () => {
    const trigger = makeNode({ id: 't', x: 0, y: 0, width: 200, height: 100 });
    const result = computeEdgeAlignedPlacements(
      trigger,
      1,
      [{ width: 300, height: 200 }],
      [trigger],
      40
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ x: 240, y: 0, width: 300, height: 200 });
  });

  it('stacks three nodes vertically at the same x (D-10)', () => {
    const trigger = makeNode({ id: 't', x: 0, y: 0, width: 200, height: 100 });
    const sizes = [
      { width: 300, height: 200 },
      { width: 300, height: 200 },
      { width: 300, height: 200 },
    ];
    const result = computeEdgeAlignedPlacements(trigger, 3, sizes, [trigger], 40);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ x: 240, y: 0, width: 300, height: 200 });
    expect(result[1]).toEqual({ x: 240, y: 240, width: 300, height: 200 });
    expect(result[2]).toEqual({ x: 240, y: 480, width: 300, height: 200 });
  });

  it('respects heterogeneous node sizes for stack spacing', () => {
    const trigger = makeNode({ id: 't', x: 0, y: 0, width: 200, height: 100 });
    const sizes = [
      { width: 300, height: 200 },
      { width: 400, height: 250 },
      { width: 512, height: 512 },
    ];
    const result = computeEdgeAlignedPlacements(trigger, 3, sizes, [trigger], 40);
    expect(result[0].y).toBe(0);
    expect(result[0].width).toBe(300);
    expect(result[1].y).toBe(240); // 0 + 200 + 40
    expect(result[1].width).toBe(400);
    expect(result[2].y).toBe(530); // 240 + 250 + 40
    expect(result[2].width).toBe(512);
  });

  it('slides down within the right column when first slot collides (Pitfall 6)', () => {
    const trigger = makeNode({ id: 't', x: 0, y: 0, width: 200, height: 100 });
    // Obstacle blocks the primary slot at (240, 0) but leaves space lower
    const obstacle = makeNode({ id: 'o', x: 240, y: 0, width: 300, height: 200 });
    const result = computeEdgeAlignedPlacements(
      trigger,
      1,
      [{ width: 300, height: 200 }],
      [trigger, obstacle],
      40
    );
    expect(result[0].x).toBe(240); // same right column, slid down
    expect(result[0].y).toBeGreaterThanOrEqual(240); // below obstacle + gap
  });

  it('falls back to BELOW trigger when right column is fully blocked', () => {
    const trigger = makeNode({ id: 't', x: 0, y: 0, width: 200, height: 100 });
    // Wall of obstacles blocking the entire right column up to y=2200
    const wall = Array.from({ length: 12 }, (_, i) =>
      makeNode({ id: `w${i}`, x: 240, y: i * 200, width: 300, height: 180 })
    );
    const result = computeEdgeAlignedPlacements(
      trigger,
      1,
      [{ width: 300, height: 200 }],
      [trigger, ...wall],
      40
    );
    // Should fall back to below trigger: x = trigger.x = 0, y = trigger.y + trigger.height + gap = 140
    expect(result[0].x).toBe(0);
    expect(result[0].y).toBe(140);
  });

  it('falls back to LEFT when Right and Below are blocked', () => {
    const trigger = makeNode({ id: 't', x: 1000, y: 500, width: 200, height: 100 });
    const wallRight = Array.from({ length: 12 }, (_, i) =>
      makeNode({ id: `wr${i}`, x: 1240, y: 500 + i * 200, width: 300, height: 180 })
    );
    const blockBelow = makeNode({ id: 'bb', x: 1000, y: 640, width: 300, height: 200 });
    const result = computeEdgeAlignedPlacements(
      trigger,
      1,
      [{ width: 300, height: 200 }],
      [trigger, ...wallRight, blockBelow],
      40
    );
    // Left: x = trigger.x - size.width - gap = 1000 - 300 - 40 = 660, y = trigger.y = 500
    expect(result[0].x).toBe(660);
    expect(result[0].y).toBe(500);
  });

  it('falls back to ABOVE when Right, Below, Left are blocked', () => {
    const trigger = makeNode({ id: 't', x: 1000, y: 500, width: 200, height: 100 });
    const wallRight = Array.from({ length: 12 }, (_, i) =>
      makeNode({ id: `wr${i}`, x: 1240, y: 500 + i * 200, width: 300, height: 180 })
    );
    const blockBelow = makeNode({ id: 'bb', x: 1000, y: 640, width: 300, height: 200 });
    const blockLeft = makeNode({ id: 'bl', x: 660, y: 500, width: 300, height: 200 });
    const result = computeEdgeAlignedPlacements(
      trigger,
      1,
      [{ width: 300, height: 200 }],
      [trigger, ...wallRight, blockBelow, blockLeft],
      40
    );
    // Above: x = trigger.x = 1000, y = trigger.y - size.height - gap = 500 - 200 - 40 = 260
    expect(result[0].x).toBe(1000);
    expect(result[0].y).toBe(260);
  });

  it('returns empty array for count=0', () => {
    const trigger = makeNode({ id: 't', x: 0, y: 0, width: 200, height: 100 });
    expect(computeEdgeAlignedPlacements(trigger, 0, [], [trigger], 40)).toEqual([]);
  });

  it('reuses last size when nodeSizes is shorter than count', () => {
    const trigger = makeNode({ id: 't', x: 0, y: 0, width: 200, height: 100 });
    const result = computeEdgeAlignedPlacements(
      trigger,
      3,
      [{ width: 300, height: 200 }],
      [trigger],
      40
    );
    expect(result).toHaveLength(3);
    expect(result.every((p) => p.width === 300)).toBe(true);
  });

  it('excludes trigger node from collision check', () => {
    const trigger = makeNode({ id: 't', x: 0, y: 0, width: 200, height: 100 });
    // Only the trigger exists — primary slot should be clear
    const result = computeEdgeAlignedPlacements(
      trigger,
      1,
      [{ width: 300, height: 200 }],
      [trigger],
      40
    );
    expect(result[0].x).toBe(240);
    expect(result[0].y).toBe(0);
  });

  it('prevents overlap between sibling placements in the same call', () => {
    const trigger = makeNode({ id: 't', x: 0, y: 0, width: 200, height: 100 });
    const result = computeEdgeAlignedPlacements(
      trigger,
      3,
      [{ width: 300, height: 200 }],
      [trigger],
      40
    );
    // Pairwise no-overlap assertion
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const a = result[i];
        const b = result[j];
        const overlapX = a.x < b.x + b.width && a.x + a.width > b.x;
        const overlapY = a.y < b.y + b.height && a.y + a.height > b.y;
        expect(overlapX && overlapY).toBe(false);
      }
    }
  });
});

// Phase 5 iteration feature: computeIterationPlacement anchors a new node
// directly below a primary source (same x as source, y = source.y +
// source.height + gap). For continuous iteration, the slide-down algorithm
// skips past any existing iterations so the nth iteration lands below the
// (n-1)th, producing a vertical version-history column.
describe('computeIterationPlacement (Phase 5 iteration)', () => {
  it('places the new node directly below the source with gap, same x', () => {
    const source = makeNode({ id: 'src', x: 100, y: 100, width: 400, height: 250 });
    const result = computeIterationPlacement(
      source,
      { width: 400, height: 250 },
      [source],
      40
    );
    expect(result.x).toBe(100);
    expect(result.y).toBe(100 + 250 + 40); // source.y + source.height + gap
    expect(result.width).toBe(400);
    expect(result.height).toBe(250);
  });

  it('uses the new node size, not the source size, for width/height', () => {
    const source = makeNode({ id: 'src', x: 0, y: 0, width: 512, height: 512 });
    const newSize = { width: 300, height: 200 };
    const result = computeIterationPlacement(source, newSize, [source], 40);
    expect(result.width).toBe(300);
    expect(result.height).toBe(200);
  });

  it('does not count the source itself as a collision obstacle', () => {
    const source = makeNode({ id: 'src', x: 0, y: 0, width: 400, height: 250 });
    // Only the source is in existingNodes; placement should succeed below it
    const result = computeIterationPlacement(
      source,
      { width: 400, height: 250 },
      [source],
      40
    );
    // No collision → primary slot returned
    expect(result.y).toBe(250 + 40);
  });

  it('slides down past an existing iteration in the direct slot (continuous iteration)', () => {
    const source = makeNode({ id: 'src', x: 0, y: 0, width: 400, height: 250 });
    // Simulate first iteration already in place, directly below source
    const firstIteration = makeNode({
      id: 'iter1',
      x: 0,
      y: 250 + 40, // source.y + source.height + gap
      width: 400,
      height: 250,
    });
    const result = computeIterationPlacement(
      source,
      { width: 400, height: 250 },
      [source, firstIteration],
      40
    );
    // Should land below iter1, not collide with it
    expect(result.y).toBeGreaterThanOrEqual(firstIteration.y + firstIteration.height + 40);
    expect(result.x).toBe(0); // same column as source
  });

  it('slides down past multiple prior iterations', () => {
    const source = makeNode({ id: 'src', x: 0, y: 0, width: 400, height: 250 });
    const iter1 = makeNode({ id: 'i1', x: 0, y: 290, width: 400, height: 250 });
    const iter2 = makeNode({ id: 'i2', x: 0, y: 580, width: 400, height: 250 });
    const iter3 = makeNode({ id: 'i3', x: 0, y: 870, width: 400, height: 250 });
    const result = computeIterationPlacement(
      source,
      { width: 400, height: 250 },
      [source, iter1, iter2, iter3],
      40
    );
    // Should land below iter3
    expect(result.y).toBeGreaterThanOrEqual(iter3.y + iter3.height + 40);
  });

  it('is stable: identical inputs produce identical outputs', () => {
    const source = makeNode({ id: 'src', x: 50, y: 60, width: 400, height: 250 });
    const nodes = [source];
    const size = { width: 400, height: 250 };
    const a = computeIterationPlacement(source, size, nodes, 40);
    const b = computeIterationPlacement(source, size, nodes, 40);
    expect(a).toEqual(b);
  });

  it('ignores obstacles to the right of the source column (companion nodes do not block)', () => {
    const source = makeNode({ id: 'src', x: 0, y: 0, width: 400, height: 250 });
    // Companion lives to the right at x = 424 (gap 24 per Phase 5)
    const companion = makeNode({
      id: 'comp',
      x: 424,
      y: 0,
      width: 400,
      height: 250,
    });
    const result = computeIterationPlacement(
      source,
      { width: 400, height: 250 },
      [source, companion],
      40
    );
    // Placement lands in the source's column (x=0), below source
    expect(result.x).toBe(0);
    expect(result.y).toBe(250 + 40);
  });
});

describe('computeEdgeAlignedPlacements anchorNode parameter', () => {
  it('behaves identically when anchorNode is undefined (regression guard)', () => {
    const trigger = makeNode({ id: 't', x: 100, y: 100, width: 300, height: 200 });
    const withoutAnchor = computeEdgeAlignedPlacements(
      trigger,
      2,
      [{ width: 300, height: 200 }],
      [trigger],
      40
    );
    const withUndefinedAnchor = computeEdgeAlignedPlacements(
      trigger,
      2,
      [{ width: 300, height: 200 }],
      [trigger],
      40,
      undefined
    );
    expect(withUndefinedAnchor).toEqual(withoutAnchor);
  });

  it('anchors placement math to anchorNode when provided', () => {
    const trigger = makeNode({ id: 't', x: 0, y: 0, width: 200, height: 100 });
    const anchor = makeNode({ id: 'a', x: 500, y: 500, width: 300, height: 200 });
    const result = computeEdgeAlignedPlacements(
      trigger,
      1,
      [{ width: 200, height: 100 }],
      [trigger, anchor],
      40,
      anchor
    );
    // Placement should be anchored relative to the anchor, not the trigger
    // Primary slot: right of anchor, top-aligned with anchor
    expect(result[0].x).toBe(500 + 300 + 40); // anchor.x + anchor.width + gap
    expect(result[0].y).toBe(500); // anchor.y
  });

  it('excludes both trigger and anchor from collision set when anchorNode is provided', () => {
    const trigger = makeNode({ id: 't', x: 0, y: 0, width: 200, height: 100 });
    const anchor = makeNode({ id: 'a', x: 500, y: 500, width: 300, height: 200 });
    // Placement candidate will overlap the anchor itself if we don't exclude it
    const result = computeEdgeAlignedPlacements(
      trigger,
      1,
      [{ width: 200, height: 100 }],
      [trigger, anchor],
      40,
      anchor
    );
    expect(result).toHaveLength(1);
    // Should return a valid placement, not be stuck because the anchor blocked itself
    expect(result[0]).toBeDefined();
  });
});
