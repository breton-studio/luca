# Feature Research

**Domain:** AI-powered spatial canvas / thinking partner (Obsidian plugin)
**Researched:** 2026-04-02
**Confidence:** MEDIUM-HIGH

## Competitive Landscape

Before categorizing features, here is a summary of what exists and where this project sits.

### Existing Obsidian Canvas AI Plugins

| Plugin | What It Does | Key Limitation |
|--------|-------------|----------------|
| **Augmented Canvas** | Ask GPT on a note, generate questions, create images. Linked notes form conversation history. | Manual trigger only (right-click menu). OpenAI-locked. No spatial awareness. |
| **Canvas LLM Extender** | Right-click a node, generates a new node using edge-connected nodes as context. | Alpha quality. Text nodes only. No proximity awareness -- uses edge connections, not spatial position. |
| **RabbitMap** | Infinite canvas with embedded AI chat nodes. Drag vault files onto chat for context. | Chat-centric, not generative. User must manually initiate every interaction. No auto-generation. |
| **Canvas LLM** | Canvas-like UI for LLM conversations with branching. | Conversation tool, not a thinking partner. No spatial interpretation. |
| **Caret** | Local-first LLM in Obsidian with canvas integration. | Focuses on local models. No spatial context reading. |
| **Cannoli** | No-code LLM scripting via canvas nodes and arrows. | Workflow automation tool, not ideation. Users build pipelines, not think spatially. |

**Key gap none of these fill:** No existing plugin reads spatial positioning as a semantic signal, auto-generates on idle, produces multi-medium output, or adapts to a user taste profile. This project is genuinely novel in the Obsidian ecosystem.

### Broader AI Canvas Tools

| Tool | Relevant Innovation | What They Miss |
|------|-------------------|----------------|
| **tldraw AI agents** | Dual-data approach (screenshot + structured shape data). Peripheral shape clustering for off-viewport awareness. Agent can read AND manipulate canvas. | SDK/platform, not end-user tool. No taste/style personalization. |
| **Microsoft Copilot Canvas** (leaked) | "AI Streaming" toggle for live generative content while working. Multi-model image generation. Auto-naming boards. | Enterprise/team focus. No spatial proximity interpretation. Not yet released. |
| **Jeda.ai** | Text-to-diagram/flowchart/mind-map generation. Multi-LLM selection. Sketch-to-structured-artifact conversion. | Web app, not integrated into a PKM tool. No idle-based auto-generation. |
| **Napkin AI** | Text-to-visual (diagrams, charts, infographics) from pasted text. Automatic context analysis. | One-shot generation, not continuous. No spatial canvas. Input is text, not spatial arrangement. |
| **Miro AI** | Sticky note clustering, board summarization, idea generation. | Collaboration-first, not thinking-first. No multi-medium generation. Manual triggers. |

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels broken or unusable.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Canvas event listening** | Core mechanic -- plugin must detect node create/edit/move/delete. Without this, nothing works. | MEDIUM | Obsidian has no official canvas API. Must use internal APIs (canvas.createTextNode, prototype proxy patterns from Enchanted Canvas). Fragile across Obsidian updates. |
| **Debounce-on-idle trigger (~3s)** | Users expect AI to respond after they pause, not on every keystroke or drag. Standard UX pattern for AI cost/spam control. | LOW | Well-understood pattern (setTimeout reset). Combine with requestIdleCallback for rendering. The 3s default should be configurable. |
| **Spatial context reading** | The entire value prop depends on reading node positions, content, and proximity. | MEDIUM | Read canvas JSON: extract node positions, dimensions, content. Compute proximity (Euclidean distance between node centers). Build spatial context object for the prompt. |
| **New node generation (text/markdown)** | Every existing canvas AI plugin generates text nodes. This is the minimum output. | MEDIUM | Use internal canvas.createTextNode(). Must compute placement position to avoid overlap. Stream content into node as it arrives. |
| **Intelligent node placement (no overlap)** | Generated nodes must not land on top of existing nodes. Users will immediately reject overlapping content. | MEDIUM | Implement bounding-box collision detection. Place new nodes in nearest available space relative to the action area. Simple quadrant-based placement works for v1. |
| **Streaming/progressive rendering** | Users expect to see content appear token-by-token, not wait for a complete response. Standard in every AI chat tool since 2023. | MEDIUM | Claude API supports SSE streaming. Create node first, then update its text content as deltas arrive via content_block_delta events. |
| **Settings UI (API key, basic config)** | Every Obsidian plugin with external services has a settings tab. | LOW | Standard Obsidian PluginSettingTab. Store API key for Claude, API key for Runware, debounce delay, enable/disable toggle. |
| **Enable/disable toggle** | Users must be able to turn off auto-generation without disabling the plugin entirely. Sometimes you just want to think without AI. | LOW | Global toggle in settings + command palette toggle. Show status in status bar. |
| **Generation indicator** | Users need to know when AI is "thinking" vs when canvas is idle. Without this, auto-generation feels unpredictable and broken. | LOW | Status bar indicator or subtle canvas overlay. Show "thinking..." state during API call. Clear when generation completes. |
| **Error handling and graceful degradation** | API failures, rate limits, network issues. Users expect these to be handled silently, not crash the plugin. | LOW | Retry with exponential backoff. Surface errors in status bar, not modal dialogs. Never break the canvas on API failure. |

