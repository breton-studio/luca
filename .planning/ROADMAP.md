# Roadmap: Obsidian Canvas AI

## Overview

This roadmap delivers an Obsidian plugin that turns the canvas into an AI-powered ideation surface. The build follows the dependency chain from stable canvas interaction (Phase 1), through spatial analysis (Phase 2), to the core text generation loop (Phase 3), multi-medium expansion (Phase 4), and finally taste profile personalization (Phase 5). Phase 3 is the validation milestone -- if auto-generated text nodes from spatial context don't feel useful, the product concept fails.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Plugin shell, canvas adapter, event detection, debounce, settings UI, and enable/disable controls
- [ ] **Phase 2: Spatial Intelligence** - Proximity graph, cluster detection, spatial narrative generation, and collision-free placement logic
- [ ] **Phase 3: Core Generation Loop** - Claude API streaming, text node generation, progressive rendering, basic taste profile, and cost controls
- [ ] **Phase 4: Multi-Medium Expansion** - Code blocks, Mermaid diagrams, and image generation via Runware/Riverflow 2.0 Pro
- [ ] **Phase 5: Taste Profile and Polish** - Per-team-member profiles, settings UI editing, style/substance separation, and counter-sycophancy

## Phase Details

### Phase 1: Foundation
**Goal**: Users can install and enable the plugin, configure API keys, and see it detecting their canvas actions in real time
**Depends on**: Nothing (first phase)
**Requirements**: FOUN-01, FOUN-02, FOUN-03, FOUN-04, FOUN-05, FOUN-06, FOUN-07, FOUN-08, FOUN-09, FOUN-10, FOUN-11, FOUN-12, FOUN-13
**Success Criteria** (what must be TRUE):
  1. Plugin loads in Obsidian without errors and appears in the community plugins list
  2. User can enter Claude API key, Runware API key, and debounce delay in a settings tab
  3. User can enable/disable the plugin from both the command palette and a status bar indicator
  4. Status bar shows current state (thinking/idle/error) and updates when the user acts on the canvas
  5. Creating, editing, moving, or deleting canvas nodes triggers a debounced idle timer visible in the status bar
**Plans**: 6 plans
Plans:
- [x] 01-01-PLAN.md -- Project scaffold, build toolchain, settings tab UI
- [x] 01-02-PLAN.md -- Canvas Adapter Layer with file-based fallback
- [x] 01-03-PLAN.md -- Status bar manager and per-canvas context menu
- [x] 01-04-PLAN.md -- Canvas event detection via monkey-patching
- [x] 01-05-PLAN.md -- Debounce controller and full event pipeline wiring
- [x] 01-06-PLAN.md -- Manual verification in live Obsidian

### Phase 2: Spatial Intelligence
**Goal**: The plugin understands canvas layout -- which nodes are near each other, where clusters exist, and where to place new content without overlapping existing nodes
**Depends on**: Phase 1
**Requirements**: SPAT-01, SPAT-02, SPAT-03, SPAT-04, SPAT-05, SPAT-06, SPAT-07, SPAT-08, SPAT-09, SPAT-10
**Success Criteria** (what must be TRUE):
  1. Plugin reads all node positions, dimensions, and content from the active canvas after each debounce trigger
  2. Nearby nodes are identified as related and distant nodes as weakly related (proximity-as-semantics)
  3. Dense clusters of nodes are detected as focus areas that attract generation placement
  4. Generated node positions are computed without overlapping any existing nodes, accounting for zoom and pan
**Plans**: 3 plans
Plans:
- [ ] 02-01-PLAN.md -- Spatial types, proximity graph, canvas edge reading, test fixtures
- [ ] 02-02-PLAN.md -- DBSCAN clustering and collision-free orbital placement
- [ ] 02-03-PLAN.md -- Context builder, narrative serialization, barrel export

### Phase 3: Core Generation Loop
**Goal**: After the user acts on the canvas and goes idle, Claude reads spatial context and a taste profile, then streams new text/markdown nodes that appear progressively near the action area -- closing the core value loop
**Depends on**: Phase 2
**Requirements**: GENP-01, GENP-02, GENP-03, GENP-04, GENP-05, GENP-06, GENP-07, GENP-08, GENP-09, GENP-10, GENP-11, GENP-12, MMED-01, MMED-09, MMED-10, TAST-01, TAST-02, TAST-03
**Success Criteria** (what must be TRUE):
  1. After ~3s of idle following a canvas action, a new text node begins appearing on the canvas with streamed content
  2. Generated nodes are visually distinguishable from user-created nodes (color or label)
  3. Content streams progressively into pre-sized nodes without layout thrash or overlapping
  4. A global taste profile (markdown file in vault) shapes the tone, style, and depth of all generated content
  5. Token budget system pauses generation when daily/hourly caps are exceeded, with a clear UI indication
**Plans**: TBD
**UI hint**: yes

### Phase 4: Multi-Medium Expansion
**Goal**: Claude decides whether to generate code blocks, Mermaid diagrams, or images based on canvas context, and each medium type renders correctly on the canvas
**Depends on**: Phase 3
**Requirements**: MMED-02, MMED-03, MMED-04, MMED-05, MMED-06, MMED-07, MMED-08
**Success Criteria** (what must be TRUE):
  1. Code blocks appear as properly language-tagged fenced code in canvas nodes when context calls for code
  2. Mermaid diagrams render using Obsidian's built-in renderer, buffered until the diagram is complete
  3. Images generated via Runware/Riverflow 2.0 Pro appear as file nodes on the canvas with a loading placeholder during generation
  4. Claude autonomously chooses the appropriate medium type(s) for each generation based on spatial context
**Plans**: TBD

### Phase 5: Taste Profile and Polish
**Goal**: Each team member has their own taste profile that shapes AI output to match their thinking style, with safeguards against sycophantic flattening of novelty
**Depends on**: Phase 3, Phase 4
**Requirements**: TAST-04, TAST-05, TAST-06, TAST-07
**Success Criteria** (what must be TRUE):
  1. Each team member can have their own taste profile file, and the plugin uses the active user's profile for generation
  2. Taste profile is editable through the settings UI or by editing the markdown/JSON file directly
  3. Style (how to communicate) and substance (what to communicate) are structurally separated in the profile
  4. Generated content occasionally challenges or surprises the user rather than only reinforcing existing patterns
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 0/6 | Planning complete | - |
| 2. Spatial Intelligence | 0/3 | Planning complete | - |
| 3. Core Generation Loop | 0/0 | Not started | - |
| 4. Multi-Medium Expansion | 0/0 | Not started | - |
| 5. Taste Profile and Polish | 0/0 | Not started | - |
