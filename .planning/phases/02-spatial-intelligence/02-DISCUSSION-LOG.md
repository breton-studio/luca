# Phase 2: Spatial Intelligence - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-02
**Phase:** 02-spatial-intelligence
**Areas discussed:** Proximity thresholds, Cluster detection, Placement strategy, Context narration

---

## Proximity Thresholds

### Q1: How should 'near' vs 'far' be defined?

| Option | Description | Selected |
|--------|-------------|----------|
| Adaptive to canvas density | Thresholds adjust based on how spread out nodes are. Sparse canvas = larger radius, dense canvas = tighter radius. | ✓ |
| Fixed pixel thresholds | Hard cutoffs like <300px = near, >800px = far. Simple and predictable. | |
| Relative to node size | Near = within N node-widths of each other. Scales with node dimensions. | |
| You decide | Claude's discretion. | |

**User's choice:** Adaptive to canvas density
**Notes:** Feels natural at any scale.

### Q2: Discrete categories or continuous score?

| Option | Description | Selected |
|--------|-------------|----------|
| Continuous score (0.0-1.0) | Each node pair gets a relevance score. More nuanced. | ✓ |
| Discrete buckets | Near / medium / far / unrelated. Simpler but loses nuance. | |
| You decide | Claude's discretion. | |

**User's choice:** Continuous score
**Notes:** None

### Q3: Should edge connections override spatial proximity?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, edges boost relationship | Connected nodes get relevance boost regardless of distance. | ✓ |
| No, distance only for v1 | Edges are a v2 enhancement (ASPAT-02). | |
| You decide | Claude's discretion. | |

**User's choice:** Yes, edges boost relationship
**Notes:** Honors explicit user connections.

### Q4: Few nodes (1-3) behavior?

| Option | Description | Selected |
|--------|-------------|----------|
| Everything related until 4+ nodes | All relevant until canvas is complex enough. | |
| Always compute proximity | Even with 2 nodes, distance matters. Consistent. | ✓ |
| You decide | Claude's discretion. | |

**User's choice:** Always compute proximity
**Notes:** Consistent behavior regardless of canvas size.

---

## Cluster Detection

### Q1: How should clusters be identified?

| Option | Description | Selected |
|--------|-------------|----------|
| Density-based (DBSCAN-style) | Groups by density, finds arbitrary shapes, handles outliers. | ✓ |
| Grid-based partitioning | Divide canvas into grid cells. Simple but artificial boundaries. | |
| Hierarchical (agglomerative) | Bottom-up merging. Produces hierarchy, more complex. | |
| You decide | Claude's discretion. | |

**User's choice:** Density-based (DBSCAN-style)
**Notes:** Standard approach for spatial clustering.

### Q2: Sensitivity level?

| Option | Description | Selected |
|--------|-------------|----------|
| Conservative — fewer, larger clusters | Broad groups. 5-10 nodes = one cluster. | ✓ |
| Sensitive — many small clusters | Tight groupings of 2-3 nodes form clusters. | |
| Adaptive to canvas size | Adjusts automatically based on node count. | |
| You decide | Claude's discretion. | |

**User's choice:** Conservative — fewer, larger clusters
**Notes:** None

### Q3: Isolated node handling?

| Option | Description | Selected |
|--------|-------------|----------|
| Flagged as outliers | Special status — lone ideas, not focus areas. | ✓ |
| Cluster of one | Every node belongs to a cluster. Simplifies model. | |
| You decide | Claude's discretion. | |

**User's choice:** Flagged as outliers
**Notes:** None

### Q4: Primary focus cluster?

| Option | Description | Selected |
|--------|-------------|----------|
| Primary focus cluster | Cluster nearest to most recent edit gets special status. | ✓ |
| All clusters equal | No special focus, all contribute equally. | |
| You decide | Claude's discretion. | |

**User's choice:** Primary focus cluster
**Notes:** Generation prioritizes this cluster's context.

---

## Placement Strategy

