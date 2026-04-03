# Requirements: Obsidian Canvas AI

**Defined:** 2026-04-02
**Core Value:** After any canvas action, Opus reads spatial context and generates relevant multi-medium content that feels like a natural extension of your thinking

## v1 Requirements

### Foundation

- [x] **FOUN-01**: Plugin loads in Obsidian and registers lifecycle hooks (onload/onunload)
- [x] **FOUN-02**: Canvas Adapter Layer wraps all undocumented canvas internal APIs behind a stable interface
- [x] **FOUN-03**: Canvas Adapter has file-based JSON fallback when internal APIs are unavailable
- [ ] **FOUN-04**: Plugin detects canvas node create events via monkey-patching
- [ ] **FOUN-05**: Plugin detects canvas node edit events via monkey-patching
- [ ] **FOUN-06**: Plugin detects canvas node move events via monkey-patching
- [ ] **FOUN-07**: Plugin detects canvas node delete events via monkey-patching
- [ ] **FOUN-08**: Debounce timer triggers generation after ~3s of user idle (configurable)
- [ ] **FOUN-09**: In-flight generation requests are cancelled when new debounce fires (AbortController)
- [x] **FOUN-10**: Settings UI with fields for Claude API key, Runware API key, and debounce delay
- [ ] **FOUN-11**: Enable/disable toggle accessible from command palette and status bar
- [ ] **FOUN-12**: Generation indicator in status bar shows thinking/idle/error state
- [x] **FOUN-13**: Canvas Adapter handles requestSave race condition (uses internal API, not vault.modify)

### Spatial Intelligence

- [ ] **SPAT-01**: Plugin reads all node positions, dimensions, and content from active canvas
- [ ] **SPAT-02**: Proximity graph computed from node positions (Euclidean distance between centers)
- [ ] **SPAT-03**: Nearby nodes interpreted as conceptually related (proximity-as-semantics)
- [ ] **SPAT-04**: Distant nodes interpreted as weakly related or tangential
- [ ] **SPAT-05**: Dense node clusters detected as focus areas (density-based analysis)
- [ ] **SPAT-06**: Spatial context serialized into structured narrative for LLM prompt
- [ ] **SPAT-07**: Only nearby/relevant nodes sent to Claude (not entire canvas) for cost efficiency
- [ ] **SPAT-08**: Generated nodes placed in contextually appropriate positions (extend direction, bridge gaps)
- [ ] **SPAT-09**: Collision-free placement using bounding-box detection (no overlapping nodes)
- [ ] **SPAT-10**: Placement accounts for canvas zoom and pan offsets

### Generation Pipeline

- [ ] **GENP-01**: Claude Opus 4.6 called via Anthropic SDK with SSE streaming
- [ ] **GENP-02**: Streaming uses Node.js fetch in Electron (not Obsidian requestUrl)
- [ ] **GENP-03**: Text content streams progressively into pre-allocated canvas nodes
- [ ] **GENP-04**: Streaming updates buffered to 200-300ms intervals to prevent layout thrash
- [ ] **GENP-05**: Node dimensions pre-allocated before streaming begins
- [ ] **GENP-06**: System prompt includes spatial context, taste profile, and medium selection instructions
- [ ] **GENP-07**: Opus decides which medium type(s) to generate based on canvas context
- [ ] **GENP-08**: Prompt caching enabled for system prompt to reduce input token costs
- [ ] **GENP-09**: Token budget system with configurable daily/hourly caps
- [ ] **GENP-10**: Budget exceeded state shown in UI, generation paused until reset
- [ ] **GENP-11**: Timeout watchdog detects streaming pauses >30s with user-visible feedback
- [ ] **GENP-12**: API errors handled gracefully (retry with backoff, surface in status bar, never crash canvas)

### Multi-Medium Output

