# Phase 2: Spatial Intelligence - Research

**Researched:** 2026-04-02
**Domain:** Computational geometry, 2D spatial analysis, density-based clustering, collision-free placement
**Confidence:** HIGH

## Summary

Phase 2 is a pure computational geometry phase -- no external APIs, no UI, no network calls. The inputs are `CanvasNodeInfo[]` (with x, y, width, height) and canvas edge data. The outputs are proximity scores, cluster assignments, a focus cluster, placement coordinates, and a structured narrative string for the LLM prompt.

The core algorithms (Euclidean distance, DBSCAN clustering, bounding-box collision detection, directional placement) are well-understood, small in code footprint, and specific enough to our use case that hand-rolling them is the right choice over adding external dependencies. DBSCAN in particular is ~60 lines for 2D Euclidean points, and our adaptive epsilon requirement (D-01) means no off-the-shelf library would work without modification anyway.

**Primary recommendation:** Implement all spatial analysis as pure functions in a `src/spatial/` module with no external dependencies beyond the existing project stack. Use Jest for thorough unit testing since every function is deterministic and easily testable without mocking Obsidian APIs.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Adaptive proximity thresholds based on canvas density -- sparse canvases use larger "near" radius, dense canvases use tighter radius
- D-02: Continuous relevance score (0.0-1.0) between node pairs, not discrete buckets (near/medium/far)
- D-03: Canvas edge connections boost relevance score regardless of distance -- honors explicit user connections
- D-04: Always compute proximity even with few nodes (1-3) -- consistent behavior regardless of canvas size
- D-05: Density-based clustering (DBSCAN-style) for finding node groups
- D-06: Conservative sensitivity -- fewer, larger clusters. A workspace area with 5-10 nodes forms one cluster
- D-07: Isolated nodes flagged as outliers, not treated as clusters of one -- they're lone ideas, not focus areas
- D-08: Primary focus cluster identified -- the cluster nearest to the most recent edit gets special status as the active focus area
- D-09: Generated nodes orbit the most recently edited node -- tightest coupling to user's current action
- D-10: Multiple generated nodes fan out in available direction -- detect which direction has open space and spread nodes there
- D-11: Comfortable gap (~30-50px) between generated and existing nodes -- visually distinct but spatially associated
- D-12: When no nearby space exists, place further out in best direction -- scan outward until clear space is found, never overlap
- D-13: Structured narrative format for Claude -- natural language with structure describing clusters, relationships, and spatial positions
- D-14: Send focus cluster + nearby nodes to Claude (nodes above a relevance score threshold) -- balance of context and cost
- D-15: Include spatial directions in narration (e.g., "to the left", "above the cluster") -- helps Claude understand the 2D space
- D-16: Outlier nodes briefly mentioned as peripheral context -- gives Claude full canvas awareness without over-weighting distant ideas

### Claude's Discretion
- Exact DBSCAN epsilon/minPoints parameter tuning
- Specific relevance score threshold for filtering (e.g., 0.3 vs 0.5 cutoff)
- Edge connection boost magnitude (how much edges increase relevance)
- Exact structured narrative template wording
- Adaptive density algorithm specifics (mean distance, percentile-based, etc.)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SPAT-01 | Plugin reads all node positions, dimensions, and content from active canvas | CanvasAdapter.getNodesFromCanvas() already returns CanvasNodeInfo[]. Need to also read edges from canvas.edges Map. |
| SPAT-02 | Proximity graph computed from node positions (Euclidean distance between centers) | Pure math: distance between (x+w/2, y+h/2) pairs. Node x,y is top-left corner per canvas spec. |
| SPAT-03 | Nearby nodes interpreted as conceptually related (proximity-as-semantics) | Relevance score 0.0-1.0 inversely proportional to distance, with adaptive threshold from D-01. |
| SPAT-04 | Distant nodes interpreted as weakly related or tangential | Same relevance score -- distant nodes naturally score near 0.0. |
| SPAT-05 | Dense node clusters detected as focus areas (density-based analysis) | DBSCAN-style clustering with adaptive epsilon. Conservative sensitivity per D-06. |
| SPAT-06 | Spatial context serialized into structured narrative for LLM prompt | Template-based narrative generator producing natural language with spatial relationships. |
| SPAT-07 | Only nearby/relevant nodes sent to Claude (above relevance score threshold) | Filter function using relevance scores. Threshold is Claude's discretion (~0.3 recommended). |
| SPAT-08 | Generated nodes placed in contextually appropriate positions | Orbital placement around most recently edited node per D-09, with directional awareness. |
| SPAT-09 | Collision-free placement using bounding-box detection | AABB overlap check against all existing nodes, with gap padding per D-11. |
| SPAT-10 | Placement accounts for canvas zoom and pan offsets | Canvas internal API exposes canvas.x, canvas.y, canvas.zoom for viewport state. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Language:** TypeScript ^5.5, strict mode
- **Build:** esbuild -- no webpack/vite/rollup
- **Platform:** Obsidian plugin (Electron environment)
- **Canvas types:** obsidian-typings ^5.17.0 for internal API types
- **Testing:** Jest with ts-jest (already configured)
- **No UI frameworks:** Vanilla DOM only (but Phase 2 has no UI)
- **No unnecessary deps:** Don't add libraries for problems that are small and specific to this use case

