# Phase 2: Spatial Intelligence - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

The plugin understands canvas layout — which nodes are near each other, where clusters exist, and where to place new content without overlapping existing nodes. This phase builds the spatial analysis engine that reads CanvasNodeInfo[] from the existing CanvasAdapter and produces: proximity scores, cluster assignments, a focus cluster, placement coordinates, and a structured narrative for the LLM prompt. No Claude API calls happen in this phase — that's Phase 3.

</domain>

<decisions>
## Implementation Decisions

### Proximity Thresholds
- **D-01:** Adaptive proximity thresholds based on canvas density — sparse canvases use larger "near" radius, dense canvases use tighter radius
- **D-02:** Continuous relevance score (0.0-1.0) between node pairs, not discrete buckets (near/medium/far)
- **D-03:** Canvas edge connections boost relevance score regardless of distance — honors explicit user connections
- **D-04:** Always compute proximity even with few nodes (1-3) — consistent behavior regardless of canvas size

### Cluster Detection
- **D-05:** Density-based clustering (DBSCAN-style) for finding node groups
- **D-06:** Conservative sensitivity — fewer, larger clusters. A workspace area with 5-10 nodes forms one cluster
- **D-07:** Isolated nodes flagged as outliers, not treated as clusters of one — they're lone ideas, not focus areas
- **D-08:** Primary focus cluster identified — the cluster nearest to the most recent edit gets special status as the active focus area

### Placement Strategy
- **D-09:** Generated nodes orbit the most recently edited node — tightest coupling to user's current action
- **D-10:** Multiple generated nodes fan out in available direction — detect which direction has open space and spread nodes there
- **D-11:** Comfortable gap (~30-50px) between generated and existing nodes — visually distinct but spatially associated
- **D-12:** When no nearby space exists, place further out in best direction — scan outward until clear space is found, never overlap

### Context Narration
- **D-13:** Structured narrative format for Claude — natural language with structure describing clusters, relationships, and spatial positions
- **D-14:** Send focus cluster + nearby nodes to Claude (nodes above a relevance score threshold) — balance of context and cost
- **D-15:** Include spatial directions in narration (e.g., "to the left", "above the cluster") — helps Claude understand the 2D space
- **D-16:** Outlier nodes briefly mentioned as peripheral context — gives Claude full canvas awareness without over-weighting distant ideas

### Claude's Discretion
- Exact DBSCAN epsilon/minPoints parameter tuning
- Specific relevance score threshold for filtering (e.g., 0.3 vs 0.5 cutoff)
- Edge connection boost magnitude (how much edges increase relevance)
- Exact structured narrative template wording
- Adaptive density algorithm specifics (mean distance, percentile-based, etc.)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Specs
- `.planning/PROJECT.md` — Core value, constraints, key decisions
- `.planning/REQUIREMENTS.md` — SPAT-01 through SPAT-10 acceptance criteria
- `.planning/ROADMAP.md` — Phase 2 success criteria and dependency chain

### Technical References
- `CLAUDE.md` — Full technology stack, canvas data format, key technical decisions
- `src/types/canvas.ts` — CanvasNodeInfo and CanvasSnapshot interfaces (the input data)
- `src/canvas/canvas-adapter.ts` — CanvasAdapter with getNodesFromCanvas() (the data source)
- `src/canvas/generation-controller.ts` — GenerationController with onTrigger (the integration point for Phase 3)
- `src/canvas/canvas-events.ts` — Canvas event types and CanvasEvent interface

### Phase 1 Context
- `.planning/phases/01-foundation/01-CONTEXT.md` — Prior decisions on status bar, settings, canvas events

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CanvasAdapter.getNodesFromCanvas(canvas)` — Returns CanvasNodeInfo[] with full spatial data (x, y, width, height, content, type, color)
- `CanvasAdapter.readCanvasFile(file)` — File-based fallback returning CanvasSnapshot
- `CanvasNodeInfo` interface — Normalized node with id, type, x, y, width, height, content, color
- `GenerationController` — Debounce + abort controller, onTrigger callback is the integration point

### Established Patterns
- CanvasAdapter as the single point of contact with canvas internals — Phase 2 builds on top of it, never bypasses it
- Monkey-patching via canvas-patcher for event interception
- Workspace events for plugin communication (CANVAS_EVENT_TYPES)

### Integration Points
- Phase 2 spatial engine consumes CanvasNodeInfo[] from CanvasAdapter
- Phase 3 GenerationController.onTrigger will call the spatial engine to build context before sending to Claude
- CanvasEvent.nodeId identifies the most recently edited node (for focus cluster detection)

</code_context>

<specifics>
## Specific Ideas

- Proximity should feel natural — adaptive to how the user actually uses their canvas, not arbitrary pixel thresholds
- Clustering should be conservative — the user's canvas is their thought space, we should see broad themes not micro-groups
- Placement should feel like a collaborator responding — orbiting the recent edit, fanning into open space, never overlapping
- The narrative to Claude should read like a human describing what they see on the canvas — not raw data

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-spatial-intelligence*
*Context gathered: 2026-04-02*
