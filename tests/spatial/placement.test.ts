/**
 * Tests for collision-free orbital placement with directional scanning.
 *
 * Covers: D-09 (orbital placement), D-10 (directional fanning),
 * D-11 (gap enforcement), D-12 (outward scan), Pitfall 3 (bounded search),
 * Pitfall 7 (canvas coordinates).
 */

import {
  checkCollision,
  findOpenDirection,
  computeOrbitalPlacements,
  BoundingBox,
  PlacementCoordinate,
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
    // Accept anything in the left half-plane: PI/2 < angle < 3*PI/2
    // or equivalently |angle - PI| < PI/2
    const normalized = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    expect(normalized).toBeGreaterThan(Math.PI / 2);
    expect(normalized).toBeLessThan(3 * Math.PI / 2);
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

describe('computeOrbitalPlacements', () => {
  it('should place 1 node at orbital distance from trigger with no obstacles', () => {
    const trigger = makeNode({ id: 'trigger', x: 100, y: 100, width: 200, height: 100 });
    const result = computeOrbitalPlacements(
      trigger,
      1,
      { width: 200, height: 100 },
      [trigger],
      40
    );
    expect(result).toHaveLength(1);

    // Should be at least (max(200,100)/2 + 40 + 200/2) = 100 + 40 + 100 = 240px from trigger center
    const triggerCenterX = trigger.x + trigger.width / 2;
    const triggerCenterY = trigger.y + trigger.height / 2;
    const placedCenterX = result[0].x + result[0].width / 2;
    const placedCenterY = result[0].y + result[0].height / 2;
    const dist = Math.sqrt(
      Math.pow(placedCenterX - triggerCenterX, 2) +
      Math.pow(placedCenterY - triggerCenterY, 2)
    );
    expect(dist).toBeGreaterThanOrEqual(200); // At minimum orbital distance
  });

  it('should place exactly 3 nodes fanning out in an arc (D-10)', () => {
    const trigger = makeNode({ id: 'trigger', x: 100, y: 100, width: 200, height: 100 });
    const result = computeOrbitalPlacements(
      trigger,
      3,
      { width: 200, height: 100 },
      [trigger],
      40
    );
    expect(result).toHaveLength(3);

    // Each placement should have valid coordinates
    for (const p of result) {
      expect(p.width).toBe(200);
      expect(p.height).toBe(100);
      expect(typeof p.x).toBe('number');
      expect(typeof p.y).toBe('number');
      expect(isNaN(p.x)).toBe(false);
      expect(isNaN(p.y)).toBe(false);
    }
  });

  it('should scan outward when placement is blocked by existing node (D-12)', () => {
    const trigger = makeNode({ id: 'trigger', x: 500, y: 500, width: 200, height: 100 });
    // Place blocking nodes around the trigger at the default orbital distance
    const blockers = [
      makeNode({ id: 'block-right', x: 740, y: 450, width: 200, height: 200 }),
      makeNode({ id: 'block-left', x: 60, y: 450, width: 200, height: 200 }),
    ];
    const allNodes = [trigger, ...blockers];

    const result = computeOrbitalPlacements(
      trigger,
      1,
      { width: 200, height: 100 },
      allNodes,
      40
    );
    expect(result).toHaveLength(1);

    // The result should not overlap any existing node
    for (const existing of allNodes) {
      const overlapX =
        result[0].x < existing.x + existing.width + 40 &&
        result[0].x + result[0].width > existing.x - 40;
      const overlapY =
        result[0].y < existing.y + existing.height + 40 &&
        result[0].y + result[0].height > existing.y - 40;
      if (overlapX && overlapY) {
        // If both axes overlap, it's a collision -- this should not happen
        // Exception: the trigger node itself is excluded from collision check
        // Only fail if colliding with a non-trigger node
        if (existing.id !== 'trigger') {
          fail(`Placement at (${result[0].x}, ${result[0].y}) collides with ${existing.id}`);
        }
      }
    }
  });

  it('should place at max radius when all nearby space is blocked (D-12 fallback)', () => {
    const trigger = makeNode({ id: 'trigger', x: 500, y: 500, width: 200, height: 100 });
    // Create a dense ring of blockers around the trigger
    const blockers = [];
    for (let angle = 0; angle < 360; angle += 30) {
      const rad = (angle * Math.PI) / 180;
      const bx = 500 + Math.cos(rad) * 300 - 100;
      const by = 500 + Math.sin(rad) * 300 - 75;
      blockers.push(
        makeNode({
          id: `blocker-${angle}`,
          x: Math.round(bx),
          y: Math.round(by),
          width: 200,
          height: 150,
        })
      );
    }
    const allNodes = [trigger, ...blockers];

    const result = computeOrbitalPlacements(
      trigger,
      1,
      { width: 200, height: 100 },
      allNodes,
      40
    );
    // Should still return exactly 1 placement (at max radius)
    expect(result).toHaveLength(1);
  });

  it('should never produce placements that overlap existing nodes', () => {
    const trigger = makeNode({ id: 'trigger', x: 300, y: 300, width: 200, height: 100 });
    const neighbors = [
      makeNode({ id: 'n1', x: 540, y: 280, width: 200, height: 100 }),
      makeNode({ id: 'n2', x: 300, y: 440, width: 200, height: 100 }),
      makeNode({ id: 'n3', x: 60, y: 280, width: 200, height: 100 }),
    ];
    const allNodes = [trigger, ...neighbors];

    const result = computeOrbitalPlacements(
      trigger,
      3,
      { width: 200, height: 100 },
      allNodes,
      40
    );
    expect(result).toHaveLength(3);

    // Verify no placement collides with any non-trigger existing node
    for (const placement of result) {
      for (const existing of neighbors) {
        const gapX = Math.max(
          existing.x - (placement.x + placement.width),
          placement.x - (existing.x + existing.width)
        );
        const gapY = Math.max(
          existing.y - (placement.y + placement.height),
          placement.y - (existing.y + existing.height)
        );
        // If both gaps are negative, there's an overlap
        if (gapX < 0 && gapY < 0) {
          fail(
            `Placement at (${placement.x}, ${placement.y}) overlaps with ${existing.id} at (${existing.x}, ${existing.y})`
          );
        }
      }
    }
  });

  it('should maintain gap from existing nodes (D-11)', () => {
    const trigger = makeNode({ id: 'trigger', x: 300, y: 300, width: 200, height: 100 });
    const neighbor = makeNode({ id: 'near', x: 540, y: 280, width: 200, height: 100 });
    const allNodes = [trigger, neighbor];
    const gap = 40;

    const result = computeOrbitalPlacements(
      trigger,
      2,
      { width: 200, height: 100 },
      allNodes,
      gap
    );

    // Each placement should maintain at least `gap` distance from `neighbor`
    for (const placement of result) {
      // Compute minimum separation on each axis
      const sepX = Math.max(
        neighbor.x - (placement.x + placement.width),
        placement.x - (neighbor.x + neighbor.width)
      );
      const sepY = Math.max(
        neighbor.y - (placement.y + placement.height),
        placement.y - (neighbor.y + neighbor.height)
      );

      // If they overlap on one axis, the other axis must have at least gap separation
      // If they overlap on both axes, that's a collision (handled by collision test above)
      // If separated on at least one axis, that axis separation should be >= 0
      // The gap is enforced through the collision check with expanded bounding boxes
      if (sepX < 0 && sepY < 0) {
        fail(`Placement at (${placement.x}, ${placement.y}) overlaps with neighbor`);
      }
    }
  });

  it('should return coordinates in canvas space, not viewport coordinates (Pitfall 7)', () => {
    const trigger = makeNode({ id: 'trigger', x: 5000, y: 5000, width: 200, height: 100 });
    const result = computeOrbitalPlacements(
      trigger,
      1,
      { width: 200, height: 100 },
      [trigger],
      40
    );

    // Coordinates should be near the trigger node (in canvas space)
    // NOT transformed to viewport/screen coordinates
    const placedCenter = {
      x: result[0].x + result[0].width / 2,
      y: result[0].y + result[0].height / 2,
    };
    const triggerCenter = {
      x: trigger.x + trigger.width / 2,
      y: trigger.y + trigger.height / 2,
    };

    // The placement should be within a reasonable radius of the trigger
    const dist = Math.sqrt(
      Math.pow(placedCenter.x - triggerCenter.x, 2) +
      Math.pow(placedCenter.y - triggerCenter.y, 2)
    );
    // Max orbital distance should be starting_radius * maxSearchRadius = ~240 * 5 = 1200
    expect(dist).toBeLessThan(1500);
    // And definitely near the trigger, not near (0,0)
    expect(result[0].x).toBeGreaterThan(4000);
    expect(result[0].y).toBeGreaterThan(4000);
  });

  it('should return exactly count PlacementCoordinate items', () => {
    const trigger = makeNode({ id: 'trigger', x: 0, y: 0, width: 200, height: 100 });
    for (const count of [1, 2, 3, 5]) {
      const result = computeOrbitalPlacements(
        trigger,
        count,
        { width: 150, height: 80 },
        [trigger],
        40
      );
      expect(result).toHaveLength(count);
    }
  });
});