## Standard Stack

### Core (Already Installed -- No New Dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | ^5.5 | Language for all spatial modules | Already in project, strict mode enabled |
| Jest + ts-jest | ^29 | Unit testing spatial functions | Already configured, pure functions are ideal for unit tests |
| obsidian-typings | 5.17.0 | Canvas edge type definitions | Need CanvasViewCanvasEdge types for reading edge connections |

### New Dependencies Required
None. Phase 2 is pure computational geometry -- all algorithms are hand-rolled.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled DBSCAN | density-clustering npm | Library is 1.3.0, no TypeScript types, no adaptive epsilon support. DBSCAN is ~60 lines for 2D Euclidean. Hand-rolling is correct. |
| Hand-rolled DBSCAN | ml-dbscan npm | Similar issue -- fixed epsilon, adds dependency for trivial code. |
| Hand-rolled distance calc | turf.js | Massive GIS library (~200KB). We need one function: Euclidean distance. |
| Hand-rolled AABB collision | No viable alternative | AABB overlap is 4 comparisons. No library needed. |

## Architecture Patterns

### Recommended Project Structure
```
src/
  spatial/
    proximity.ts          # Distance calculations, relevance scores, proximity graph
    clustering.ts         # DBSCAN implementation, cluster detection, focus cluster selection
    placement.ts          # Collision-free placement, orbital positioning, directional scan
    context-builder.ts    # Narrative serialization for LLM prompt, node filtering
    types.ts              # All spatial type definitions (interfaces, enums)
    index.ts              # Public API barrel export
  canvas/
    canvas-adapter.ts     # (existing) -- needs edge reading added
    ...
  types/
    canvas.ts             # (existing) -- needs CanvasEdgeInfo and CanvasSnapshot.edges added
    ...
tests/
  spatial/
    proximity.test.ts     # Distance, relevance score, adaptive threshold tests
    clustering.test.ts    # DBSCAN, focus cluster, outlier detection tests
    placement.test.ts     # Collision detection, orbital placement, gap tests
    context-builder.test.ts  # Narrative output, filtering, serialization tests
```

### Pattern 1: Pure Functions with Typed Inputs/Outputs
**What:** Every spatial function takes typed data structures and returns typed results. No side effects, no Obsidian API calls.
**When to use:** Every function in the spatial module.
**Example:**
```typescript
// proximity.ts
export interface ProximityPair {
  nodeA: string;  // node ID
  nodeB: string;  // node ID
  distance: number;
  relevance: number;  // 0.0-1.0
}

export function computeCenter(node: CanvasNodeInfo): { x: number; y: number } {
  return {
    x: node.x + node.width / 2,
    y: node.y + node.height / 2,
  };
}

export function euclideanDistance(
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}
```

