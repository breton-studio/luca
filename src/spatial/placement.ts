/**
 * Edge-aligned placement with slide-down + clockwise fallback.
 *
 * Computes where to place generated nodes relative to the trigger node.
 * Per D-09: nodes flow rightward from the trigger node's right edge, top-aligned.
 * Per D-10: multiple nodes stack vertically along the same x-coordinate with a
 * consistent gap between them.
 * Per D-11: gap of 40px is enforced between all nodes via expanded bounding
 * box collision checking.
 * Per Pitfall 6: when the right column is blocked, SLIDE DOWN within the right
 * column before falling back to another direction.
 * Clockwise fallback order (D-11 + UI-SPEC): Right -> slide down -> Below -> Left -> Above.
 *
 * Legacy primitives `checkCollision` and `findOpenDirection` are preserved;
 * they are still consumed by this module and by tests.
 *
 * All coordinates are in canvas space, not viewport space (Pitfall 7).
 * Pure math -- no Obsidian imports.
 */

import type { CanvasNodeInfo } from '../types/canvas';
import type { Point } from './types';
import { DEFAULT_SPATIAL_CONFIG } from './types';
import { computeCenter } from './proximity';

/**
 * Axis-aligned bounding box.
 */
export interface BoundingBox {
  x: number; // top-left x
  y: number; // top-left y
  width: number;
  height: number;
}

/**
 * Computed placement coordinate for a generated node.
 */
