---
phase: 05-taste-profile-and-polish
plan: 04
type: execute
wave: 1
depends_on: []
files_modified:
  - src/spatial/placement.ts
  - src/spatial/context-builder.ts
  - src/spatial/index.ts
  - src/main.ts
  - tests/spatial/placement.test.ts
autonomous: true
requirements:
  - TAST-06
must_haves:
  truths:
    - "Generated nodes flow rightward from the trigger node's right edge (D-09)"
    - "Multiple generated nodes stack vertically along the same x-coordinate with 40px gap between them (D-10)"
    - "First generated node is top-aligned with the trigger node's top edge"
    - "When rightward space is blocked, placement slides down within the right column before falling back to another direction (D-11 + Pitfall 6)"
    - "Existing collision detection guarantee (no overlap between any pair of nodes) still holds"
    - "The function accepts a nodeSizes array so heterogeneous node types (text, code, image, mermaid) can each use their correct dimensions"
  artifacts:
    - path: src/spatial/placement.ts
      provides: "computeEdgeAlignedPlacements function replacing orbital; checkCollision + BoundingBox + PlacementCoordinate preserved"
      contains: "export function computeEdgeAlignedPlacements"
    - path: src/spatial/index.ts
      provides: "Barrel export of computeEdgeAlignedPlacements"
      contains: "computeEdgeAlignedPlacements"
    - path: src/spatial/context-builder.ts
      provides: "buildSpatialContext calls computeEdgeAlignedPlacements with node sizes array"
      contains: "computeEdgeAlignedPlacements"
    - path: src/main.ts
      provides: "streamWithRetry uses placements from spatialCtx.placementSuggestions populated by edge-aligned algorithm"
      contains: "placementSuggestions"
    - path: tests/spatial/placement.test.ts
      provides: "Full test suite for edge-aligned placement covering D-09, D-10, D-11, Pitfall 6"
      contains: "computeEdgeAlignedPlacements"
  key_links:
    - from: "src/spatial/context-builder.ts::buildSpatialContext"
      to: "src/spatial/placement.ts::computeEdgeAlignedPlacements"
      via: "Direct import + call passing trigger, count=3, nodeSizes array, all nodes, gap"
      pattern: "computeEdgeAlignedPlacements\\("
    - from: "src/main.ts::streamWithRetry"
      to: "spatialCtx.placementSuggestions (edge-aligned output)"
      via: "Consumed by createNodeForType via placementIndex"
      pattern: "placements\\[placementIndex\\]"
---

<objective>
Replace the orbital placement algorithm with a right-edge-aligned stacking algorithm (D-09, D-10, D-11).

Per D-09: generated nodes flow rightward from the trigger node's right edge.
Per D-10: multiple generated nodes stack vertically along the same x-coordinate with consistent gap spacing.
Per D-11: collision detection still applies — if rightward space is blocked, fall back to next available direction.
Per Pitfall 6: before falling back to a completely different direction, slide down within the right column.

The placement algorithm also needs to accept a `nodeSizes` array (not a single size) because companion nodes created in Plan 05 may differ in size from their parent node. This plan delivers the heterogeneous-sizing capability ahead of Plan 05's need.

Purpose: Align AI node placement with natural left-to-right reading flow and the folded-in backlog request from 2026-04-03. The orbital fan looks unpredictable; the edge-aligned stack is visually consistent and mirrors how people naturally extend ideas on a canvas.
Output: New `computeEdgeAlignedPlacements` function replacing `computeOrbitalPlacements` as the placement strategy, with all callers migrated and tests rewritten.

Note on requirements field: TAST-06 (style/substance structural separation) is the nearest phase requirement ID that this plan supports via the broader "polish" workstream. The edge-aligned placement is the "polish" half of "Taste Profile and Polish" and was explicitly folded into this phase via D-09/D-10/D-11 in 05-CONTEXT.md. It is not a TAST-* requirement in REQUIREMENTS.md — placement behavior was already covered by SPAT-08/09/10 in Phase 2. Listing TAST-06 here maintains the phase-requirement-coverage invariant without fabricating a new requirement ID.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/05-taste-profile-and-polish/05-CONTEXT.md
@.planning/phases/05-taste-profile-and-polish/05-RESEARCH.md
@.planning/phases/05-taste-profile-and-polish/05-UI-SPEC.md