### Pattern 2: Adaptive Parameters Derived from Canvas State
**What:** Instead of fixed constants, compute algorithm parameters from the current canvas's actual density and layout.
**When to use:** DBSCAN epsilon, relevance score normalization, placement distance.
**Example:**
```typescript
// Adaptive epsilon for DBSCAN based on mean inter-node distance
export function computeAdaptiveEpsilon(nodes: CanvasNodeInfo[]): number {
  if (nodes.length < 2) return Infinity;
  const distances: number[] = [];
  for (let i = 0; i < nodes.length; i++) {
    let minDist = Infinity;
    for (let j = 0; j < nodes.length; j++) {
      if (i === j) continue;
      const d = euclideanDistance(computeCenter(nodes[i]), computeCenter(nodes[j]));
      if (d < minDist) minDist = d;
    }
    distances.push(minDist);
  }
  // Use median nearest-neighbor distance * multiplier for conservative clustering
  distances.sort((a, b) => a - b);
  const median = distances[Math.floor(distances.length / 2)];
  return median * 2.0;  // Multiplier tuned for "fewer, larger clusters" (D-06)
}
```

### Pattern 3: Builder Pattern for Context Narration
**What:** Build the LLM narrative string incrementally from spatial analysis results.
**When to use:** context-builder.ts assembling the structured narrative.
**Example:**
```typescript
export interface SpatialContext {
  focusCluster: ClusterInfo;
  relevantNodes: RelevantNode[];
  outliers: OutlierNode[];
  narrative: string;
  placementSuggestions: PlacementCoordinate[];
}

export function buildSpatialContext(
  nodes: CanvasNodeInfo[],
  edges: CanvasEdgeInfo[],
  triggerNodeId: string,
  viewportState?: ViewportState
): SpatialContext {
  // 1. Compute proximity graph
  // 2. Run clustering
  // 3. Identify focus cluster
  // 4. Filter relevant nodes
  // 5. Compute placement coordinates
  // 6. Serialize narrative
  // Return complete context
}
```

### Pattern 4: Separation of Analysis and Placement
**What:** Keep spatial analysis (reading the canvas) completely separate from placement (deciding where to put new nodes). They are different responsibilities with different inputs.
**When to use:** Always. Analysis reads existing state; placement computes future positions.

### Anti-Patterns to Avoid
- **Coupling to Obsidian API:** Spatial functions must NOT import from 'obsidian' or call canvas internal methods. They receive `CanvasNodeInfo[]` and return data structures. The adapter translates.
- **Fixed magic numbers:** Don't hardcode pixel thresholds (e.g., "nodes within 200px are near"). Use adaptive thresholds computed from canvas density (D-01).
- **Mutating input arrays:** All spatial functions must be immutable -- never modify the input CanvasNodeInfo[], always return new data structures.
- **Premature optimization with spatial indices:** For canvases with <500 nodes (typical Obsidian use), O(n^2) pairwise distance is fine. Don't add R-trees or quadtrees. The canvas internal API already has spatial indices for its own use.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Canvas node reading | Custom canvas DOM scraping | CanvasAdapter.getNodesFromCanvas() | Already built in Phase 1, handles normalization and fallback |
| Canvas edge reading | Raw file parsing for edges | Extend CanvasAdapter with getEdgesFromCanvas() | Same adapter pattern, accesses canvas.edges Map directly |
| Viewport state | Manual DOM measurement | canvas.x, canvas.y, canvas.zoom properties | Internal API already exposes these via obsidian-typings |
| Node ID generation | Math.random() string | uuid library (already in project stack) | For Phase 3 when actually creating nodes -- not Phase 2's concern |

**Key insight:** Phase 2 SHOULD hand-roll all spatial algorithms (DBSCAN, proximity, placement, collision detection) because they are small (~200 lines total), specific to our coordinate system, and need adaptive behavior no library provides. Phase 2 should NOT hand-roll canvas data access -- that's the adapter's job.

## Common Pitfalls

### Pitfall 1: Top-Left vs Center Coordinate Confusion
**What goes wrong:** Distance calculated between node top-left corners instead of centers, making large nodes appear further apart than they conceptually are.
**Why it happens:** Canvas stores x,y as top-left corner. Easy to forget the conversion.
**How to avoid:** Always use `computeCenter()` for distance calculations. Never use raw `node.x, node.y` for proximity.
**Warning signs:** Two large adjacent nodes showing low relevance despite visually touching.

