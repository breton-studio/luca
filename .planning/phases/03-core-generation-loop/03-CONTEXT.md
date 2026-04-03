# Phase 3: Core Generation Loop - Context

**Gathered:** 2026-04-03
**Status:** Ready for planning

<domain>
## Phase Boundary

After the user acts on the canvas and goes idle (~3s), Claude reads spatial context and a taste profile, then streams new text/markdown nodes that appear progressively near the action area. This phase connects the spatial engine (Phase 2) to the Claude API, implements streaming into canvas nodes, adds a basic taste profile, and introduces token budget controls. This is the validation milestone -- if text generation from spatial context doesn't feel useful, the product concept fails.

</domain>

<decisions>
## Implementation Decisions

### Streaming UX
- **D-01:** Pre-allocate + stream -- create a sized empty node immediately at the computed placement position, then stream text progressively into it (~200-300ms buffer intervals). User sees the node appear instantly and fill up with content.
- **D-02:** 1-3 nodes per trigger, Claude decides based on canvas context. Multiple nodes use Phase 2's orbital placement to fan out.
- **D-03:** Sequential node streaming -- first node streams to completion, then the next node appears and begins streaming. Easier to follow and read.
- **D-04:** Subtle pulsing border on pre-allocated nodes while waiting for the first token. No placeholder text -- the status bar already shows "AI: thinking". Once tokens arrive, pulsing stops and content fills in.

### AI Node Appearance
- **D-05:** Inverse of default node color -- if default theme has dark nodes, AI nodes are light, and vice versa. Adaptive to the user's Obsidian theme rather than a fixed color preset.
- **D-06:** Settings option to change AI node color and styling properties (padding, border, etc.) globally. User has full control over the visual treatment.
- **D-07:** No text label or content prefix -- color/styling only distinction. Content stays clean and uncluttered.

### Taste Profile
- **D-08:** Markdown with YAML frontmatter format -- structured fields (tone, depth, visual preference, thinking style) in frontmatter, plus freeform markdown body for nuanced preferences, examples, and philosophy.
- **D-09:** Stored at `.obsidian/plugins/canvas-ai/taste-profile.md` -- co-located with plugin data, hidden from vault browsing.
- **D-10:** Seeded on first run with the user's existing design philosophy document (Swiss rational tradition, restraint-first, monochromatic palette, grotesque typefaces, structural soundness). User will edit once the experience is running. See Specific Ideas section for the full seed content.

### Token Budget
- **D-11:** Daily token cap only -- single number in settings (e.g., 500K tokens/day). Resets at midnight. No hourly burst cap.
- **D-12:** Hard stop when budget exceeded + "Continue anyway" override button in settings. Status bar shows "AI: budget". Dismissable Obsidian notice explains the pause. Override unlocks generation for the rest of the day.
- **D-13:** Token usage persisted in plugin's data.json via saveData(). Tracked fields: date, inputTokens, outputTokens, budgetOverride. Auto-resets when date changes.

### Claude's Discretion
- System prompt structure and wording (how spatial context, taste profile, and medium instructions are composed)
- Prompt caching strategy for system prompt (GENP-08)
- Exact pre-allocation node dimensions before streaming begins
- Timeout watchdog implementation details (GENP-11)
- API error retry strategy and backoff timing (GENP-12)
- How Claude decides between 1, 2, or 3 nodes per trigger
- Pulsing border animation CSS implementation
- Token counting approach (response headers vs manual counting)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Specs
- `.planning/PROJECT.md` -- Core value, constraints, key decisions
- `.planning/REQUIREMENTS.md` -- GENP-01 through GENP-12, MMED-01, MMED-09, MMED-10, TAST-01 through TAST-03 acceptance criteria
- `.planning/ROADMAP.md` -- Phase 3 success criteria, dependency chain, validation milestone status

### Technical References
- `CLAUDE.md` -- Full technology stack, Anthropic SDK configuration (dangerouslyAllowBrowser, Node.js fetch), esbuild config, canvas data format, streaming limitation notes
- `CLAUDE.md` "Key Technical Decisions" section -- especially #1 (Node.js fetch for streaming) and #2 (dual canvas manipulation approach)