### Differentiators (Competitive Advantage)

Features that no existing tool combines. These are the product's reason to exist.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Proximity-as-semantics interpretation** | No tool treats spatial proximity as meaning "these concepts are related" and distance as "degree of relationship." This turns the canvas from a layout tool into a thinking medium. | HIGH | Core innovation. Build a proximity graph from node positions. Nearby nodes = strong relationship. Distant nodes = weak/tangential. Clusters = conceptual groups. Feed this interpretation into the prompt as structured context. |
| **Multi-medium output (text, code, diagrams, images)** | Opus decides what medium to generate based on context. User writes about an API? Get a code block. Cluster of strategy nodes? Get a diagram. Abstract concept? Get an image. No manual medium selection. | HIGH | Requires carefully crafted system prompt that instructs Opus to choose medium. Text/code = direct node content. Diagrams = Mermaid syntax in a node (Obsidian renders Mermaid natively). Images = trigger Runware API with Riverflow 2.0 Pro, embed result. Each medium type needs its own placement and sizing logic. |
| **Taste profile system** | Users define their thinking style, aesthetic preferences, and depth expectations. All generation adapts. Two people get different outputs from the same canvas state. No other canvas AI tool does this. | MEDIUM | Store as markdown file or JSON in vault. Include in system prompt for every API call. Fields: thinking style (analytical/creative/pragmatic), tone (formal/casual/terse), visual preference (minimal/detailed/abstract), depth (surface/thorough/exhaustive). Per-team-member profiles. |
| **Context-aware medium selection** | Opus reads the spatial arrangement and content types already on the canvas to decide what to generate next. Surrounded by text notes? Maybe generate a diagram to break the pattern. Near code blocks? Generate tests or documentation. | HIGH | Part of the multi-medium system but deserves its own call-out. Requires the system prompt to include not just content but content-type metadata for surrounding nodes. Opus needs to reason about what's missing, not just what's present. |
| **Focus area detection** | When a user clusters nodes tightly in one area, that's the "focus." Generation should happen near that focus, not randomly. When nodes are spread, generation should bridge gaps. | MEDIUM | Detect clusters using spatial density analysis (simple: bounding box of recent activity; advanced: DBSCAN-like clustering). Use cluster center as generation anchor point. |
| **Automatic trigger (no manual invocation)** | Every existing Obsidian AI canvas plugin requires right-click or command to trigger generation. Auto-generation after idle makes AI feel like a collaborator, not a tool you summon. | LOW | The debounce mechanism itself is simple. The UX challenge is making auto-generation feel helpful rather than intrusive. Key: good placement, relevant content, and the ability to undo/dismiss. |
| **Spatial generation placement logic** | New nodes appear in contextually appropriate positions -- near related nodes, bridging gaps between clusters, extending a line of thought in the same direction. Not just "to the right of the last node." | HIGH | Requires spatial reasoning about existing layout. Options: extend the direction of recent node movement, place in the nearest open space adjacent to the action area, bridge two nearby clusters. Must avoid overlap. |
| **Image generation via Riverflow 2.0 Pro** | Integrated image generation for visual/abstract concepts. The AI decides when an image would be more valuable than text. | MEDIUM | Runware API integration. Opus generates the image prompt, sends to Runware with Riverflow 2.0 Pro model, receives image URL/data, creates a file node on the canvas. Need to handle async timing (image gen is slower than text). |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems. Deliberately NOT building these.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Modifying existing nodes** | "AI should improve what I already wrote." | Violates user trust. Users' original content is sacred. Rewriting nodes makes users feel the AI is overriding their thinking, not extending it. Creates undo/versioning nightmares. | Generate NEW nodes with improved/alternative content placed nearby. User can manually adopt if they want. |
| **Real-time generation (on every action)** | "AI should respond instantly to every change." | Overwhelming, expensive, distracting. Every keystroke or node drag triggers an API call. Generates noise. Costs explode. | Debounce-on-idle (3s default). Batch related actions. Generate once after user pauses. |
| **Conversation/chat interface on canvas** | "Add a chat panel for talking to the AI." | Turns a spatial thinking tool into yet another chatbot. Breaks the spatial metaphor. RabbitMap and Canvas LLM already do this. | The canvas IS the interface. Spatial arrangement is the "conversation." No chat panel needed. |
| **Node-by-node manual trigger** | "Let me right-click a node and ask AI about it." | Already exists in Augmented Canvas and Canvas LLM Extender. Not differentiated. Breaks the auto-generation flow. | Auto-generation reads all nearby context, not just one node. If users want to focus AI on one node, they isolate it spatially. |
| **Multi-model selection** | "Let me choose between GPT, Claude, Gemini per generation." | Adds UI complexity. Splits development effort. Taste profiles become model-dependent. The value prop is Claude Opus 4.6 as a thinking partner, not "generic AI." | Claude Opus 4.6 exclusively for reasoning. Riverflow 2.0 Pro exclusively for images. Two APIs, clear responsibilities. |
| **Real-time multiplayer / live cursors** | "Multiple people editing the canvas simultaneously." | Massive complexity for v1. Conflict resolution between human edits and AI generation. Out of scope per PROJECT.md. | Async collaboration: shared vault, each person's taste profile. Canvas syncs through Obsidian Sync or git. |
| **Voice input** | "Talk to the AI instead of typing." | Out of scope per PROJECT.md. Adds speech-to-text dependency. Spatial metaphor is visual, not auditory. | Text and spatial interaction only. |
| **Plugin marketplace publishing** | "Publish to the Obsidian community plugin store." | Adds review process, compatibility requirements, documentation burden. Internal tool for a small team. | Distribute via manual install or BRAT. Revisit after v1 validation. |
| **Canvas layout automation** | "Auto-arrange all my nodes into a tidy grid/tree." | Destroys the spatial semantics the user created. The whole point is that position = meaning. Auto-layout erases that meaning. | Only auto-place AI-generated nodes. Never move user-placed nodes. |
| **Undo/version history for generated nodes** | "Let me roll back AI generations." | Complex state management. Obsidian has undo for text edits but canvas undo is limited. Building custom undo adds significant complexity. | Generated nodes get a visual indicator (color/label). User can simply delete unwanted generations. Keep generation simple and disposable. |