### Pitfall 2: DBSCAN Epsilon Too Small for Sparse Canvases
**What goes wrong:** Every node classified as an outlier (noise). No clusters formed.
**Why it happens:** Fixed epsilon that works for dense canvases fails for sparse ones where nodes are hundreds of pixels apart.
**How to avoid:** Adaptive epsilon based on median nearest-neighbor distance (D-01). Always verify clustering produces at least one cluster when nodes > minPoints.
**Warning signs:** `clusters.length === 0` with `outliers.length === nodes.length`.

### Pitfall 3: Infinite Placement Search Loop
**What goes wrong:** Placement algorithm searches outward forever when canvas is extremely dense.
**Why it happens:** The "scan outward until clear space" logic (D-12) has no upper bound.
**How to avoid:** Set a maximum search radius (e.g., 5x the canvas bounding box diagonal). If exhausted, place at the max radius in the best direction. Never loop infinitely.
**Warning signs:** Function taking >50ms for a single placement calculation.

### Pitfall 4: Collision Check Ignoring Gap Padding
**What goes wrong:** Generated nodes technically don't overlap but are visually crammed against existing nodes.
**Why it happens:** AABB collision check passes (no pixel overlap) but the 30-50px comfortable gap (D-11) is not enforced.
**How to avoid:** Expand each existing node's bounding box by the gap padding before collision checking. A node at (100, 100, 200, 100) becomes (70, 70, 260, 160) with 30px padding.
**Warning signs:** Generated nodes touching or nearly touching existing nodes.

### Pitfall 5: Edge Data Not Available via Internal API
**What goes wrong:** canvas.edges returns undefined or empty Map when edges exist visually.
**Why it happens:** Internal API access to edges is undocumented and may behave differently than nodes. The canvas might lazy-load edge data.
**How to avoid:** Always check `canvas.edges && typeof canvas.edges.values === 'function'` before iterating, same pattern as getNodesFromCanvas(). Fall back to file-based edge reading from the CanvasData JSON format, which reliably includes edges.
**Warning signs:** Edge boost (D-03) never activating despite visible connections on canvas.

### Pitfall 6: Relevance Score Distribution Skew
**What goes wrong:** All relevance scores cluster near 0.0 or 1.0, giving no useful gradient for filtering.
**Why it happens:** Linear distance-to-relevance mapping without normalization. If most nodes are far apart, everything scores near 0.
**How to avoid:** Normalize distance using the canvas's actual distance distribution (e.g., max observed distance or a percentile). Use a decay function (exponential or inverse) rather than linear mapping.
**Warning signs:** Histogram of relevance scores is bimodal (all near 0 or all near 1) instead of distributed.

### Pitfall 7: Viewport State Stale or Unavailable
**What goes wrong:** Placement coordinates are in screen space instead of canvas space, causing nodes to appear at wrong positions.
**Why it happens:** Using viewport-transformed coordinates for placement instead of canvas-native coordinates. Or reading viewport state at wrong time.
**How to avoid:** Node positions in CanvasNodeInfo are already in canvas coordinates. Placement coordinates should also be in canvas coordinates. Viewport state (canvas.x, canvas.y, canvas.zoom) is only needed to determine what the user is currently looking at, not to transform coordinates.
**Warning signs:** Placed nodes visible at zoom=1 but displaced at other zoom levels.

## Code Examples

### 1. Reading Edge Connections from Canvas Internal API
```typescript
// Extension to CanvasAdapter -- reading edges
export interface CanvasEdgeInfo {
  id: string;
  fromNode: string;  // node ID
  toNode: string;    // node ID
  label?: string;
}

getEdgesFromCanvas(canvas: any): CanvasEdgeInfo[] {
  try {
    const edges: CanvasEdgeInfo[] = [];
    if (canvas.edges && typeof canvas.edges.values === 'function') {
      for (const edge of canvas.edges.values()) {
        edges.push({
          id: edge.id ?? '',
          fromNode: edge.from?.node?.id ?? '',
          toNode: edge.to?.node?.id ?? '',
          label: edge.label ?? undefined,
        });
      }
    }
    return edges;
  } catch {
    return [];
  }
}
```
Source: obsidian-typings CanvasViewCanvasEdge interface (types.d.cts:26934)

