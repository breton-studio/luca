# Requirements: Obsidian Canvas AI

**Defined:** 2026-04-02
**Core Value:** After any canvas action, Opus reads spatial context and generates relevant multi-medium content that feels like a natural extension of your thinking

## v1 Requirements

### Foundation

- [x] **FOUN-01**: Plugin loads in Obsidian and registers lifecycle hooks (onload/onunload)
- [x] **FOUN-02**: Canvas Adapter Layer wraps all undocumented canvas internal APIs behind a stable interface
- [x] **FOUN-03**: Canvas Adapter has file-based JSON fallback when internal APIs are unavailable
- [x] **FOUN-04**: Plugin detects canvas node create events via monkey-patching
- [x] **FOUN-05**: Plugin detects canvas node edit events via monkey-patching
- [x] **FOUN-06**: Plugin detects canvas node move events via monkey-patching
- [x] **FOUN-07**: Plugin detects canvas node delete events via monkey-patching
- [x] **FOUN-08**: Debounce timer triggers generation after ~3s of user idle (configurable)
- [x] **FOUN-09**: In-flight generation requests are cancelled when new debounce fires (AbortController)
- [x] **FOUN-10**: Settings UI with fields for Claude API key, Runware API key, and debounce delay
- [x] **FOUN-11**: Enable/disable toggle accessible from command palette and status bar
- [x] **FOUN-12**: Generation indicator in status bar shows thinking/idle/error state
- [x] **FOUN-13**: Canvas Adapter handles requestSave race condition (uses internal API, not vault.modify)

### Spatial Intelligence

- [x] **SPAT-01**: Plugin reads all node positions, dimensions, and content from active canvas
- [x] **SPAT-02**: Proximity graph computed from node positions (Euclidean distance between centers)
- [x] **SPAT-03**: Nearby nodes interpreted as conceptually related (proximity-as-semantics)
- [x] **SPAT-04**: Distant nodes interpreted as weakly related or tangential
- [x] **SPAT-05**: Dense node clusters detected as focus areas (density-based analysis)
- [x] **SPAT-06**: Spatial context serialized into structured narrative for LLM prompt
- [x] **SPAT-07**: Only nearby/relevant nodes sent to Claude (not entire canvas) for cost efficiency
- [x] **SPAT-08**: Generated nodes placed in contextually appropriate positions (extend direction, bridge gaps)
- [x] **SPAT-09**: Collision-free placement using bounding-box detection (no overlapping nodes)
- [x] **SPAT-10**: Placement accounts for canvas zoom and pan offsets

### Generation Pipeline

- [x] **GENP-01**: Claude Opus 4.6 called via Anthropic SDK with SSE streaming
- [x] **GENP-02**: Streaming uses Node.js fetch in Electron (not Obsidian requestUrl)
- [x] **GENP-03**: Text content streams progressively into pre-allocated canvas nodes
- [x] **GENP-04**: Streaming updates buffered to 200-300ms intervals to prevent layout thrash
- [x] **GENP-05**: Node dimensions pre-allocated before streaming begins
- [x] **GENP-06**: System prompt includes spatial context, taste profile, and medium selection instructions
- [x] **GENP-07**: Opus decides which medium type(s) to generate based on canvas context
- [x] **GENP-08**: Prompt caching enabled for system prompt to reduce input token costs
- [x] **GENP-09**: Token budget system with configurable daily/hourly caps
- [x] **GENP-10**: Budget exceeded state shown in UI, generation paused until reset
- [x] **GENP-11**: Timeout watchdog detects streaming pauses >30s with user-visible feedback
- [x] **GENP-12**: API errors handled gracefully (retry with backoff, surface in status bar, never crash canvas)

### Multi-Medium Output

- [x] **MMED-01**: Text/markdown nodes generated with properly formatted content
- [x] **MMED-02**: Code block nodes generated with language-tagged fenced code blocks
- [x] **MMED-03**: Mermaid diagram nodes generated using Obsidian's built-in Mermaid renderer
- [x] **MMED-04**: Mermaid rendering buffered until diagram is complete (no mid-stream render)
- [x] **MMED-05**: Image generation triggered via Runware API with Riverflow 2.0 Pro model
- [x] **MMED-06**: Opus generates image prompts, Runware renders the image
- [x] **MMED-07**: Generated images saved to vault and displayed as file nodes on canvas
- [x] **MMED-08**: Image generation loading state visible (placeholder node while generating)
- [x] **MMED-09**: Each medium type has appropriate node sizing (code wider, images square, etc.)
- [x] **MMED-10**: AI-generated nodes visually distinguishable from user-created nodes (color/label)

### Taste Profile