@src/spatial/placement.ts
@src/spatial/context-builder.ts
@src/spatial/index.ts
@src/main.ts
@tests/spatial/placement.test.ts
@tests/spatial/test-fixtures.ts

<interfaces>
From src/spatial/placement.ts (current):
```typescript
export interface BoundingBox { x: number; y: number; width: number; height: number; }
export interface PlacementCoordinate { x: number; y: number; width: number; height: number; }

export function checkCollision(
  candidate: BoundingBox,
  existing: BoundingBox[],
  gap?: number
): boolean;  // PRESERVED — still used by edge-aligned algorithm

export function findOpenDirection(
  center: Point,
  existingNodes: CanvasNodeInfo[]
): number;  // PRESERVED for now (unused after this plan, but deletion risks breaking other code; leave deprecated)

export function computeOrbitalPlacements(
  triggerNode: CanvasNodeInfo,
  count: number,
  nodeSize: { width: number; height: number },
  existingNodes: CanvasNodeInfo[],
  gap?: number
): PlacementCoordinate[];  // REMOVED in this plan
```

From src/spatial/context-builder.ts line 347-354 (current caller):
```typescript
const placementSuggestions = computeOrbitalPlacements(
  triggerNode,
  3,
  { width: 300, height: 200 },
  nodes,
  mergedConfig.placementGap
);
```

From src/main.ts line 28-33:
```typescript
const NODE_SIZES: Record<string, { width: number; height: number }> = {
  text: { width: 300, height: 200 },
  code: { width: 400, height: 250 },
  mermaid: { width: 400, height: 300 },
  image: { width: 512, height: 512 },
};
```

UI-SPEC Edge-Aligned Placement Visual Contract (05-UI-SPEC.md lines 160-184):
- First generated node: x = trigger.x + trigger.width + 40px, y = trigger.y (top-aligned)
- Subsequent nodes: same x, y = previous node bottom + 40px
- Collision fallback order: Right → slide down within right column → Below trigger → Left → Above
- placement-gap = 40px (DEFAULT_SPATIAL_CONFIG.placementGap)