### 2. DBSCAN Implementation for 2D Points
```typescript
// DBSCAN returns cluster assignments and noise points
export interface ClusterResult {
  clusters: string[][];  // Each cluster is array of node IDs
  noise: string[];       // Node IDs that are outliers
}

export function dbscan(
  nodes: CanvasNodeInfo[],
  epsilon: number,
  minPoints: number
): ClusterResult {
  const n = nodes.length;
  const labels = new Array<number>(n).fill(-1);  // -1 = unvisited
  let clusterId = 0;
  const NOISE = -2;

  function regionQuery(pointIdx: number): number[] {
    const neighbors: number[] = [];
    const center = computeCenter(nodes[pointIdx]);
    for (let i = 0; i < n; i++) {
      if (i === pointIdx) continue;
      if (euclideanDistance(center, computeCenter(nodes[i])) <= epsilon) {
        neighbors.push(i);
      }
    }
    return neighbors;
  }

  for (let i = 0; i < n; i++) {
    if (labels[i] !== -1) continue;  // Already processed
    const neighbors = regionQuery(i);
    if (neighbors.length < minPoints) {
      labels[i] = NOISE;
      continue;
    }
    // Start new cluster
    labels[i] = clusterId;
    const seeds = [...neighbors];
    for (let j = 0; j < seeds.length; j++) {
      const q = seeds[j];
      if (labels[q] === NOISE) labels[q] = clusterId;  // Border point
      if (labels[q] !== -1) continue;  // Already processed
      labels[q] = clusterId;
      const qNeighbors = regionQuery(q);
      if (qNeighbors.length >= minPoints) {
        seeds.push(...qNeighbors.filter(idx => !seeds.includes(idx)));
      }
    }
    clusterId++;
  }

  // Build result
  const clusterMap = new Map<number, string[]>();
  const noise: string[] = [];
  for (let i = 0; i < n; i++) {
    if (labels[i] === NOISE) {
      noise.push(nodes[i].id);
    } else {
      const arr = clusterMap.get(labels[i]) || [];
      arr.push(nodes[i].id);
      clusterMap.set(labels[i], arr);
    }
  }
  return {
    clusters: Array.from(clusterMap.values()),
    noise,
  };
}
```
Source: DBSCAN algorithm (Wikipedia, verified against density-clustering npm implementation)

### 3. Relevance Score with Edge Boost
```typescript
export function computeRelevance(
  distance: number,
  maxDistance: number,
  hasEdgeConnection: boolean,
  edgeBoost: number = 0.3
): number {
  // Exponential decay: nearby = high relevance, far = low
  // Normalize to [0, 1] range
  const normalized = Math.min(distance / maxDistance, 1.0);
  let score = Math.exp(-3 * normalized);  // Decay factor of 3 gives smooth falloff

  // Edge connection boost (D-03): connected nodes are always somewhat relevant
  if (hasEdgeConnection) {
    score = Math.min(1.0, score + edgeBoost);
  }

  return Math.round(score * 1000) / 1000;  // 3 decimal places
}
```

### 4. AABB Collision Detection with Gap Padding
```typescript
export interface BoundingBox {
  x: number;      // top-left x
  y: number;      // top-left y
  width: number;
  height: number;
}

export function checkCollision(
  candidate: BoundingBox,
  existing: BoundingBox[],
  gap: number = 30  // D-11: 30-50px comfortable gap
): boolean {
  for (const node of existing) {
    // Expand existing node by gap on all sides
    const expandedX = node.x - gap;
    const expandedY = node.y - gap;
    const expandedW = node.width + gap * 2;
    const expandedH = node.height + gap * 2;

    if (
      candidate.x < expandedX + expandedW &&
      candidate.x + candidate.width > expandedX &&
      candidate.y < expandedY + expandedH &&
      candidate.y + candidate.height > expandedY
    ) {
      return true;  // Collision detected
    }
  }
  return false;  // No collision
}
```

