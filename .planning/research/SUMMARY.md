# Project Research Summary

**Project:** Obsidian Canvas AI
**Domain:** AI-powered spatial canvas plugin (Obsidian, desktop)
**Researched:** 2026-04-02
**Confidence:** MEDIUM-HIGH

## Executive Summary

Obsidian Canvas AI is a genuinely novel product in the Obsidian ecosystem. No existing plugin reads spatial positioning as a semantic signal, auto-generates content on idle, produces multi-medium output (text, code, diagrams, images), or adapts to a user taste profile. The competitive landscape includes manual-trigger canvas AI plugins (Augmented Canvas, Canvas LLM Extender) and broader AI canvas tools (tldraw, Jeda.ai, Miro AI), but none combine all four capabilities. The technical foundation is solid: the Obsidian plugin API, Anthropic TypeScript SDK, and Runware JS SDK are all well-documented and production-ready. The recommended stack follows established Obsidian community patterns (esbuild, TypeScript, monkey-around for canvas event interception).

The primary technical risk is the undocumented Canvas internal API. Obsidian provides no official programmatic canvas API -- all node creation, event detection, and spatial manipulation relies on reverse-engineered internal methods that can break on any Obsidian update. This is a known, accepted risk across the entire Obsidian canvas plugin ecosystem (Advanced Canvas, Canvas Presentation, Canvas MindMap all use the same approach). The mitigation is a thin Canvas Adapter Layer built in Phase 1 that isolates all internal API access behind a stable interface, with a file-based JSON fallback. The second major risk is cost: auto-triggered Opus calls at 20-40 generations per hour can reach $12-50/day per user without prompt caching and token budgets. These must be built into the LLM integration from the start.

The recommended architecture is a layered pipeline: Canvas Observer detects events and debounces, Spatial Awareness Engine reads positions and builds proximity context, LLM Pipeline orchestrates Claude with streaming, and Canvas Renderer places nodes collision-free. This maps cleanly to a 5-phase build order dictated by dependency chains: Foundation (plugin shell + canvas adapter), Spatial Intelligence (proximity analysis), Text Generation (core value loop), Multi-Medium Expansion (code, diagrams, images), and Polish (taste profiles, streaming refinement, cost optimization).

## Key Findings

### Recommended Stack

The stack is anchored by the official Obsidian plugin pattern: TypeScript + esbuild, with `obsidian` as a dev dependency for types. The two external API integrations -- `@anthropic-ai/sdk` for Claude and `@runware/sdk-js` for Runware image generation -- are bundled into the plugin (not external). Canvas event interception uses `monkey-around` (npm package, used by major canvas plugins) and `obsidian-typings` for typed access to undocumented internals. See [STACK.md](./STACK.md) for full configuration including esbuild config, tsconfig, and package.json.

**Core technologies:**
- **Obsidian Plugin API** (`obsidian` ^1.12.3): plugin lifecycle, vault I/O, workspace events -- non-negotiable
- **Anthropic SDK** (`@anthropic-ai/sdk` ^0.82.0): Claude Opus 4.6 with SSE streaming -- must use `dangerouslyAllowBrowser: true` in Electron context
- **Runware SDK** (`@runware/sdk-js` ^1.2.3): WebSocket-based image generation with Riverflow 2.0 Pro -- lazy initialization to avoid unnecessary connections
- **monkey-around** (3.0.0, exact pin): safe monkey-patching for canvas event interception -- community-proven pattern
- **obsidian-typings** (^4.88.0): type definitions for undocumented canvas internals -- may drift between Obsidian versions
- **esbuild** (^0.24): bundler following official Obsidian sample plugin -- do NOT use webpack/vite/rollup

**Critical streaming note:** Obsidian's built-in `requestUrl()` does NOT support streaming. The Anthropic SDK must use Node.js fetch directly in Electron's Node context. This is desktop-only, which aligns with v1 scope.

### Expected Features

See [FEATURES.md](./FEATURES.md) for the full competitive analysis and dependency graph.

**Must have (table stakes):**
- Canvas event listening (node create/edit/move/delete via internal API)
- Debounce-on-idle trigger (3s default, configurable)
- Spatial context reading (positions, content, proximity relationships)
- Claude API integration with streaming (progressive token rendering)
- Text/markdown node generation with collision-free placement
- Settings UI (API keys, debounce delay, enable/disable)
- Generation indicator (status bar showing thinking/idle)
- Enable/disable toggle (command palette + status bar)

**Should have (differentiators -- the reason this product exists):**
- Proximity-as-semantics interpretation (spatial position = conceptual relationship)
- Multi-medium output (text, code, Mermaid diagrams, images) with AI-driven medium selection
- Taste profile system (markdown file in vault, shapes tone/style/depth of all output)
- Focus area detection (density-based clustering to guide placement)
- Image generation via Riverflow 2.0 Pro (Runware, triggered when AI decides visual output is appropriate)