### Phase 1 Foundation (integration points)
- `src/main.ts` -- Plugin lifecycle, GenerationController wiring, onTrigger callback (currently Phase 1 stub at line 82-96)
- `src/canvas/generation-controller.ts` -- Debounce + AbortController, onTrigger signature
- `src/canvas/canvas-adapter.ts` -- CanvasAdapter for reading nodes and canvas manipulation
- `src/canvas/canvas-events.ts` -- Canvas event types, CanvasEvent interface with nodeId
- `src/settings.ts` -- Settings tab (new fields needed: daily budget, AI node styling, taste profile path)
- `src/types/settings.ts` -- CanvasAISettings interface (needs budget and styling fields)
- `src/ui/status-bar.ts` -- StatusBarManager (needs "budget" state)

### Phase 2 Spatial (data pipeline)
- `src/spatial/types.ts` -- SpatialConfig, ProximityGraph, ProximityPair, ViewportState
- `src/spatial/proximity.ts` -- Proximity graph computation
- `src/spatial/clustering.ts` -- DBSCAN clustering, focus cluster detection
- `src/spatial/placement.ts` -- Collision-free orbital placement
- `src/types/canvas.ts` -- CanvasNodeInfo, CanvasSnapshot, CanvasEdgeInfo

### Prior Phase Context
- `.planning/phases/01-foundation/01-CONTEXT.md` -- Status bar decisions, settings layout, enable/disable scope
- `.planning/phases/02-spatial-intelligence/02-CONTEXT.md` -- Proximity thresholds, cluster detection, placement strategy, context narration format

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `GenerationController` -- Debounce + AbortController already wired. The `onTrigger` callback (currently a 500ms stub) is the exact integration point for Claude API calls.
- `CanvasAdapter.getNodesFromCanvas()` -- Returns CanvasNodeInfo[] with full spatial data
- Spatial modules (`proximity.ts`, `clustering.ts`, `placement.ts`) -- Pure math functions, zero Obsidian imports, ready to consume
- `StatusBarManager` -- States: idle, thinking, error. Needs new "budget" state for GENP-10.
- `CanvasAISettings` -- Already has claudeApiKey field. Needs extension for budget, styling, taste profile.

### Established Patterns
- CanvasAdapter as single point of canvas interaction -- never bypass it
- Monkey-patching via canvas-patcher for event interception
- Workspace events for plugin communication (CANVAS_EVENT_TYPES)
- Obsidian `Setting` API for grouped settings tab with headings
- Plugin data.json via saveData()/loadData() for persistence
- Spatial modules are pure functions with no Obsidian imports

### Integration Points
- `onTrigger(signal: AbortSignal)` -- Replace Phase 1 stub with: read canvas -> build spatial context -> call Claude API -> stream into nodes
- `CanvasAdapter` -- Currently read-only. Phase 3 needs write capability to create nodes on canvas (internal API primary, file I/O fallback per CLAUDE.md)
- Settings tab -- New sections for: token budget (slider + usage display), AI node styling (color picker, padding), taste profile (path display + edit button)
- Status bar -- New "budget" state when daily cap is hit

</code_context>

<specifics>
## Specific Ideas

### Taste Profile Seed Content
The initial taste profile will be seeded with the user's design philosophy. Key themes to extract into frontmatter fields:
- **tone:** Restrained, considered, unhurried. Direct without being blunt.
- **depth:** Deep structural analysis. First-principles thinking. Justify in terms of spatial relationships and logic.
- **visual_preference:** Monochromatic default (black/white/gray). Color used surgically -- single accent, low saturation, "mixed with concrete." No trends, no named movements.
- **thinking_style:** Swiss rational tradition (Gerstner, Muller-Brockmann, Ruder). Systematic thinking over intuition. Soft mathematical ratios over rigid alignment. Space as primary material.

Full body content: "We believe design begins with restraint..." (user's complete philosophy document -- ~400 words covering space, grid, typography, color, materials, timelessness).

### Streaming Should Feel Spatial
The pre-allocate + stream pattern should make nodes feel like they're "growing" from the canvas -- appearing at the right position instantly, then filling with content. The pulsing border signals life without being distracting. Sequential multi-node streaming creates a sense of the AI "building out" a thought cluster.

### Node Styling Should Be Adaptive
The inverse-color approach means AI nodes will automatically look appropriate in any Obsidian theme (light or dark). Settings give the user full control to customize this. This is more considered than hardcoding a single color preset.

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 03-core-generation-loop*
*Context gathered: 2026-04-03*