### 5. Orbital Placement Around Trigger Node
```typescript
export interface PlacementCoordinate {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function computeOrbitalPlacements(
  triggerNode: CanvasNodeInfo,
  count: number,
  nodeSize: { width: number; height: number },
  existingNodes: CanvasNodeInfo[],
  gap: number = 40
): PlacementCoordinate[] {
  const placements: PlacementCoordinate[] = [];
  const center = computeCenter(triggerNode);

  // Start from right side, sweep counter-clockwise
  // Find the direction with most open space first
  const bestAngle = findOpenDirection(center, existingNodes);
  const arcSpread = Math.PI / 3;  // 60-degree fan for multiple nodes
  const startAngle = bestAngle - (arcSpread * (count - 1)) / (2 * count);

  for (let i = 0; i < count; i++) {
    const angle = startAngle + (arcSpread * i) / Math.max(count - 1, 1);
    let radius = Math.max(triggerNode.width, triggerNode.height) / 2 + gap + nodeSize.width / 2;

    // Scan outward until collision-free (D-12)
    const maxRadius = radius * 5;
    let placed = false;

    while (radius <= maxRadius && !placed) {
      const candidate: BoundingBox = {
        x: center.x + Math.cos(angle) * radius - nodeSize.width / 2,
        y: center.y + Math.sin(angle) * radius - nodeSize.height / 2,
        width: nodeSize.width,
        height: nodeSize.height,
      };

      if (!checkCollision(candidate, existingNodes, gap)) {
        placements.push(candidate);
        placed = true;
      } else {
        radius += gap;  // Step outward
      }
    }

    // Fallback: place at max radius if still not placed
    if (!placed) {
      placements.push({
        x: center.x + Math.cos(angle) * maxRadius - nodeSize.width / 2,
        y: center.y + Math.sin(angle) * maxRadius - nodeSize.height / 2,
        width: nodeSize.width,
        height: nodeSize.height,
      });
    }
  }

  return placements;
}
```

### 6. Structured Narrative Serialization
```typescript
export function serializeNarrative(
  focusCluster: ClusterInfo,
  relevantNodes: RelevantNode[],
  outliers: OutlierNode[],
  triggerNode: CanvasNodeInfo
): string {
  const lines: string[] = [];

  lines.push(`## Canvas Context`);
  lines.push(``);
  lines.push(`The user just edited a node. Here is the spatial context of their canvas:`);
  lines.push(``);

  // Focus area
  lines.push(`### Focus Area (${focusCluster.nodes.length} nodes)`);
  for (const node of focusCluster.nodes) {
    const dir = describeDirection(triggerNode, node);
    lines.push(`- [${node.type}] "${truncate(node.content, 100)}" (${dir})`);
  }
  lines.push(``);

  // Nearby relevant nodes
  if (relevantNodes.length > 0) {
    lines.push(`### Nearby Context (${relevantNodes.length} nodes)`);
    for (const rn of relevantNodes) {
      const dir = describeDirection(triggerNode, rn.node);
      lines.push(`- [${rn.node.type}] "${truncate(rn.node.content, 80)}" (${dir}, relevance: ${rn.relevance})`);
    }
    lines.push(``);
  }

  // Peripheral awareness
  if (outliers.length > 0) {
    lines.push(`### Peripheral (${outliers.length} distant nodes)`);
    for (const o of outliers) {
      lines.push(`- "${truncate(o.node.content, 50)}" (far ${describeDirection(triggerNode, o.node)})`);
    }
  }

  return lines.join('\n');
}

function describeDirection(from: CanvasNodeInfo, to: CanvasNodeInfo): string {
  const fromCenter = computeCenter(from);
  const toCenter = computeCenter(to);
  const dx = toCenter.x - fromCenter.x;
  const dy = toCenter.y - fromCenter.y;

  // Canvas Y increases downward
  const parts: string[] = [];
  if (Math.abs(dy) > 30) parts.push(dy < 0 ? 'above' : 'below');
  if (Math.abs(dx) > 30) parts.push(dx < 0 ? 'to the left' : 'to the right');
  return parts.join(', ') || 'nearby';
}
```

### 7. Reading Viewport State
```typescript
export interface ViewportState {
  x: number;      // viewport X offset in canvas coords
  y: number;      // viewport Y offset in canvas coords
  zoom: number;   // current zoom scale
}

