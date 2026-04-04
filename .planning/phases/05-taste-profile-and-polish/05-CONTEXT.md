# Phase 5: Taste Profile and Polish - Context

**Gathered:** 2026-04-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Evolve the taste profile system with structured style/substance separation, add counter-sycophancy instructions to the system prompt, add a settings UI button to open the profile file, improve AI node placement alignment, and add interactive companion render nodes for code output. Per-member profile switching (TAST-04) is deferred to a future phase.

</domain>

<decisions>
## Implementation Decisions

### Style vs Substance Separation (TAST-06)
- **D-01:** YAML frontmatter split into two nested groups: `style:` (tone, voice, formatting preferences) and `substance:` (depth, domains, thinking approach). Single file, clear separation.
- **D-02:** Freeform body uses markdown headers: `## Style Philosophy` and `## Substance Philosophy`. Optional — if omitted, treated as combined.
- **D-03:** Existing 4-field format (tone, depth, visual_preference, thinking_style) migrated into the new grouped structure. Backward-compatible parsing: detect flat vs nested and handle both.

### Counter-Sycophancy (TAST-07)
- **D-04:** Hardcoded instructions in the system prompt — not user-configurable. Claude should always push back occasionally regardless of taste profile settings.
- **D-05:** Four behaviors: (1) Devil's advocate — argue against user's apparent direction, (2) Unexpected connections — surprising analogies from unrelated domains, (3) Uncomfortable questions — surface assumptions the user may be avoiding, (4) Contrarian references — cite thinkers/works that disagree with user's philosophy.
- **D-06:** Counter-sycophancy is probabilistic, not every generation — Claude uses judgment on when it's appropriate.

### Settings UI (TAST-05)
- **D-07:** "Open profile" button in settings tab that opens the taste profile markdown file in an Obsidian editor tab. No inline editing — leverages Obsidian's full editor capabilities.
- **D-08:** Per-member profiles (TAST-04) deferred — single global profile for now.

### AI Node Placement Alignment (folded from backlog)
- **D-09:** Generated nodes flow rightward from trigger node, aligned to its right edge. Natural left-to-right reading flow.
- **D-10:** Multiple generated nodes stack vertically along the right edge with consistent gap spacing.
- **D-11:** Collision detection must still apply — if rightward space is blocked, fall back to next available direction.

### Code Render Companion Node (folded from backlog)
- **D-12:** Code nodes get a companion node showing rendered/interactive output. Placed adjacent to the code node.
- **D-13:** Supported types: HTML/CSS/JS (sandboxed iframe with interactivity), Mermaid (source+diagram side-by-side), SVG (visual render).
- **D-14:** Companion node is a separate canvas node linked visually to the code node. Created after code streaming completes.

### Claude's Discretion
- System prompt wording for counter-sycophancy instructions
- Exact placement gap sizes and vertical stacking offsets
- Companion node sizing relative to code node
- How to sandbox HTML/JS execution safely in Electron
- Migration strategy for existing taste profiles to new format

### Folded Todos
- **AI node placement alignment** — from 2026-04-03 note. Nodes should align to trigger node's right edge with collision avoidance.
- **Code render companion node** — from 2026-04-03 note. Interactive preview alongside code source (HTML/CSS/JS, Mermaid, SVG).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Specs
- `.planning/PROJECT.md` — Core value, constraints
- `.planning/REQUIREMENTS.md` — TAST-04 through TAST-07 acceptance criteria
- `.planning/ROADMAP.md` — Phase 5 success criteria and dependencies

### Technical References
- `CLAUDE.md` — Technology stack, Anthropic SDK config, canvas data format
- `src/taste/taste-profile.ts` — Current taste profile implementation (parser, formatter, default content, vault adapters)
- `src/ai/prompt-builder.ts` — System prompt construction, taste profile injection point
- `src/spatial/placement.ts` — Current orbital placement algorithm for generated nodes
- `src/canvas/canvas-adapter.ts` — Canvas node creation methods (createTextNodeOnCanvas, createFileNodeOnCanvas)
- `src/main.ts` — Generation pipeline, node creation flow, placement coordinate usage

### Prior Phase Context
- `.planning/phases/03-core-generation-loop/03-CONTEXT.md` — Phase 3 taste profile decisions (D-08 through D-10)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `parseTasteProfileFrontmatter()` in `src/taste/taste-profile.ts` — needs update for nested YAML but parsing logic is reusable
- `formatTasteForPrompt()` — needs update to include style/substance structure in prompt output
- `buildSystemPrompt()` in `src/ai/prompt-builder.ts` — injection point for counter-sycophancy instructions
- `computePlacement()` in `src/spatial/placement.ts` — orbital placement to replace with edge-aligned placement
- `createTextNodeOnCanvas()` / `createFileNodeOnCanvas()` in canvas adapter — node creation for companion nodes

### Established Patterns
- YAML frontmatter parsing via simple string splitting (no yaml library dependency)
- Obsidian `PluginSettingTab` pattern with `Setting` class for UI elements
- `suppressEvents()` wrapper for all AI canvas mutations
- `aiNodeIds` Set for tracking AI-generated nodes

### Integration Points
- `streamWithRetry()` in main.ts — where companion nodes would be created after code streaming completes
- Settings tab (`src/settings.ts`) — where "Open profile" button would be added
- System prompt blocks in `buildSystemPrompt()` — where counter-sycophancy instructions go

</code_context>

<specifics>
## Specific Ideas

- Counter-sycophancy should feel like a sharp thinking partner, not random contrarianism — Claude should challenge when it matters
- HTML/CSS/JS companion preview must be interactive (user said "including interactivity") — not just a static screenshot
- Right-edge alignment mirrors how people naturally read and extend ideas on a canvas (left-to-right flow)
- The user's existing taste profile is deeply specific (Swiss rational tradition, grotesque typefaces, monochromatic) — migration must preserve this content

</specifics>

<deferred>
## Deferred Ideas

- **TAST-04: Per-member profile switching** — Each team member having their own taste profile file with a dropdown selector. Deferred from this phase to reduce scope.

</deferred>

---

*Phase: 05-taste-profile-and-polish*
*Context gathered: 2026-04-03*