---

## Feature Dependencies

```
[Canvas Event Listening]
    |
    +--requires--> [Debounce-on-Idle Trigger]
    |                  |
    |                  +--requires--> [Spatial Context Reading]
    |                                     |
    |                                     +--requires--> [Proximity Graph Construction]
    |                                     |                  |
    |                                     |                  +--enables--> [Focus Area Detection]
    |                                     |                  +--enables--> [Context-Aware Medium Selection]
    |                                     |
    |                                     +--requires--> [Claude API Integration]
    |                                                        |
    |                                                        +--enables--> [Text/Markdown Generation]
    |                                                        +--enables--> [Code Block Generation]
    |                                                        +--enables--> [Mermaid Diagram Generation]
    |                                                        +--enables--> [Image Prompt Generation]
    |                                                                          |
    |                                                                          +--requires--> [Runware API Integration]
    |
    +--parallel-----> [Settings UI / API Key Management]
    +--parallel-----> [Enable/Disable Toggle]
    +--parallel-----> [Generation Indicator]

[Taste Profile System]
    +--enhances--> [Claude API Integration] (injected into system prompt)
    +--independent (can be built in any phase after settings UI)

[Streaming/Progressive Rendering]
    +--enhances--> [Text/Markdown Generation]
    +--enhances--> [Code Block Generation]
    +--independent of medium selection logic

[Intelligent Node Placement]
    +--requires--> [Spatial Context Reading] (needs to know where nodes already are)
    +--required-by--> all generation features (every generated node needs placement)

[Focus Area Detection]
    +--enhances--> [Intelligent Node Placement] (tells placement logic WHERE to generate)
    +--enhances--> [Spatial Context Reading] (enriches the context sent to Opus)
```