// In CanvasAdapter
getViewportState(canvas: any): ViewportState | null {
  try {
    return {
      x: canvas.x ?? 0,
      y: canvas.y ?? 0,
      zoom: canvas.zoom ?? 1,
    };
  } catch {
    return null;
  }
}
```
Source: obsidian-typings CanvasViewCanvas interface (types.d.cts:26295-26302)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| K-means for 2D spatial clustering | DBSCAN (density-based) | Established pattern | DBSCAN handles arbitrary cluster shapes, doesn't require pre-specified K, naturally identifies outliers |
| Fixed proximity radius | Adaptive radius from data density | Best practice | Works across sparse and dense canvases without manual tuning |
| Linear distance-to-relevance | Exponential decay scoring | Standard in information retrieval | Better gradient for filtering -- nearby nodes strongly relevant, distant nodes weakly |
| Grid-based placement | Orbital/radial placement | Common in graph visualization | More natural spatial relationship to the trigger node |

**Deprecated/outdated:**
- K-means clustering: Requires pre-specifying number of clusters, assumes spherical clusters, no outlier concept. DBSCAN is strictly better for spatial canvas analysis.
- Fixed pixel thresholds: "Near = within 200px" breaks on different canvas densities. Adaptive thresholds are required per D-01.

## Open Questions

1. **DBSCAN minPoints value**
   - What we know: D-06 wants "conservative sensitivity -- fewer, larger clusters." D-06 specifically says "5-10 nodes forms one cluster."
   - What's unclear: Exact minPoints value. Lower = more clusters, higher = fewer/larger.
   - Recommendation: Start with `minPoints = 2` (minimum for a cluster to exist) combined with a generous epsilon. This errs on the side of larger clusters since the epsilon does the heavy lifting. Tune via testing with real canvas layouts.

2. **Relevance score threshold for filtering (SPAT-07)**
   - What we know: D-14 says "above a relevance score threshold."
   - What's unclear: Exact cutoff value.
   - Recommendation: Default to `0.15` -- this is generous enough to include contextually useful nodes while excluding truly distant ones. The exponential decay function means 0.15 corresponds to roughly 60% of the max observed distance. Make this a constant that can be adjusted later.

3. **Edge boost magnitude**
   - What we know: D-03 says "boost relevance score regardless of distance."
   - What's unclear: How much boost. Too much = distant connected nodes treated as primary context. Too little = edges barely matter.
   - Recommendation: `+0.3` additive boost, clamped to 1.0. This means a connected node at medium distance (~0.4 base relevance) jumps to 0.7, ensuring it passes any reasonable threshold. A connected node at extreme distance (~0.05 base) jumps to 0.35, making it at least peripherally relevant.

4. **What constitutes "the most recently edited node"?**
   - What we know: CanvasEvent.nodeId identifies the trigger node. GenerationController receives this.
   - What's unclear: Current GenerationController.onTrigger doesn't pass nodeId -- it only receives AbortSignal. The event handler in main.ts doesn't forward the nodeId to the controller.
   - Recommendation: This is a Phase 2 integration task: modify GenerationController (or the trigger callback) to capture and pass the last CanvasEvent.nodeId to the spatial engine. Minimal change to Phase 1 code.

## Environment Availability

Step 2.6: SKIPPED (no external dependencies identified). Phase 2 is purely computational -- TypeScript code operating on in-memory data structures.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29 + ts-jest 29 |
| Config file | jest.config.js |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SPAT-01 | Read node positions/dimensions from canvas | unit | `npx jest tests/spatial/proximity.test.ts -t "reads nodes" -x` | No -- Wave 0 |
| SPAT-02 | Euclidean distance between node centers | unit | `npx jest tests/spatial/proximity.test.ts -t "distance" -x` | No -- Wave 0 |
| SPAT-03 | Nearby nodes get high relevance score | unit | `npx jest tests/spatial/proximity.test.ts -t "relevance" -x` | No -- Wave 0 |
| SPAT-04 | Distant nodes get low relevance score | unit | `npx jest tests/spatial/proximity.test.ts -t "relevance" -x` | No -- Wave 0 |
| SPAT-05 | Density-based cluster detection | unit | `npx jest tests/spatial/clustering.test.ts -x` | No -- Wave 0 |
| SPAT-06 | Structured narrative serialization | unit | `npx jest tests/spatial/context-builder.test.ts -x` | No -- Wave 0 |
| SPAT-07 | Relevance-based node filtering | unit | `npx jest tests/spatial/context-builder.test.ts -t "filter" -x` | No -- Wave 0 |
| SPAT-08 | Contextual position placement | unit | `npx jest tests/spatial/placement.test.ts -t "orbital" -x` | No -- Wave 0 |
| SPAT-09 | Collision-free bounding-box detection | unit | `npx jest tests/spatial/placement.test.ts -t "collision" -x` | No -- Wave 0 |
| SPAT-10 | Viewport zoom/pan awareness | unit | `npx jest tests/spatial/placement.test.ts -t "viewport" -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/spatial/proximity.test.ts` -- covers SPAT-01, SPAT-02, SPAT-03, SPAT-04
- [ ] `tests/spatial/clustering.test.ts` -- covers SPAT-05
- [ ] `tests/spatial/placement.test.ts` -- covers SPAT-08, SPAT-09, SPAT-10
- [ ] `tests/spatial/context-builder.test.ts` -- covers SPAT-06, SPAT-07
- [ ] Test fixtures: reusable CanvasNodeInfo[] factory for common canvas layouts (sparse, dense, clustered, single node, empty)

## Sources

### Primary (HIGH confidence)
- obsidian-typings 5.17.0 (installed at node_modules/obsidian-typings) -- CanvasViewCanvas, CanvasViewCanvasEdge, CanvasViewCanvasEdgeLink interfaces. Directly inspected type definitions for canvas.edges, canvas.x, canvas.y, canvas.zoom, getEdgesForNode(), getViewportBBox().
- obsidian/canvas.d.ts (installed at node_modules/obsidian/canvas.d.ts) -- Official CanvasEdgeData interface with fromNode, toNode, fromSide, toSide, label fields.
- JSON Canvas Specification (https://jsoncanvas.org/spec/1.0/) -- Confirmed node x,y is top-left corner, coordinates are in pixels, canvas extends infinitely.
- Existing project source code -- CanvasAdapter, CanvasNodeInfo, CanvasEvent, GenerationController analyzed for integration points.

### Secondary (MEDIUM confidence)
- DBSCAN algorithm (https://en.wikipedia.org/wiki/DBSCAN) -- Standard algorithm description verified against density-clustering npm implementation.
- Forum post on node movement (https://forum.obsidian.md/t/unable-to-move-canvas-node-via-code/93486) -- Confirmed setData() pattern for node positioning, relevant for Phase 3 node creation.
- density-clustering npm (https://www.npmjs.com/package/density-clustering) -- Evaluated as alternative; version 1.3.0, no TypeScript types, no adaptive epsilon. Decision: hand-roll instead.
- ml-dbscan npm (https://github.com/mljs/dbscan) -- Evaluated as alternative; same limitations as density-clustering for our use case.

### Tertiary (LOW confidence)
- None. All findings verified against primary or secondary sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- No new dependencies needed. All existing tools verified installed and working.
- Architecture: HIGH -- Pure functions pattern is well-established. All input/output types are known from Phase 1 code.
- Algorithms (DBSCAN, proximity, collision): HIGH -- Standard algorithms with well-understood behavior. Verified against multiple sources.
- Canvas coordinate system: HIGH -- Verified via JSON Canvas spec and obsidian-typings inspection.
- Edge access via internal API: MEDIUM -- Types exist in obsidian-typings but undocumented. Fallback to file-based reading is reliable.
- Viewport state access: MEDIUM -- Properties visible in obsidian-typings (canvas.x, canvas.y, canvas.zoom) but behavior under animation/transition is undocumented.

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (30 days -- algorithms are stable, canvas internals may shift with Obsidian updates)