export interface PlacementCoordinate {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Check if a candidate bounding box collides with any existing bounding box,
 * accounting for a gap buffer on all sides.
 *
 * Per D-11: expand each existing node's bounding box by `gap` on ALL sides
 * before checking AABB overlap. The gap is NOT just "no pixel overlap" --
 * it's enforced as expanded bounding boxes (Pitfall 4).
 *
 * @param candidate - The bounding box to test
 * @param existing - Array of existing bounding boxes
 * @param gap - Gap in pixels to enforce around each existing box (default 40)
 * @returns true if ANY collision detected (including gap violation)
 */
export function checkCollision(
  candidate: BoundingBox,
  existing: BoundingBox[],
  gap: number = DEFAULT_SPATIAL_CONFIG.placementGap
): boolean {
  for (const box of existing) {
    // Expand existing box by gap on all sides
    const expandedX = box.x - gap;
    const expandedY = box.y - gap;
    const expandedWidth = box.width + 2 * gap;
    const expandedHeight = box.height + 2 * gap;

    // AABB overlap test
    const overlapX =
      candidate.x < expandedX + expandedWidth &&
      candidate.x + candidate.width > expandedX;
    const overlapY =
      candidate.y < expandedY + expandedHeight &&
      candidate.y + candidate.height > expandedY;

    if (overlapX && overlapY) {
      return true;
    }
  }

  return false;
}

/**
 * Find the direction (angle in radians) with the most open space around a center point.
 *
 * Preserved from the prior orbital algorithm. No longer consumed by placement
 * directly, but retained because tests cover it and other future strategies
 * may want to reuse it.
 *
 * Per D-10: divide space into 8 sectors (45 degrees each).
 * For each sector, count how many existing node centers fall within a 90-degree
 * arc of that direction. Return the angle of the sector with the fewest nodes.
 *
 * If no existing nodes, default to 0 (rightward).
 *
 * @param center - Center point to find open direction from
 * @param existingNodes - Existing canvas nodes to avoid
 * @returns Angle in radians of the most open direction
 */
export function findOpenDirection(
  center: Point,
  existingNodes: CanvasNodeInfo[]
): number {
  if (existingNodes.length === 0) return 0;

  // 8 sectors at 45-degree intervals
  const sectorCount = 8;
  const sectorSize = (2 * Math.PI) / sectorCount;
  const sectorCounts = new Array<number>(sectorCount).fill(0);

  for (const node of existingNodes) {
    const nodeCenter = computeCenter(node);
    const dx = nodeCenter.x - center.x;
    const dy = nodeCenter.y - center.y;

    // Skip nodes at the exact same position
    if (dx === 0 && dy === 0) continue;

    // Compute angle (atan2 returns -PI to PI)
    let angle = Math.atan2(dy, dx);
    if (angle < 0) angle += 2 * Math.PI;

    // Count this node in all sectors whose 90-degree arc includes this angle
    for (let s = 0; s < sectorCount; s++) {
      const sectorAngle = s * sectorSize;
      // Angular distance between node angle and sector center
      let diff = Math.abs(angle - sectorAngle);
      if (diff > Math.PI) diff = 2 * Math.PI - diff;

      // 90-degree arc = PI/4 on each side of center
      if (diff <= Math.PI / 4) {
        sectorCounts[s]++;
      }
    }
  }

  // Find sector with fewest nodes
  let minCount = Infinity;
  let bestSector = 0;
  for (let s = 0; s < sectorCount; s++) {
    if (sectorCounts[s] < minCount) {
      minCount = sectorCounts[s];
      bestSector = s;
    }
  }

  return bestSector * sectorSize;
}

/**
 * Compute edge-aligned placements for generated nodes (D-09, D-10, D-11, Pitfall 6).
 *
 * Strategy:
 *  1. First candidate: x = trigger.x + trigger.width + gap, y = trigger.y
 *     (top-aligned per D-09).
 *  2. Subsequent candidates: same x, y stacked below previous placement + gap (D-10).
 *  3. If collision at candidate: slide candidate y DOWNWARD within the right
 *     column (x unchanged) in increments of gap until a free slot is found OR
 *     we exceed the slide-down search ceiling (Pitfall 6).
 *  4. If the right column is entirely blocked, try BELOW the trigger:
 *     x = trigger.x, y = trigger.y + trigger.height + gap.
 *  5. If Below blocked, try LEFT: x = trigger.x - nodeSize.width - gap, y = trigger.y.
 *  6. If Left blocked, try ABOVE: x = trigger.x, y = trigger.y - nodeSize.height - gap.
 *  7. If all four directions blocked, return a fallback placement far right
 *     (x = trigger.x + trigger.width + gap + triggerNode.width, y = trigger.y)
 *     to guarantee `count` placements are always returned.
 *
 * Accepts a `nodeSizes` array so heterogeneous node types (text, code, mermaid,
 * image) can each use their correct dimensions. If `nodeSizes` is shorter than
 * `count`, the last size is reused; if empty, a default 300x200 is used.
 *
 * The trigger node is automatically excluded from the collision set (matches
 * prior orbital behavior — generated nodes are allowed to sit within the
 * trigger's gap ring because they are intentionally placed there).
 *
 * @param triggerNode - The node to align against
 * @param count - Number of placements to compute
 * @param nodeSizes - Per-node dimensions (length may differ from count)
 * @param existingNodes - All existing canvas nodes (trigger filtered out automatically)
 * @param gap - Gap in pixels (default from DEFAULT_SPATIAL_CONFIG.placementGap)
 * @returns Array of exactly `count` PlacementCoordinate items
 */
export function computeEdgeAlignedPlacements(
  triggerNode: CanvasNodeInfo,
  count: number,
  nodeSizes: Array<{ width: number; height: number }>,
  existingNodes: CanvasNodeInfo[],
  gap: number = DEFAULT_SPATIAL_CONFIG.placementGap
): PlacementCoordinate[] {
  if (count <= 0) return [];

  const placements: PlacementCoordinate[] = [];
  const fallbackSize = { width: 300, height: 200 };

  // Exclude trigger from collision set (per legacy orbital pattern)
  const existingBoxes: BoundingBox[] = existingNodes
    .filter((n) => n.id !== triggerNode.id)
    .map((n) => ({ x: n.x, y: n.y, width: n.width, height: n.height }));

  const resolveSize = (i: number) =>
    nodeSizes[i] ?? nodeSizes[nodeSizes.length - 1] ?? fallbackSize;

  for (let i = 0; i < count; i++) {
    const size = resolveSize(i);

    // All boxes to check collision against: existing + already-placed peers
    const allBoxes: BoundingBox[] = [
      ...existingBoxes,
      ...placements.map((p) => ({
        x: p.x,
        y: p.y,
        width: p.width,
        height: p.height,
      })),
    ];

    const placement = findEdgeAlignedSlot(triggerNode, size, allBoxes, gap, placements);
    placements.push(placement);
  }

  return placements;
}

/**
 * Find an edge-aligned slot for a single placement.
 * Tries: Right (stack below previous peer) -> slide down -> Below -> Left -> Above -> fallback.
 */
function findEdgeAlignedSlot(
  triggerNode: CanvasNodeInfo,
  size: { width: number; height: number },
  obstacles: BoundingBox[],
  gap: number,
  priorPlacements: PlacementCoordinate[]
): PlacementCoordinate {
  // Start y: if there are prior placements, stack below the last one; else top-align with trigger
  const rightX = triggerNode.x + triggerNode.width + gap;
  const lastPeer = priorPlacements[priorPlacements.length - 1];
  const stackStartY = lastPeer ? lastPeer.y + lastPeer.height + gap : triggerNode.y;

  // 1. Try stacked position in the right column
  const primary: BoundingBox = {
    x: rightX,
    y: stackStartY,
    width: size.width,
    height: size.height,
  };
  if (!checkCollision(primary, obstacles, gap)) {
    return { ...primary };
  }

  // 2. Slide DOWN within the right column (Pitfall 6)
  const slideCeiling =
    triggerNode.y + Math.max(triggerNode.height * 10, 2000);
  let slideY = stackStartY + gap;
  while (slideY <= slideCeiling) {
    const slid: BoundingBox = {
      x: rightX,
      y: slideY,
      width: size.width,
      height: size.height,
    };
    if (!checkCollision(slid, obstacles, gap)) {
      return { ...slid };
    }
    slideY += gap;
  }

  // When falling through to Below/Left/Above, exclude obstacles that live
  // entirely in the right column (x >= trigger.x + trigger.width + gap).
  // Those were already exhausted by slide-down, and re-counting them here
  // would spuriously block fallbacks whose candidate boxes merely clip the
  // right column due to wide node sizes.
  const rightColumnStart = triggerNode.x + triggerNode.width + gap;
  const fallbackObstacles = obstacles.filter(
    (b) => b.x < rightColumnStart
  );

  // 3. Fall back: BELOW trigger
  const belowCandidate: BoundingBox = {
    x: triggerNode.x,
    y: triggerNode.y + triggerNode.height + gap,
    width: size.width,
    height: size.height,
  };
  if (!checkCollision(belowCandidate, fallbackObstacles, gap)) {
    return { ...belowCandidate };
  }

  // 4. Fall back: LEFT of trigger
  const leftCandidate: BoundingBox = {
    x: triggerNode.x - size.width - gap,
    y: triggerNode.y,
    width: size.width,
    height: size.height,
  };
  if (!checkCollision(leftCandidate, fallbackObstacles, gap)) {
    return { ...leftCandidate };
  }

  // 5. Fall back: ABOVE trigger
  const aboveCandidate: BoundingBox = {
    x: triggerNode.x,
    y: triggerNode.y - size.height - gap,
    width: size.width,
    height: size.height,
  };
  if (!checkCollision(aboveCandidate, fallbackObstacles, gap)) {
    return { ...aboveCandidate };
  }

  // 6. Last-resort fallback — place far right even if it overlaps; guarantee count is returned
  return {
    x: rightX + triggerNode.width,
    y: triggerNode.y,
    width: size.width,
    height: size.height,
  };
}