### Q1: Where should generated nodes be placed?

| Option | Description | Selected |
|--------|-------------|----------|
| Extend outward from focus cluster | New nodes at cluster edges, growing organically. | |
| Bridge between clusters | New nodes between related clusters, connecting ideas. | |
| Orbit the most recent edit | New nodes around the last-edited node. | ✓ |
| You decide | Claude's discretion. | |

**User's choice:** Orbit the most recent edit
**Notes:** Tightest coupling to user's current action.

### Q2: Multiple generated node arrangement?

| Option | Description | Selected |
|--------|-------------|----------|
| Fan out in available direction | Detect open space, spread nodes there. Adapts to layout. | ✓ |
| Radial spread | Semi-circle/arc around edited node. Consistent pattern. | |
| Vertical stack below | Stack downward. Simple, predictable. | |
| You decide | Claude's discretion. | |

**User's choice:** Fan out in available direction
**Notes:** None

### Q3: Spacing between generated and existing nodes?

| Option | Description | Selected |
|--------|-------------|----------|
| Comfortable gap (~30-50px) | Clearly separated but visually associated. | ✓ |
| Tight (~10-15px) | Maximizes space, may feel crowded. | |
| Wide (~80-100px) | Generous room, may weaken relationships. | |
| You decide | Claude's discretion. | |

**User's choice:** Comfortable gap (~30-50px)
**Notes:** Feels like a response, not a collision.

### Q4: No space available fallback?

| Option | Description | Selected |
|--------|-------------|----------|
| Place further out in best direction | Scan outward until clear. Never overlaps. | ✓ |
| Stack below the cluster | Predictable escape hatch. | |
| Shrink node to fit | Squeeze into gaps, sacrificing readability. | |
| You decide | Claude's discretion. | |

**User's choice:** Place further out in best direction
**Notes:** None

---

## Context Narration

### Q1: How should spatial relationships be described to Claude?

| Option | Description | Selected |
|--------|-------------|----------|
| Structured narrative | Natural language with structure. Gives both spatial and semantic context. | ✓ |
| Structured JSON | Raw data with coordinates, scores, cluster IDs. Compact. | |
| Minimal — content + relevance scores | No spatial description. Claude sees relevance but not layout. | |
| You decide | Claude's discretion. | |

**User's choice:** Structured narrative
**Notes:** None

### Q2: How aggressively to filter nodes for Claude?

| Option | Description | Selected |
|--------|-------------|----------|
| Focus cluster + nearby nodes | All in primary cluster, plus above-threshold nodes. 60-80% of canvas. | ✓ |
| Only focus cluster | Most cost-efficient but Claude misses broader context. | |
| Send everything | Maximum context, highest cost. | |
| You decide | Claude's discretion. | |

**User's choice:** Focus cluster + nearby nodes
**Notes:** Good balance of context and cost.

### Q3: Include spatial directions?

| Option | Description | Selected |
|--------|-------------|----------|
| Include spatial directions | "to the left", "above the cluster" etc. Helps Claude understand 2D space. | ✓ |
| Relationship strength only | Only how related, not where. Simpler. | |
| You decide | Claude's discretion. | |

**User's choice:** Include spatial directions
**Notes:** None

### Q4: Outlier nodes in narration?

| Option | Description | Selected |
|--------|-------------|----------|
| Briefly mentioned as peripheral | Include with note about being distant. Full awareness. | ✓ |
| Excluded entirely | Only clustered/nearby nodes. Most cost-efficient. | |
| You decide | Claude's discretion. | |

**User's choice:** Briefly mentioned as peripheral
**Notes:** Gives Claude full canvas awareness without over-weighting distant ideas.

---

## Claude's Discretion

- DBSCAN epsilon/minPoints parameter tuning
- Specific relevance score threshold for filtering
- Edge connection boost magnitude
- Structured narrative template wording
- Adaptive density algorithm specifics

## Deferred Ideas

None — discussion stayed within phase scope