**Defer (v2+):**
- Peripheral context awareness (off-viewport nodes at lower detail)
- Edge/connection interpretation (proximity alone likely sufficient for v1)
- Generation history/audit trail
- Cross-canvas context
- Custom system prompts per canvas

### Architecture Approach

A layered pipeline with six components communicating through the plugin shell. The architecture separates observation (Canvas Observer), analysis (Spatial Awareness Engine), generation (LLM Pipeline + Image Generator), and rendering (Canvas Renderer), with shared services (API clients, taste profile, state management) underneath. The dual-strategy pattern -- internal canvas API for real-time interaction with file-based JSON fallback -- is critical for resilience against Obsidian updates. See [ARCHITECTURE.md](./ARCHITECTURE.md) for full component design, data flow, and code patterns.

**Major components:**
1. **Canvas Observer** -- hooks into canvas events via monkey-patching, manages debounce timer, detects user idle
2. **Spatial Awareness Engine** -- reads canvas state, computes proximity graph, identifies clusters and focus areas, generates spatial narrative for the LLM prompt
3. **LLM Pipeline** -- orchestrates Claude API calls with spatial context + taste profile, parses multi-medium response blocks, routes to appropriate renderer
4. **Image Generator** -- manages Runware SDK WebSocket connection, translates Claude's image descriptions into API calls
5. **Canvas Renderer** -- creates new nodes at computed positions, handles progressive text rendering during streaming, manages collision-free placement
6. **Canvas Adapter** -- thin wrapper isolating all undocumented canvas API access behind a stable interface with file-based fallback

### Critical Pitfalls

See [PITFALLS.md](./PITFALLS.md) for the full analysis including recovery strategies and phase mapping.

1. **Undocumented Canvas API breaks on Obsidian updates** -- Build a Canvas Adapter Layer in Phase 1 that wraps every internal API call behind a single interface. Guard all access with try/catch and existence checks. Maintain a file-based fallback.
2. **requestSave race condition corrupts canvas state** -- Never use `vault.modify()` on a canvas file while it is open. Use the in-memory canvas object methods and `canvas.requestSave()`. The 2-second debounce window after any user edit silently overwrites programmatic file writes.
3. **Runaway API costs from auto-triggered LLM calls** -- Implement token budget system (daily/hourly caps), prompt caching for system prompt (saves 50-70% on input), send only changed + nearby nodes (not entire canvas), set `max_tokens` on every call.
4. **Canvas performance collapse under AI-generated node volume** -- Obsidian lags at 120-140 nodes. Implement node budget (max AI-generated nodes), generation throttle based on canvas size, lightweight content preference.
5. **Debounce race conditions with stale context** -- Use AbortController to cancel in-flight requests when new debounce fires. Assign generation epochs. Re-validate placement positions before rendering responses.
6. **Streaming layout thrash** -- Pre-allocate node dimensions before streaming begins. Buffer rendering updates to 200-300ms intervals. Reserve placement space for all planned nodes upfront.
7. **Taste profile sycophancy amplification** -- Separate style (tone, formatting) from substance (opinions) in the profile. Include counter-sycophancy instructions in system prompt. Add occasional "surprise me" factor.

## Implications for Roadmap

Based on research, the dependency chain and pitfall analysis strongly suggest a 5-phase build order.

### Phase 1: Foundation

**Rationale:** Everything depends on the plugin skeleton and reliable canvas interaction. The two most dangerous pitfalls (undocumented API breakage and requestSave race condition) must be solved first. No generation feature can work without stable canvas read/write.

**Delivers:** Working Obsidian plugin with settings UI, Canvas Adapter Layer (dual-strategy: internal API + file fallback), canvas event detection via monkey-patching, debounce-on-idle trigger, and enable/disable toggle.

**Addresses features:** Canvas event listening, debounce-on-idle trigger, settings UI, enable/disable toggle, generation indicator (skeleton).