### Dependency Notes

- **Canvas Event Listening is the foundation:** Everything depends on being able to detect user actions on the canvas. This must work first.
- **Spatial Context Reading gates all generation:** Until the plugin can read positions and build a proximity model, no generation feature can work properly.
- **Intelligent Node Placement is required by all output types:** Every generated node (text, code, diagram, image) needs placement logic. Build this before expanding medium types.
- **Taste Profile is independently valuable:** Can be added to any generation feature at any time by modifying the system prompt. Does not block other features.
- **Image generation has an extra dependency:** Requires both Claude (for deciding when to generate an image and crafting the prompt) AND Runware (for actual generation). This is the longest dependency chain.
- **Streaming enhances but doesn't block:** Generation works without streaming (just slower UX). Can be added as a polish layer.

---

## MVP Definition

### Launch With (v1.0)

Minimum viable product -- what's needed to validate the core concept that spatial AI auto-generation is useful.

- [ ] **Canvas event listening** -- detect node create, edit, move, delete via internal API
- [ ] **Debounce-on-idle (3s default, configurable)** -- trigger generation after user pauses
- [ ] **Spatial context reading** -- read all node positions, content, and compute proximity relationships
- [ ] **Proximity graph construction** -- build a structured context of "what's near what" for the prompt
- [ ] **Claude API integration with streaming** -- send spatial context, receive streamed response
- [ ] **Text/markdown node generation** -- create new text nodes from Opus output
- [ ] **Intelligent node placement** -- collision-free placement near the action area
- [ ] **Basic taste profile** -- markdown file in vault, included in system prompt
- [ ] **Settings UI** -- API keys (Claude + Runware), debounce delay, enable/disable
- [ ] **Generation indicator** -- status bar showing thinking/idle state
- [ ] **Enable/disable toggle** -- command palette + status bar

### Add After Validation (v1.x)

Features to add once core auto-generation is validated as useful.

- [ ] **Code block generation** -- Opus detects technical context and generates code nodes; trigger: users working with technical content on canvas
- [ ] **Mermaid diagram generation** -- Opus generates Mermaid syntax nodes for structured visuals; trigger: users request or context suggests structural relationships
- [ ] **Image generation (Riverflow 2.0 Pro)** -- Opus crafts image prompts, Runware generates; trigger: users work with abstract/visual concepts
- [ ] **Context-aware medium selection** -- Opus decides text vs code vs diagram vs image per generation; trigger: multi-medium pipeline is stable
- [ ] **Focus area detection** -- density-based cluster detection to guide generation placement; trigger: users work with large, complex canvases
- [ ] **Per-team-member taste profiles** -- each person gets their own profile; trigger: team actually uses the tool

### Future Consideration (v2+)

Features to defer until the product is validated and stable.