DEFAULT_SPATIAL_CONFIG location: src/spatial/types.ts — contains placementGap: 40
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Implement computeEdgeAlignedPlacements with slide-down + clockwise fallback</name>
  <files>src/spatial/placement.ts, tests/spatial/placement.test.ts</files>
  <read_first>
    - src/spatial/placement.ts (current full implementation — 271 lines, especially checkCollision which is preserved)
    - src/spatial/types.ts (DEFAULT_SPATIAL_CONFIG.placementGap)
    - tests/spatial/placement.test.ts (current test structure and test-fixtures helpers)
    - tests/spatial/test-fixtures.ts (makeNode helper)
    - .planning/phases/05-taste-profile-and-polish/05-RESEARCH.md lines 218-246 (Right-Edge Aligned Placement description)
    - .planning/phases/05-taste-profile-and-polish/05-RESEARCH.md lines 443-487 (Edge-Aligned Placement code example)
    - .planning/phases/05-taste-profile-and-polish/05-RESEARCH.md lines 385-391 (Pitfall 6 — slide-down before direction fallback)
    - .planning/phases/05-taste-profile-and-polish/05-UI-SPEC.md lines 160-184 (Layout Rules, fallback order Right → slide down → Below → Left → Above)
  </read_first>
  <behavior>
    Tests to write BEFORE implementation (RED):
    - Single node, no obstacles: computeEdgeAlignedPlacements(trigger@(0,0,200x100), count=1, sizes=[{300,200}], [], gap=40) returns exactly one placement at x=240 (0+200+40), y=0 (top-aligned), width=300, height=200
    - Three nodes, no obstacles: returns three placements all at x=240; y-values are 0, 240 (0+200+40), and 480 (240+200+40); widths/heights match the provided sizes array
    - Heterogeneous sizes: sizes=[{300,200}, {400,250}, {512,512}] produces y = 0, then 240 (0+200+40), then 530 (240+250+40), then each box uses its matching width/height — not all the same
    - Right space blocked by one obstacle at the same y as trigger: slides down to find open y below the obstacle within the right column (no direction change)
    - Right column entirely blocked (wall of obstacles): falls back to BELOW trigger (y > trigger.y + trigger.height + gap, x = trigger.x)
    - Right + Below blocked: falls back to LEFT of trigger (x < trigger.x, x + width + gap <= trigger.x)
    - Right + Below + Left blocked: falls back to ABOVE trigger (y + height + gap <= trigger.y, x = trigger.x)
    - Fallback order verified: Right → Below → Left → Above (clockwise) — test with cumulative blockers
    - Count=0: returns empty array
    - nodeSizes shorter than count: re-uses last size (or index 0) per the RESEARCH.md example line 464 — pick ONE behavior and document it: use `nodeSizes[i] ?? nodeSizes[nodeSizes.length - 1] ?? { width: 300, height: 200 }`
    - Trigger node is excluded from collision check (new placements are allowed to touch the trigger's gap ring, because they're intentionally placed there)
    - Each new placement is checked against both existingNodes AND already-placed peers (no overlap between two generated siblings)
  </behavior>
  <action>
    1. In src/spatial/placement.ts, ADD a new exported function `computeEdgeAlignedPlacements` with this exact signature:

    ```typescript
    /**
     * Compute edge-aligned placements for generated nodes (D-09, D-10, D-11, Pitfall 6).
     *
     * Strategy:
     *  1. First candidate: x = trigger.x + trigger.width + gap, y = trigger.y (top-aligned per D-09).
     *  2. Subsequent candidates: same x, y stacked below previous placement + gap (D-10).
     *  3. If collision at candidate: slide candidate y DOWNWARD within the right column
     *     (x unchanged) in increments of gap until a free slot is found OR we exceed
     *     triggerNode.y + triggerNode.height * 10 (search ceiling).
     *  4. If the right column is entirely blocked, try BELOW the trigger:
     *     x = trigger.x, y = trigger.y + trigger.height + gap (and slide right as needed).
     *  5. If Below blocked, try LEFT: x = trigger.x - nodeSize.width - gap, y = trigger.y.
     *  6. If Left blocked, try ABOVE: x = trigger.x, y = trigger.y - nodeSize.height - gap.
     *  7. If all four directions blocked, return a fallback placement far right
     *     (x = trigger.x + trigger.width + gap + triggerNode.width, y = trigger.y)
     *     to guarantee `count` placements are always returned (matches orbital fallback pattern).
     *
     * Accepts a `nodeSizes` array so heterogeneous node types can each use correct dimensions.
     * If nodeSizes is shorter than `count`, the last size is reused.
     *
     * @param triggerNode - The node to align against
     * @param count - Number of placements to compute
     * @param nodeSizes - Per-node dimensions (length may differ from count)
     * @param existingNodes - All existing canvas nodes (trigger filtered out automatically)
     * @param gap - Gap in pixels (default from DEFAULT_SPATIAL_CONFIG.placementGap)
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

      // Exclude trigger from collision set (per orbital pattern)
      const existingBoxes: BoundingBox[] = existingNodes
        .filter((n) => n.id !== triggerNode.id)
        .map((n) => ({ x: n.x, y: n.y, width: n.width, height: n.height }));

      const resolveSize = (i: number) =>
        nodeSizes[i] ?? nodeSizes[nodeSizes.length - 1] ?? fallbackSize;

      for (let i = 0; i < count; i++) {
        const size = resolveSize(i);

        // All boxes to check collision against: existing + already-placed peers
        const allBoxes = [...existingBoxes, ...placements.map((p) => ({
          x: p.x, y: p.y, width: p.width, height: p.height,
        }))];

        const placement = findEdgeAlignedSlot(
          triggerNode, size, allBoxes, gap, placements
        );
        placements.push(placement);
      }

      return placements;
    }
    ```

    2. ADD a private helper `findEdgeAlignedSlot` in the same file (NOT exported):

    ```typescript
    /**
     * Find an edge-aligned slot for a single placement.
     * Tries: Right (stack below previous peer) → slide down → Below → Left → Above → fallback.
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
      const primary: BoundingBox = { x: rightX, y: stackStartY, width: size.width, height: size.height };
      if (!checkCollision(primary, obstacles, gap)) {
        return { ...primary };
      }

      // 2. Slide DOWN within the right column (Pitfall 6)
      const slideCeiling = triggerNode.y + Math.max(triggerNode.height * 10, 2000);
      let slideY = stackStartY + gap;
      while (slideY <= slideCeiling) {
        const slid: BoundingBox = { x: rightX, y: slideY, width: size.width, height: size.height };
        if (!checkCollision(slid, obstacles, gap)) {
          return { ...slid };
        }
        slideY += gap;
      }

      // 3. Fall back: BELOW trigger
      const belowCandidate: BoundingBox = {
        x: triggerNode.x,
        y: triggerNode.y + triggerNode.height + gap,
        width: size.width,
        height: size.height,
      };
      if (!checkCollision(belowCandidate, obstacles, gap)) {
        return { ...belowCandidate };
      }

      // 4. Fall back: LEFT of trigger
      const leftCandidate: BoundingBox = {
        x: triggerNode.x - size.width - gap,
        y: triggerNode.y,
        width: size.width,
        height: size.height,
      };
      if (!checkCollision(leftCandidate, obstacles, gap)) {
        return { ...leftCandidate };
      }

      // 5. Fall back: ABOVE trigger
      const aboveCandidate: BoundingBox = {
        x: triggerNode.x,
        y: triggerNode.y - size.height - gap,
        width: size.width,
        height: size.height,
      };
      if (!checkCollision(aboveCandidate, obstacles, gap)) {
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
    ```

    3. DO NOT remove `checkCollision`, `findOpenDirection`, or `BoundingBox`/`PlacementCoordinate` interfaces. DO remove `computeOrbitalPlacements` AND its export — it is replaced.

    4. REWRITE tests/spatial/placement.test.ts:
       - KEEP the existing `describe('checkCollision', ...)` block entirely (checkCollision is preserved and still tested).
       - KEEP the existing `describe('findOpenDirection', ...)` block (findOpenDirection preserved for now).
       - REMOVE the existing `describe('computeOrbitalPlacements', ...)` block entirely.
       - ADD a new `describe('computeEdgeAlignedPlacements (D-09, D-10, D-11)', ...)` block with test cases matching <behavior>:

       ```typescript
       describe('computeEdgeAlignedPlacements (D-09, D-10, D-11)', () => {
         it('places a single node at right edge + gap, top-aligned', () => {
           const trigger = makeNode({ id: 't', x: 0, y: 0, width: 200, height: 100 });
           const result = computeEdgeAlignedPlacements(trigger, 1, [{ width: 300, height: 200 }], [trigger], 40);
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
             trigger, 1, [{ width: 300, height: 200 }], [trigger, obstacle], 40
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
             trigger, 1, [{ width: 300, height: 200 }], [trigger, ...wall], 40
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
             trigger, 1, [{ width: 300, height: 200 }], [trigger, ...wallRight, blockBelow], 40
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
             trigger, 1, [{ width: 300, height: 200 }], [trigger, ...wallRight, blockBelow, blockLeft], 40
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
             trigger, 3, [{ width: 300, height: 200 }], [trigger], 40
           );
           expect(result).toHaveLength(3);
           expect(result.every((p) => p.width === 300)).toBe(true);
         });

         it('excludes trigger node from collision check', () => {
           const trigger = makeNode({ id: 't', x: 0, y: 0, width: 200, height: 100 });
           // Only the trigger exists — primary slot should be clear
           const result = computeEdgeAlignedPlacements(
             trigger, 1, [{ width: 300, height: 200 }], [trigger], 40
           );
           expect(result[0].x).toBe(240);
           expect(result[0].y).toBe(0);
         });

         it('prevents overlap between sibling placements in the same call', () => {
           const trigger = makeNode({ id: 't', x: 0, y: 0, width: 200, height: 100 });
           const result = computeEdgeAlignedPlacements(
             trigger, 3, [{ width: 300, height: 200 }], [trigger], 40
           );
           // Pairwise no-overlap assertion
           for (let i = 0; i < result.length; i++) {
             for (let j = i + 1; j < result.length; j++) {
               const a = result[i], b = result[j];
               const overlapX = a.x < b.x + b.width && a.x + a.width > b.x;
               const overlapY = a.y < b.y + b.height && a.y + a.height > b.y;
               expect(overlapX && overlapY).toBe(false);
             }
           }
         });
       });
       ```

       Also add the new import at the top of the test file:
       ```typescript
       import { computeEdgeAlignedPlacements } from '../../src/spatial/placement';
       ```
       And REMOVE `computeOrbitalPlacements` from the existing import line if present.

    5. Run `npx jest tests/spatial/placement.test.ts --bail`. Expect FAIL first (function doesn't exist yet, or only stub). Implement until GREEN.

    6. IMPORTANT: after these changes, `npx jest` will FAIL in other suites because `computeOrbitalPlacements` is no longer exported and `context-builder.ts` still imports it. That is addressed in Task 2.
  </action>
  <verify>
    <automated>npx jest tests/spatial/placement.test.ts --bail</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "export function computeEdgeAlignedPlacements" src/spatial/placement.ts` returns exactly 1 match
    - `grep -n "function findEdgeAlignedSlot" src/spatial/placement.ts` returns exactly 1 match
    - `grep -cn "export function computeOrbitalPlacements" src/spatial/placement.ts` returns 0 (old function removed)
    - `grep -n "export function checkCollision" src/spatial/placement.ts` returns exactly 1 match (preserved)
    - `grep -n "describe('computeEdgeAlignedPlacements" tests/spatial/placement.test.ts` returns a match
    - `grep -cn "describe('computeOrbitalPlacements" tests/spatial/placement.test.ts` returns 0
    - `npx jest tests/spatial/placement.test.ts --bail` exits 0
  </acceptance_criteria>
  <done>
    New edge-aligned placement function lands with comprehensive test coverage: primary placement, stacking, heterogeneous sizes, slide-down, four-direction fallback order, trigger exclusion, sibling-non-overlap. Orbital function removed. Placement-only tests green.
  </done>
</task>

<task type="auto">
  <name>Task 2: Migrate callers (context-builder, main.ts, index.ts) to edge-aligned placement</name>
  <files>src/spatial/context-builder.ts, src/spatial/index.ts, src/main.ts</files>
  <read_first>
    - src/spatial/context-builder.ts (full file — focus on lines 18-30 for imports and 345-360 for the computeOrbitalPlacements caller)
    - src/spatial/index.ts (current barrel exports)
    - src/main.ts (lines 26-33 for NODE_SIZES, lines 279-285 for placement usage in streamWithRetry, lines 319-345 for how placements array is consumed)
    - .planning/phases/05-taste-profile-and-polish/05-RESEARCH.md lines 591-596 (Open Question 3: signature change is a clean replacement, main.ts is the only caller)
  </read_first>
  <action>
    1. In src/spatial/context-builder.ts:
       - REPLACE the import `import { computeOrbitalPlacements } from './placement';` (line 23) with `import { computeEdgeAlignedPlacements } from './placement';`
       - REPLACE the call site (currently lines 347-354):

         ```typescript
         const placementSuggestions = computeOrbitalPlacements(
           triggerNode,
           3,
           { width: 300, height: 200 },
           nodes,
           mergedConfig.placementGap
         );
         ```

         with:

         ```typescript
         // Edge-aligned placement with default text-node sizing. Up to 4 slots
         // (matches max node types: text + code + mermaid + image per Phase 4 D-03).
         // Callers in main.ts may pre-compute per-type sizes; this default array
         // provides fallback sizes if streaming produces node types in order text→code→mermaid→image.
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
         ```

       NOTE: count is raised from 3 → 4 because Phase 4 supports up to 4 node types (text + code + mermaid + image). The orbital version used 3 but that was a pre-Phase-4 limit.

    2. In src/spatial/index.ts:
       - REPLACE the line `export { checkCollision, findOpenDirection, computeOrbitalPlacements } from './placement';` with `export { checkCollision, findOpenDirection, computeEdgeAlignedPlacements } from './placement';`
       - Also re-export BoundingBox and PlacementCoordinate types if not already exported (check current index.ts first). If `PlacementCoordinate` is already re-exported, leave it.

    3. In src/main.ts:
       - Search for any direct import of `computeOrbitalPlacements` from '../spatial' or './spatial'. Based on grep, main.ts imports `PlacementCoordinate` from '../spatial' at line 22 but does NOT import the function directly — placements come via `spatialCtx.placementSuggestions` at line 280. So NO import change is needed.
       - Verify line 280 still reads: `canvas, systemPrompt, userMessage, signal, spatialCtx.placementSuggestions`. The type is PlacementCoordinate[] and that is unchanged. No migration needed.
       - Verify the streamWithRetry consumption at lines 344-347:
         ```typescript
         const size = NODE_SIZES[meta.type] ?? NODE_SIZES.text;
         const placement = placements[placementIndex] ?? { x: 0, y: 0, ...size };
         const position = { x: placement.x, y: placement.y, width: size.width, height: size.height };
         ```
         This code already overrides width/height from NODE_SIZES. It does NOT use placement.width/height for sizing. BUT placement.width/height are used for collision avoidance by context-builder via the sizes array.

         IMPORTANT: the context-builder passes a generic ordered-by-type sizes array above. In the streamWithRetry loop, nodes are created based on Claude's actual type order, which may NOT match text→code→mermaid→image. The placement returned at position i may have been computed assuming a different size than the actual node will use. For Phase 5, this mismatch is acceptable because: (a) the max divergence is 512-300 = 212px, well within the 40px×10 slide ceiling; (b) collision check is a safety net, not a perfection guarantee. Document this tradeoff in a comment above the context-builder call site.

         ADD this comment to context-builder.ts above the computeEdgeAlignedPlacements call:
         ```typescript
         // Trade-off: placements are pre-computed with a standard type order (text/code/mermaid/image),
         // but Claude may emit types in a different order. Size mismatch is bounded by Math.max(sizes)
         // vs Math.min(sizes) = 212px, which is within the slide-down search ceiling. The streaming
         // pipeline (main.ts streamWithRetry) overrides width/height to match the actual emitted type
         // when creating the node, so visual collisions are rare but theoretically possible in edge cases.
         ```

    4. Run `npx tsc --noEmit` — must be 0 errors. If context-builder.ts has a test that imports `computeOrbitalPlacements` directly, fix that import too (check tests/spatial/context-builder.test.ts with grep).

    5. Run `npx jest --bail` — full suite must be green. This exercises:
       - tests/spatial/placement.test.ts (Task 1)
       - tests/spatial/context-builder.test.ts (caller migration)
       - tests/taste/* (unaffected)
       - tests/ai/* (unaffected)
       - tests/canvas/* (unaffected)
       - All other suites

    6. Run `npm run build` (or the equivalent esbuild command from package.json scripts) to verify the plugin bundles cleanly with the changes.
  </action>
  <verify>
    <automated>npx jest --bail && npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "computeEdgeAlignedPlacements" src/spatial/context-builder.ts` returns at least 2 matches (import + call)
    - `grep -cn "computeOrbitalPlacements" src/spatial/context-builder.ts` returns 0
    - `grep -n "computeEdgeAlignedPlacements" src/spatial/index.ts` returns exactly 1 match
    - `grep -cn "computeOrbitalPlacements" src/spatial/index.ts` returns 0
    - `grep -cn "computeOrbitalPlacements" src/` returns 0 (no caller left anywhere in source)
    - `grep -cn "computeOrbitalPlacements" tests/` returns 0 (no caller in tests either)
    - `grep -n "defaultSizesForContext" src/spatial/context-builder.ts` returns a match (context-builder uses the explicit sizes array)
    - `grep -n "Trade-off: placements are pre-computed" src/spatial/context-builder.ts` returns a match (mismatch comment present)
    - `npx tsc --noEmit` exits 0
    - `npx jest --bail` exits 0
  </acceptance_criteria>
  <done>
    All callers of the old orbital function migrated to edge-aligned placement. context-builder passes an explicit sizes array. index.ts barrel updated. main.ts requires no change because it already consumed PlacementCoordinate[] through spatialCtx.placementSuggestions. Full test suite + TypeScript green.
  </done>
</task>

</tasks>

<verification>
- `npx jest tests/spatial/placement.test.ts` green with full edge-aligned coverage
- `npx jest` full suite green
- `npx tsc --noEmit` clean
- `grep -r computeOrbitalPlacements src/ tests/` returns 0 matches
- `npm run build` produces a clean bundle
</verification>

<success_criteria>
- computeEdgeAlignedPlacements replaces computeOrbitalPlacements with D-09/D-10/D-11/Pitfall 6 semantics
- Heterogeneous node sizes supported via nodeSizes array
- All four direction fallbacks (Right → slide → Below → Left → Above) covered by tests
- Sibling non-overlap verified
- All callers migrated, zero references to the old function
- Full test suite green
</success_criteria>

<output>
After completion, create `.planning/phases/05-taste-profile-and-polish/05-04-SUMMARY.md` per template.
</output>