- [x] **TAST-01**: Global taste profile stored as markdown or JSON file in vault
- [x] **TAST-02**: Taste profile includes fields: thinking style, tone, visual preference, depth
- [x] **TAST-03**: Taste profile injected into system prompt for every Claude API call
- [ ] **TAST-04**: Per-team-member profiles supported (each user has their own file)
- [x] **TAST-05**: Taste profile editable through settings UI or by editing the file directly
- [x] **TAST-06**: Structured separation of style (how to communicate) vs substance (what to communicate)
- [ ] **TAST-07**: Counter-sycophancy instructions in system prompt prevent taste profile from suppressing novelty

## v2 Requirements

### Advanced Spatial

- **ASPAT-01**: Peripheral context awareness (off-viewport nodes at lower detail)
- **ASPAT-02**: Edge/connection interpretation (semantic meaning from canvas edges)
- **ASPAT-03**: Cross-canvas context (reference other canvases in vault)

### Generation Enhancements

- **AGEN-01**: Generation history/audit trail
- **AGEN-02**: Custom system prompts per canvas
- **AGEN-03**: Model routing (Sonnet for simple text, Opus for complex multi-medium)
- **AGEN-04**: Batch undo for AI-generated nodes

### Distribution

- **DIST-01**: Plugin marketplace publishing
- **DIST-02**: One-click install via BRAT

## Out of Scope

| Feature | Reason |
|---------|--------|
| Modifying existing nodes | Violates user trust — AI extends, never overwrites original content |
| Real-time generation (every action) | Overwhelming, expensive, distracting — debounce is the right pattern |
| Chat interface on canvas | Breaks spatial metaphor — the canvas IS the interface |
| Manual node-by-node trigger | Already exists in other plugins, breaks auto-generation flow |
| Multi-model selection | Splits effort — Claude for reasoning, Riverflow for images, clear responsibilities |
| Real-time multiplayer | Massive complexity — async collaboration via shared vault is sufficient |
| Voice input | Out of scope — spatial metaphor is visual, not auditory |
| Canvas layout automation | Destroys spatial semantics — never move user-placed nodes |
| Mobile support | Desktop canvas only for v1 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUN-01 | Phase 1 | Complete |
| FOUN-02 | Phase 1 | Complete |
| FOUN-03 | Phase 1 | Complete |
| FOUN-04 | Phase 1 | Complete |
| FOUN-05 | Phase 1 | Complete |
| FOUN-06 | Phase 1 | Complete |
| FOUN-07 | Phase 1 | Complete |
| FOUN-08 | Phase 1 | Complete |
| FOUN-09 | Phase 1 | Complete |
| FOUN-10 | Phase 1 | Complete |
| FOUN-11 | Phase 1 | Complete |
| FOUN-12 | Phase 1 | Complete |
| FOUN-13 | Phase 1 | Complete |
| SPAT-01 | Phase 2 | Complete |
| SPAT-02 | Phase 2 | Complete |
| SPAT-03 | Phase 2 | Complete |
| SPAT-04 | Phase 2 | Complete |
| SPAT-05 | Phase 2 | Complete |
| SPAT-06 | Phase 2 | Complete |
| SPAT-07 | Phase 2 | Complete |
| SPAT-08 | Phase 2 | Complete |
| SPAT-09 | Phase 2 | Complete |
| SPAT-10 | Phase 2 | Complete |
| GENP-01 | Phase 3 | Complete |
| GENP-02 | Phase 3 | Complete |
| GENP-03 | Phase 3 | Complete |
| GENP-04 | Phase 3 | Complete |
| GENP-05 | Phase 3 | Complete |
| GENP-06 | Phase 3 | Complete |
| GENP-07 | Phase 3 | Complete |
| GENP-08 | Phase 3 | Complete |
| GENP-09 | Phase 3 | Complete |
| GENP-10 | Phase 3 | Complete |
| GENP-11 | Phase 3 | Complete |
| GENP-12 | Phase 3 | Complete |
| MMED-01 | Phase 3 | Complete |
| MMED-02 | Phase 4 | Complete |
| MMED-03 | Phase 4 | Complete |
| MMED-04 | Phase 4 | Complete |
| MMED-05 | Phase 4 | Complete |
| MMED-06 | Phase 4 | Complete |
| MMED-07 | Phase 4 | Complete |
| MMED-08 | Phase 4 | Complete |
| MMED-09 | Phase 3 | Complete |
| MMED-10 | Phase 3 | Complete |
| TAST-01 | Phase 3 | Complete |
| TAST-02 | Phase 3 | Complete |
| TAST-03 | Phase 3 | Complete |
| TAST-04 | Phase 5 | Pending |
| TAST-05 | Phase 5 | Complete |
| TAST-06 | Phase 5 | Complete |
| TAST-07 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 52 total
- Mapped to phases: 52
- Unmapped: 0

---
*Requirements defined: 2026-04-02*
*Last updated: 2026-04-02 after roadmap creation*