- [ ] **Peripheral context awareness** -- include off-viewport nodes at lower detail (a la tldraw's PeripheralShapeCluster pattern); reason to defer: v1 can read the full canvas JSON regardless of viewport
- [ ] **Edge/connection interpretation** -- use canvas edges (not just proximity) as relationship signals; reason to defer: proximity alone may be sufficient
- [ ] **Generation history/audit trail** -- track what was generated, when, from what context; reason to defer: complexity, unclear user need
- [ ] **Cross-canvas context** -- read related canvases or vault notes as additional context; reason to defer: scope explosion
- [ ] **Custom system prompts per canvas** -- different canvases get different AI personalities; reason to defer: taste profile handles most of this

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Canvas event listening | HIGH | MEDIUM | P1 |
| Debounce-on-idle trigger | HIGH | LOW | P1 |
| Spatial context reading | HIGH | MEDIUM | P1 |
| Proximity graph construction | HIGH | MEDIUM | P1 |
| Claude API integration + streaming | HIGH | MEDIUM | P1 |
| Text/markdown node generation | HIGH | MEDIUM | P1 |
| Intelligent node placement | HIGH | MEDIUM | P1 |
| Generation indicator | MEDIUM | LOW | P1 |
| Enable/disable toggle | MEDIUM | LOW | P1 |
| Settings UI | MEDIUM | LOW | P1 |
| Basic taste profile | HIGH | LOW | P1 |
| Code block generation | MEDIUM | LOW | P2 |
| Mermaid diagram generation | MEDIUM | MEDIUM | P2 |
| Image generation (Runware) | MEDIUM | MEDIUM | P2 |
| Context-aware medium selection | HIGH | HIGH | P2 |
| Focus area detection | MEDIUM | MEDIUM | P2 |
| Per-team-member profiles | LOW | LOW | P2 |
| Peripheral context awareness | LOW | MEDIUM | P3 |
| Edge/connection interpretation | LOW | LOW | P3 |
| Generation history | LOW | MEDIUM | P3 |
| Cross-canvas context | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for launch -- validates the core concept
- P2: Should have, add after core validation
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | Augmented Canvas | Canvas LLM Extender | tldraw AI | Copilot Canvas | Jeda.ai | **Our Approach** |
|---------|-----------------|---------------------|-----------|----------------|---------|-----------------|
| Trigger mechanism | Manual (right-click) | Manual (right-click) | Manual (button) | AI Streaming toggle | Manual (prompt) | **Auto on idle (3s debounce)** |
| Spatial awareness | None | Edge-connected nodes only | Screenshot + structured data | Unknown | None | **Proximity graph from positions** |
| Multi-medium output | Text + images | Text only | HTML/code via Make Real | Text + images + diagrams | Text + diagrams | **Text, code, Mermaid, images** |
| Style personalization | None | None | None | None | None | **Taste profile per user** |
| Medium selection | User chooses | Always text | User chooses | Unknown | User chooses | **AI decides based on context** |
| Streaming | No | No | No | Yes (leaked) | No | **Yes, progressive rendering** |
| Obsidian-native | Yes | Yes | No (standalone) | No (Microsoft) | No (web app) | **Yes** |
| Node placement logic | Below original node | New node via edge | Agent-controlled | Unknown | Template-based | **Collision-free, proximity-aware** |

---

## Sources

### Obsidian Plugins
- [Augmented Canvas](https://github.com/MetaCorp/obsidian-augmented-canvas) -- OpenAI-based canvas AI, manual triggers
- [Canvas LLM Extender](https://github.com/Phasip/obsidian-canvas-llm-extender) -- edge-connected context generation
- [RabbitMap](https://github.com/bayradion/rabbitmap) -- AI chat nodes on canvas
- [Enchanted Canvas](https://github.com/borolgs/enchanted-canvas) -- internal canvas API patterns (prototype proxy)
- [Advanced Canvas](https://github.com/Developer-Mike/obsidian-advanced-canvas) -- canvas enhancement patterns
- [Obsidian Canvas Plugins](https://www.obsidianstats.com/tags/canvas) -- full list of canvas plugins

### Spatial AI Tools
- [tldraw AI Docs](https://tldraw.dev/docs/ai) -- three AI integration patterns, dual-data approach
- [tldraw Agent Starter Kit](https://tldraw.dev/starter-kits/agent) -- agent implementation details
- [Copilot Canvas Leak](https://www.windowslatest.com/2026/03/01/microsofts-copilot-canvas-leak-reveals-an-ai-powered-whiteboard-with-image-generation-ai-streaming-and-more/) -- AI streaming, multi-model image gen
- [Jeda.ai Whiteboard](https://www.jeda.ai/ai-whiteboard) -- text-to-diagram, multi-LLM
- [Napkin AI](https://www.napkin.ai) -- text-to-visual generation

### Technical References
- [JSON Canvas Spec 1.0](https://jsoncanvas.org/spec/1.0/) -- canvas file format
- [Obsidian Canvas API Types](https://github.com/obsidianmd/obsidian-api/blob/master/canvas.d.ts) -- TypeScript definitions
- [Obsidian Forum: Canvas API Discussion](https://forum.obsidian.md/t/any-details-on-the-canvas-api/57120) -- internal API access patterns
- [Claude Streaming API](https://platform.claude.com/docs/en/build-with-claude/streaming) -- SSE streaming implementation
- [React Flow Node Collisions](https://reactflow.dev/examples/layout/node-collisions) -- collision detection patterns
- [AI Whiteboard Comparison 2026](https://www.illumi.one/post/the-8-best-ai-whiteboards-for-brainstorming-mind-mapping-2026) -- market landscape
- [Spotify Taste Profile](https://newsroom.spotify.com/2026-03-13/taste-profile-beta-announcement/) -- taste personalization as a product pattern

---
*Feature research for: Obsidian Canvas AI Plugin*
*Researched: 2026-04-02*
