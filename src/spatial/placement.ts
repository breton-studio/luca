/**
 * Collision-free orbital placement with directional scanning.
 *
 * Computes where to place generated nodes around the trigger node (D-09)
 * without overlapping existing nodes, maintaining comfortable gaps (D-11),
 * fanning multiple nodes into the direction with most open space (D-10),
 * and scanning outward when space is blocked (D-12).
 *
 * All coordinates are in canvas space, not viewport space (Pitfall 7).
 * Maximum search radius is bounded to prevent infinite loops (Pitfall 3).
 *
 * Pure math -- no Obsidian imports.
 */

import type { CanvasNodeInfo } from '../types/canvas';
import type { Point } from './types';
import { DEFAULT_SPATIAL_CONFIG } from './types';
import { computeCenter, euclideanDistance } from './proximity';

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
 * Compute collision-free orbital placements around a trigger node.
 *
 * Per D-09: generated nodes orbit the most recently edited node.
 * Per D-10: multiple nodes fan out in the direction with most open space.
 * Per D-11: gap of 40px maintained between all nodes.
 * Per D-12: if space is blocked, scan outward by gap increments.
 * Per Pitfall 3: max search radius = starting * maxSearchRadius (default 5).
 * Per Pitfall 7: all coordinates in canvas space.
 *
 * @param triggerNode - The most recently edited node (orbit center)
 * @param count - Number of placements to compute
 * @param nodeSize - Dimensions of the nodes being placed
 * @param existingNodes - All existing canvas nodes
 * @param gap - Gap in pixels between nodes (default from config)
 * @returns Array of exactly `count` PlacementCoordinate items
 */
export function computeOrbitalPlacements(
  triggerNode: CanvasNodeInfo,
  count: number,
  nodeSize: { width: number; height: number },
  existingNodes: CanvasNodeInfo[],
  gap: number = DEFAULT_SPATIAL_CONFIG.placementGap
): PlacementCoordinate[] {
  const triggerCenter = computeCenter(triggerNode);

  // Starting radius: distance from trigger center to edge + gap + half node width
  const startingRadius =
    Math.max(triggerNode.width, triggerNode.height) / 2 +
    gap +
    Math.max(nodeSize.width, nodeSize.height) / 2;

  // Max search radius bounded per Pitfall 3
  const maxRadius = startingRadius * DEFAULT_SPATIAL_CONFIG.maxSearchRadius;

  // Find the best direction to place nodes
  // Exclude the trigger node itself from direction finding
  const otherNodes = existingNodes.filter((n) => n.id !== triggerNode.id);
  const bestAngle = findOpenDirection(triggerCenter, otherNodes);

  // Build existing bounding boxes (exclude trigger from collision checking)
  const existingBoxes: BoundingBox[] = otherNodes.map((n) => ({
    x: n.x,
    y: n.y,
    width: n.width,
    height: n.height,
  }));

  // Spread count nodes across a 60-degree arc centered on the best angle
  const arcSpread = Math.PI / 3; // 60 degrees
  const placements: PlacementCoordinate[] = [];

  for (let i = 0; i < count; i++) {
    // Compute the angle for this placement within the arc
    let placementAngle: number;
    if (count === 1) {
      placementAngle = bestAngle;
    } else {
      // Spread evenly across the arc
      const step = arcSpread / (count - 1);
      placementAngle = bestAngle - arcSpread / 2 + step * i;
    }

    // Try placing at increasing radii until no collision
    let placed = false;
    let radius = startingRadius;

    while (radius <= maxRadius) {
      const candidateX =
        triggerCenter.x + Math.cos(placementAngle) * radius - nodeSize.width / 2;
      const candidateY =
        triggerCenter.y + Math.sin(placementAngle) * radius - nodeSize.height / 2;

      const candidate: BoundingBox = {
        x: candidateX,
        y: candidateY,
        width: nodeSize.width,
        height: nodeSize.height,
      };

      // Also check against already-placed nodes
      const allBoxes = [
        ...existingBoxes,
        ...placements.map((p) => ({
          x: p.x,
          y: p.y,
          width: p.width,
          height: p.height,
        })),
      ];

      if (!checkCollision(candidate, allBoxes, gap)) {
        placements.push({
          x: candidateX,
          y: candidateY,
          width: nodeSize.width,
          height: nodeSize.height,
        });
        placed = true;
        break;
      }

      // Step outward by gap increment
      radius += gap;
    }

    // Fallback: place at max radius in this direction (D-12 fallback)
    if (!placed) {
      const fallbackX =
        triggerCenter.x +
        Math.cos(placementAngle) * maxRadius -
        nodeSize.width / 2;
      const fallbackY =
        triggerCenter.y +
        Math.sin(placementAngle) * maxRadius -
        nodeSize.height / 2;
      placements.push({
        x: fallbackX,
        y: fallbackY,
        width: nodeSize.width,
        height: nodeSize.height,
      });
    }
  }

  return placements;
}