- [ ] **MMED-01**: Text/markdown nodes generated with properly formatted content
- [ ] **MMED-02**: Code block nodes generated with language-tagged fenced code blocks
- [ ] **MMED-03**: Mermaid diagram nodes generated using Obsidian's built-in Mermaid renderer
- [ ] **MMED-04**: Mermaid rendering buffered until diagram is complete (no mid-stream render)
- [ ] **MMED-05**: Image generation triggered via Runware API with Riverflow 2.0 Pro model
- [ ] **MMED-06**: Opus generates image prompts, Runware renders the image
- [ ] **MMED-07**: Generated images saved to vault and displayed as file nodes on canvas
- [ ] **MMED-08**: Image generation loading state visible (placeholder node while generating)
- [ ] **MMED-09**: Each medium type has appropriate node sizing (code wider, images square, etc.)
- [ ] **MMED-10**: AI-generated nodes visually distinguishable from user-created nodes (color/label)

### Taste Profile

- [ ] **TAST-01**: Global taste profile stored as markdown or JSON file in vault
- [ ] **TAST-02**: Taste profile includes fields: thinking style, tone, visual preference, depth
- [ ] **TAST-03**: Taste profile injected into system prompt for every Claude API call
- [ ] **TAST-04**: Per-team-member profiles supported (each user has their own file)
- [ ] **TAST-05**: Taste profile editable through settings UI or by editing the file directly
- [ ] **TAST-06**: Structured separation of style (how to communicate) vs substance (what to communicate)
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
| FOUN-04 | Phase 1 | Pending |
| FOUN-05 | Phase 1 | Pending |
| FOUN-06 | Phase 1 | Pending |
| FOUN-07 | Phase 1 | Pending |
| FOUN-08 | Phase 1 | Pending |
| FOUN-09 | Phase 1 | Pending |
| FOUN-10 | Phase 1 | Complete |
| FOUN-11 | Phase 1 | Pending |
| FOUN-12 | Phase 1 | Pending |
| FOUN-13 | Phase 1 | Complete |
| SPAT-01 | Phase 2 | Pending |
| SPAT-02 | Phase 2 | Pending |
| SPAT-03 | Phase 2 | Pending |
| SPAT-04 | Phase 2 | Pending |
| SPAT-05 | Phase 2 | Pending |
| SPAT-06 | Phase 2 | Pending |
| SPAT-07 | Phase 2 | Pending |
| SPAT-08 | Phase 2 | Pending |
| SPAT-09 | Phase 2 | Pending |
| SPAT-10 | Phase 2 | Pending |
| GENP-01 | Phase 3 | Pending |
| GENP-02 | Phase 3 | Pending |
| GENP-03 | Phase 3 | Pending |
| GENP-04 | Phase 3 | Pending |
| GENP-05 | Phase 3 | Pending |
| GENP-06 | Phase 3 | Pending |
| GENP-07 | Phase 3 | Pending |
| GENP-08 | Phase 3 | Pending |
| GENP-09 | Phase 3 | Pending |
| GENP-10 | Phase 3 | Pending |
| GENP-11 | Phase 3 | Pending |
| GENP-12 | Phase 3 | Pending |
| MMED-01 | Phase 3 | Pending |
| MMED-02 | Phase 4 | Pending |
| MMED-03 | Phase 4 | Pending |
| MMED-04 | Phase 4 | Pending |
| MMED-05 | Phase 4 | Pending |
| MMED-06 | Phase 4 | Pending |
| MMED-07 | Phase 4 | Pending |
| MMED-08 | Phase 4 | Pending |
| MMED-09 | Phase 3 | Pending |
| MMED-10 | Phase 3 | Pending |
| TAST-01 | Phase 3 | Pending |
| TAST-02 | Phase 3 | Pending |
| TAST-03 | Phase 3 | Pending |
| TAST-04 | Phase 5 | Pending |
| TAST-05 | Phase 5 | Pending |
| TAST-06 | Phase 5 | Pending |
| TAST-07 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 52 total
- Mapped to phases: 52
- Unmapped: 0

---
*Requirements defined: 2026-04-02*
*Last updated: 2026-04-02 after roadmap creation*