**Avoids pitfalls:** Undocumented Canvas API (#1), requestSave race condition (#2). The adapter layer is the single most important defensive architecture decision.

### Phase 2: Spatial Intelligence

**Rationale:** Before any LLM integration, the plugin needs meaningful spatial context to send. The Spatial Awareness Engine is pure computation (no external dependencies) and can be tested independently with mock canvas data. Building this before the LLM pipeline ensures the first generation attempt sends rich, structured context.

**Delivers:** Proximity graph construction, cluster detection, focus area identification, spatial narrative generation for LLM prompts.

**Addresses features:** Spatial context reading, proximity graph construction, focus area detection (basic).

**Avoids pitfalls:** Ensures context sent to Claude is scoped (nearby nodes, not entire canvas), which mitigates cost pitfall (#3) from the start.

### Phase 3: Core Generation Loop

**Rationale:** This is the core value proposition -- the minimum viable experience. Claude receives spatial context, generates text, and the plugin places it on the canvas with streaming. This phase closes the full loop: user acts -> debounce -> spatial analysis -> Claude -> new node appears.

**Delivers:** Claude API integration with streaming, text/markdown node generation, collision-free node placement, progressive rendering, basic taste profile (markdown file in vault injected into system prompt).

**Addresses features:** Claude API integration with streaming, text/markdown generation, intelligent node placement, basic taste profile, streaming/progressive rendering.

**Uses stack:** `@anthropic-ai/sdk` (streaming via Electron Node.js fetch), `zod` (response validation).

**Avoids pitfalls:** Debounce race conditions (#5) via AbortController and generation epochs. Streaming layout thrash (#6) via pre-allocated node dimensions. Cost controls (#3) via prompt caching and max_tokens.

### Phase 4: Multi-Medium Expansion

**Rationale:** With the text generation loop proven, extend to other media types. Code blocks and Mermaid diagrams are low-effort (still text nodes with markdown formatting). Image generation adds the Runware dependency but is architecturally independent and can be built incrementally.

**Delivers:** Code block generation, Mermaid diagram generation, image generation via Runware/Riverflow 2.0 Pro, context-aware medium selection (Claude decides text vs. code vs. diagram vs. image).

**Addresses features:** Code block generation, Mermaid diagram generation, image generation, context-aware medium selection, multi-medium output.

**Uses stack:** `@runware/sdk-js` (WebSocket-based, lazy initialization).

**Avoids pitfalls:** Canvas performance (#4) via node budget and lightweight content preference. Mermaid rendering should buffer until complete to avoid mid-stream diagram rendering freezes.

### Phase 5: Personalization and Polish

**Rationale:** Refinement layer on top of a working, multi-medium generation system. Taste profile enhancements, per-team-member profiles, generation UX polish, error handling hardening, and cost optimization (model routing: Sonnet for simple text, Opus for complex multi-medium decisions).

**Delivers:** Structured taste profile schema (beyond free-text markdown), per-team-member profiles, counter-sycophancy prompt engineering, batch undo for AI generations, visual distinction for AI-generated nodes, generation counter/cost awareness in UI, model routing for cost optimization.

**Addresses features:** Per-team-member taste profiles, structured taste profile, enhanced generation indicator, error handling hardening.

**Avoids pitfalls:** Taste profile sycophancy (#7) via structured style/substance separation and counter-sycophancy instructions.

### Phase Ordering Rationale

- **Phase 1 before anything:** Canvas adapter + event detection is the foundation. Two critical pitfalls live here. Every subsequent phase depends on stable canvas read/write.
- **Phase 2 before Phase 3:** Spatial context quality determines generation quality. Building spatial analysis before LLM integration ensures the first Claude call sends rich context, not a naive dump of all node text.
- **Phase 3 is the validation milestone:** If auto-generated text nodes from spatial context do not feel useful, the product concept fails. Validate here before investing in multi-medium expansion.
- **Phase 4 after Phase 3 validation:** Multi-medium (code, diagrams, images) adds complexity and a new external dependency (Runware). Only worth building after the core text generation loop is validated.
- **Phase 5 last:** Personalization and polish are force multipliers on a working system, not value on their own. Taste profile enhancements are independently addable at any point but have the most impact after all medium types work.

### Research Flags

**Phases likely needing deeper research during planning:**
- **Phase 1 (Canvas Adapter):** The undocumented canvas API is the highest-risk integration. Phase research should verify current internal API method signatures against the target Obsidian version, test monkey-patching patterns, and confirm the requestSave debounce behavior.
- **Phase 4 (Image Generation):** The exact Runware model ID (AIR code) for Riverflow 2.0 Pro needs verification at development time. The STACK.md lists `sourceful:2@3` but ARCHITECTURE.md flags LOW confidence on the exact ID. WebSocket connection lifecycle and credit handling need investigation.

**Phases with standard patterns (likely skip research-phase):**
- **Phase 2 (Spatial Intelligence):** Pure computation -- proximity graphs, clustering, bounding-box collision detection. Well-documented algorithms, no external dependencies.
- **Phase 3 (Core Generation):** Anthropic SDK streaming is well-documented with official examples. The prompt engineering will require iteration but not research.
- **Phase 5 (Polish):** Standard UX polish and prompt engineering iteration. No novel technical challenges.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Official Obsidian sample plugin pattern. Anthropic and Runware SDKs well-documented. Community consensus on esbuild, monkey-around, obsidian-typings. |
| Features | MEDIUM-HIGH | Strong competitive analysis confirms novelty. Feature dependencies well-mapped. MVP scope is clear. |
| Architecture | MEDIUM-HIGH | Layered pipeline is sound. Canvas internal API is well-understood by community plugins. Dual-strategy (internal API + file fallback) is proven. |
| Pitfalls | HIGH | Critical pitfalls verified via Obsidian forums, official docs, and community plugin source code. Cost and performance concerns backed by published data. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Exact Runware model ID for Riverflow 2.0 Pro:** STACK.md says `sourceful:2@3`, ARCHITECTURE.md says `civitai:618692@693048`. These need verification against the Runware dashboard during Phase 4 implementation.
- **Canvas internal API stability window:** Research confirms the API is undocumented, but does not quantify how often it breaks. During Phase 1, test against the last 3 Obsidian releases to establish a breakage frequency baseline.
- **Opus cost at scale:** The $12-50/day estimate is modeled but not empirically validated. Phase 3 should include a cost tracking mechanism and a real-usage cost assessment before the team scales up.
- **Node placement at non-default zoom levels:** PITFALLS.md flags that coordinate calculations may break at non-1x zoom. The Canvas Adapter in Phase 1 must account for canvas zoom and pan offsets in all position calculations.
- **Streaming pause bug:** The Anthropic SDK has a known issue where streaming text deltas can pause for 3+ minutes with no events. Phase 3 must implement a timeout watchdog with user-visible "still thinking..." feedback.

## Sources

### Primary (HIGH confidence)
- [Obsidian Plugin API Documentation](https://docs.obsidian.md/Home) -- plugin lifecycle, settings, event registration
- [Obsidian API Type Definitions](https://github.com/obsidianmd/obsidian-api) -- official TypeScript definitions
- [Canvas Type Definitions (canvas.d.ts)](https://github.com/obsidianmd/obsidian-api/blob/master/canvas.d.ts) -- official canvas JSON format
- [JSON Canvas Specification 1.0](https://jsoncanvas.org/spec/1.0/) -- canvas file format
- [Anthropic TypeScript SDK](https://github.com/anthropics/anthropic-sdk-typescript) -- streaming, configuration
- [Claude API Streaming Documentation](https://platform.claude.com/docs/en/build-with-claude/streaming) -- SSE patterns
- [Claude API Pricing](https://platform.claude.com/docs/en/about-claude/pricing) -- Opus 4.6 cost modeling
- [Runware JS SDK](https://github.com/Runware/sdk-js) -- image generation API
- [Runware Image Inference API](https://runware.ai/docs/image-inference/api-reference) -- model parameters
- [Obsidian Forum: requestUrl Streaming Limitation](https://forum.obsidian.md/t/support-streaming-the-request-and-requesturl-response-body/87381) -- confirmed limitation
- [Obsidian Forum: vault.modify vs requestSave Conflict](https://forum.obsidian.md/t/vault-process-and-vault-modify-dont-work-when-there-is-a-requestsave-debounce-event/107862) -- confirmed race condition

### Secondary (MEDIUM confidence)
- [Obsidian Advanced Canvas Plugin](https://github.com/Developer-Mike/obsidian-advanced-canvas) -- canvas event interception patterns
- [obsidian-typings](https://github.com/Fevol/obsidian-typings) -- community-maintained internal API types
- [obsidian-canvas-event-patcher](https://github.com/neonpalms/obsidian-canvas-event-patcher) -- monkey-patch approach for canvas events
- [tldraw AI Docs](https://tldraw.dev/docs/ai) -- dual-data approach, peripheral shape clustering
- [Augmented Canvas Plugin](https://github.com/MetaCorp/obsidian-augmented-canvas) -- competitive reference (manual trigger, OpenAI)
- [Canvas LLM Extender Plugin](https://github.com/Phasboidip/obsidian-canvas-llm-extender) -- competitive reference (edge-connected context)
- [Obsidian Forum: Canvas Performance Issues](https://forum.obsidian.md/t/canvas-sluggish-performance-issue-when-multiple-nodes-enter-exit-the-view/68609) -- lag at 120-140 nodes
- [LLM Personalization Sycophancy (MIT)](https://news.mit.edu/2026/personalization-features-can-make-llms-more-agreeable-0218) -- taste profile risk

### Tertiary (LOW confidence)
- [Riverflow 2.0 Pro Model ID](https://runware.ai/models/sourceful-riverflow-2-0-pro) -- exact AIR code needs verification at implementation time
- [Microsoft Copilot Canvas (leaked)](https://www.windowslatest.com/2026/03/01/microsofts-copilot-canvas-leak-reveals-an-ai-powered-whiteboard-with-image-generation-ai-streaming-and-more/) -- competitive signal, unreleased product

---
*Research completed: 2026-04-02*
*Ready for roadmap: yes*
