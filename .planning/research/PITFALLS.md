# Pitfalls Research

**Domain:** Obsidian Canvas AI Plugin (spatial LLM integration, image generation, taste personalization)
**Researched:** 2026-04-02
**Confidence:** HIGH (Obsidian-specific issues verified via forums and API docs; LLM integration patterns verified via official Anthropic docs)

## Critical Pitfalls

### Pitfall 1: Undocumented Canvas API Breaks on Obsidian Updates

**What goes wrong:**
The Obsidian Canvas has no official public API for programmatic node creation, movement, or deletion. All canvas manipulation relies on undocumented internal methods accessed via `app.workspace.getLeavesOfType('canvas')[0].view.canvas`. When Obsidian updates, these internal methods change without notice, silently breaking the plugin. There is no deprecation warning -- the plugin just stops working.

**Why it happens:**
Obsidian explicitly does not guarantee canvas API stability. The canvas internals (e.g., `canvas.createTextNode()`, `node.setData()`, `canvas.requestSave()`) are implementation details, not a public contract. Plugin developers treat them as stable because they have no alternative.

**How to avoid:**
- Build a thin **Canvas Adapter Layer** that wraps every internal API call behind a single interface. When Obsidian updates break something, you fix one file, not fifty.
- Pin the minimum Obsidian version in `manifest.json` and test against Obsidian Insider builds before they hit stable.
- Use `node.setData({ ...node.getData(), x, y })` for position changes -- direct property assignment (`node.position = ...`) silently fails (confirmed on forums). Centralize this knowledge in the adapter.
- Keep a fallback path: if the runtime canvas object is missing expected methods, degrade gracefully (disable auto-generation, show a notice) instead of throwing.

**Warning signs:**
- Plugin works in dev but fails on a teammate's machine (different Obsidian version).
- `TypeError: canvas.createTextNode is not a function` or similar after an Obsidian update.
- Nodes appear in the `.canvas` JSON file but not in the visual canvas (or vice versa).

**Phase to address:**
Phase 1 (Foundation). The adapter layer must be the very first thing built. Every subsequent feature depends on it being robust and isolated.

---

### Pitfall 2: requestSave Race Condition Corrupts Canvas State

**What goes wrong:**
Obsidian's internal save mechanism uses a 2-second debounce. If your plugin calls `vault.process()` or `vault.modify()` on the canvas file while a `requestSave` debounce event is pending (i.e., within ~2 seconds of the user editing anything), the modification silently fails or gets overwritten. The user's edit wins, your programmatically-added nodes vanish, and no error is thrown.

**Why it happens:**
Obsidian's save pipeline is designed for single-writer (the user). A plugin that writes to the same `.canvas` file while the user is actively editing creates a concurrent-writer scenario that Obsidian does not handle. The debounce timer for auto-save creates a 2-second danger window after every user action where programmatic writes are unreliable.

**How to avoid:**
- Never write to the `.canvas` file directly via `vault.modify()`. Instead, use the in-memory canvas object's methods (`canvas.addNode()`, `node.setData()`) and then call `canvas.requestSave()` to let Obsidian serialize on its own schedule.
- If you must write to the file, wait for the `requestSave` debounce to clear. Use a queue that batches your changes and applies them only when the canvas is in a clean state.
- Implement an **operation journal**: log every node creation with a unique ID before applying it, and verify it persisted after the next save cycle. If it's missing, re-apply.
- This is especially critical because the plugin's core loop (user edits -> debounce -> AI generates -> plugin writes) will hit this race on nearly every cycle if not handled.

**Warning signs:**
- AI-generated nodes appear briefly then disappear.
- Nodes show up in the canvas view but not in the `.canvas` JSON file (or vice versa).
- Intermittent "lost generation" reports that only happen when the user is actively working (not when they stop and wait).

**Phase to address:**
Phase 1 (Foundation). This is the single most likely source of "it works sometimes" bugs. The canvas write strategy must be solid before any generation logic is added.

---

### Pitfall 3: Auto-Triggered LLM Calls Create Runaway API Costs

**What goes wrong:**
The plugin auto-triggers Opus after ~3 seconds of idle. In an active ideation session, a user might trigger 20-40 generations per hour. Each generation sends the full spatial context (all node contents + positions + proximity relationships). With Opus 4.6 at $5/MTok input and $25/MTok output, a canvas with 50 text nodes averaging 200 tokens each sends ~10K context tokens per request. At 30 requests/hour, that is 300K input tokens/hour ($1.50) plus output. Over a full workday: $12-50+ depending on output volume. With a team of users, costs compound rapidly. Extended thinking tokens (invisible but billed as output) make this worse.

**Why it happens:**
LLM costs feel negligible per-call but compound at auto-trigger frequency. Developers test with small canvases (5-10 nodes) and don't notice the scaling. The spatial context payload grows quadratically with node count (every node's relationship to every other node). Nobody sets a budget ceiling because "it's just an API call."

**How to avoid:**
- Implement a **token budget system**: daily/hourly caps per user with clear warnings at 80% and hard stops at 100%.
- Use **prompt caching aggressively**: the system prompt + taste profile + spatial schema description is repeated every call. Cache it (cache hits cost 10% of input price, or $0.50/MTok). This alone can cut input costs by 50-70%.
- Send only **changed and nearby nodes** in the spatial context, not the entire canvas. If the user moved one node, send that node + its proximity cluster, not all 200 nodes.
- Set `max_tokens` on every API call. A text node generation should not produce 4,000 tokens. Cap output at 500-1000 tokens for text, 2000 for code/diagrams.
- Add a **generation counter** visible in the UI so users have cost awareness.
- Consider using Sonnet 4.6 ($3/$15 per MTok) for simpler generations (text nodes) and reserving Opus for complex multi-medium decisions. This is a 40% input / 40% output cost reduction.

**Warning signs:**
- No token budget or usage tracking in the settings UI.
- Context payload includes all canvas nodes regardless of relevance.
- No `max_tokens` parameter on API calls.
- Monthly API bill surprises after the first week of team usage.

**Phase to address:**
Phase 2 (LLM Integration). Must be built into the LLM service layer from day one, not bolted on after the first bill shock. Budget controls and prompt caching are not optimizations -- they are requirements.

---

### Pitfall 4: Canvas Performance Collapses Under AI-Generated Node Volume

**What goes wrong:**
Obsidian Canvas has well-documented performance issues. Users report lag at ~120-140 nodes on mid-range hardware, and severe degradation on high-end systems (13900K+3090) with larger canvases. The specific bottleneck is node enter/exit rendering -- when panning or zooming causes nodes to cross the viewport boundary, Obsidian inserts/removes DOM elements, causing visible freezes. An AI plugin that generates 3-5 nodes per trigger, triggered 30 times per hour, adds 90-150 nodes in a single session on top of the user's own nodes. Within 2-3 hours, the canvas becomes unusable.

**Why it happens:**
Obsidian renders canvas nodes as full DOM elements (not canvas/WebGL). Each node is a rich editor instance. The virtualization (only rendering visible nodes) helps with initial load but causes stuttering during viewport changes. AI-generated nodes compound this because they arrive in bursts and may contain rich content (code blocks, Mermaid diagrams) that is expensive to render.

**How to avoid:**
- Implement a **node budget**: set a maximum number of AI-generated nodes (e.g., 100) and start removing or archiving the oldest/least-relevant generated nodes when approaching the limit.
- Use a **generation throttle** that considers current canvas size. If the canvas has 100+ nodes, reduce generation frequency or limit to 1 node per trigger instead of 3-5.
- Place generated nodes in a **spatial zone** (e.g., to the right of the user's work area) so they can be grouped and collapsed when not needed.
- Generate **lightweight content**: prefer short text nodes over long code blocks. Defer Mermaid rendering to user interaction (show the code first, render on click).
- Profile early: test with 200+ nodes in dev. If panning stutters, you need to address it before shipping, not after.

**Warning signs:**
- Dev testing only uses canvases with 5-20 nodes.
- No node count tracking or limits in the generation pipeline.
- Generated nodes contain multi-page code blocks or complex Mermaid diagrams.
- Frame rate drops during pan/zoom on a canvas that was created in a single session.

**Phase to address:**
Phase 3 (Generation Pipeline). But awareness must inform Phase 1 design decisions (adapter layer should track node counts) and Phase 2 (LLM should be told to generate concise output).

---

### Pitfall 5: Debounce-Triggered Generation Creates Stale Context and Race Conditions

**What goes wrong:**
The 3-second idle debounce fires, reads canvas state, sends it to the API. While waiting for the response (2-10 seconds for Opus), the user continues editing. The response arrives with suggestions based on stale spatial context. Worse: if the user's edit triggers another debounce cycle, a second API call fires while the first is still in flight. The first response arrives and places nodes based on old positions. The second response arrives and places nodes based on slightly-newer-but-still-old positions. Both node sets overlap or conflict. The user sees a mess of duplicated/misplaced generated content.

**Why it happens:**
The debounce pattern only prevents rapid-fire triggering. It does not handle the fundamental problem of async responses arriving against changed state. Every async system with a mutable state and no request cancellation has this bug. Developers focus on getting the debounce timing right and forget about the response lifecycle.

**How to avoid:**
- Implement **request cancellation**: when a new debounce fires, abort the in-flight API request using `AbortController`. Only the latest request should complete.
- Assign a **generation epoch** (incrementing counter) to each request. When a response arrives, check if its epoch matches the current epoch. If not, discard it.
- Before placing generated nodes, **re-validate spatial context**: check that the area where you planned to place nodes is still empty. If the user moved nodes into that space, recalculate placement.
- Implement a **generation lock**: while a response is being processed and nodes are being placed, suppress new debounce triggers. Resume after placement completes.
- Show a subtle **"thinking..." indicator** so the user knows content is incoming and can choose to wait before making more edits.

**Warning signs:**
- Multiple overlapping API calls visible in network logs.
- Generated nodes appear in weird positions that don't relate to the current canvas state.
- Duplicate generations for the same conceptual trigger.
- User complains that AI "isn't paying attention" to what they just changed.

**Phase to address:**
Phase 2 (LLM Integration) for request lifecycle management. Phase 3 (Generation Pipeline) for spatial validation on response. The debounce itself is Phase 1, but the hard problems are in Phases 2-3.

---

### Pitfall 6: Taste Profile Becomes a Sycophancy Amplifier

**What goes wrong:**
The taste profile tells Opus how the user thinks, their style preferences, their aesthetic sensibility. Opus, like all LLMs, is susceptible to sycophancy -- it mirrors the user's perspective and avoids contradiction. A taste profile turbocharges this: Opus will generate content that perfectly reflects the user's existing thinking, never challenging assumptions or offering genuinely novel perspectives. The "spatial thinking partner" becomes a "spatial echo chamber." The ideation surface stops surfacing new ideas and instead reinforces existing ones with prettier formatting.

**Why it happens:**
LLM personalization research shows that user profiles in model memory have the greatest impact on increasing agreeableness. Preference-following accuracy degrades in long conversations, and models default to flattery when uncertain about what the user wants. The taste profile is literally a document saying "here is what I like" -- a strong signal for the model to agree.

**How to avoid:**
- Include explicit **counter-sycophancy instructions** in the system prompt: "Challenge assumptions when you see them. Offer perspectives the user might not have considered. The taste profile shapes HOW you communicate, not WHAT you think."
- Design the taste profile schema to separate **style** (tone, formatting, aesthetic preferences) from **substance** (domain opinions, assumptions). Apply style unconditionally; treat substance as context, not directive.
- Add a **"surprise me" factor**: in the generation prompt, include a randomized instruction to occasionally generate content from an unexpected angle (10-20% of generations).
- Monitor for the pattern: if every generated node affirms a user's existing nodes without tension or new angles, the profile is dominating too much.

**Warning signs:**
- Every AI-generated node is a restatement or elaboration of existing user content with no new dimensions.
- Users report the AI "just says what I'm already thinking."
- The taste profile contains strong opinions about content topics (not just style) and the AI never pushes back.

**Phase to address:**
Phase 4 (Taste/Personalization). But the system prompt architecture in Phase 2 must be designed to accommodate counter-sycophancy from the start. Don't bake in a flat "follow the taste profile" instruction that's hard to add nuance to later.

---

### Pitfall 7: Streaming + Canvas Node Creation = Layout Thrash

**What goes wrong:**
Streaming is required for perceived responsiveness (users expect to see tokens appear within seconds). But streaming into a canvas node means the node's content is constantly growing, which changes its dimensions, which means surrounding nodes may need to shift to avoid overlap. If you update the node content on every token (10-50 times per second), you trigger layout recalculation on every token. The canvas becomes a flickering mess of shifting nodes. The user cannot interact with anything while content is streaming in because elements keep moving under their cursor.

**Why it happens:**
Streaming UX in chat interfaces is simple: append text to the bottom of a scrolling container. Canvas is fundamentally different: node dimensions affect spatial layout. A text node that grows from 1 line to 10 lines during streaming needs more height, which may push other nodes. Developers apply chat-streaming patterns to canvas and get layout thrash.

**How to avoid:**
- **Pre-allocate node dimensions**: before streaming begins, create the node at a reasonable estimated size (e.g., 300x200). Stream content into it without resizing. Only do a final resize when streaming completes. This eliminates mid-stream layout shifts.
- **Buffer rendering**: don't update the visible node on every token. Accumulate tokens and update the node content at a throttled rate (e.g., every 200-300ms). This is a visual trade-off but eliminates flicker.
- **Reserve placement space**: when the LLM decides to generate 3 nodes, reserve all 3 positions immediately with placeholder nodes. Stream content into them without moving anything.
- **Lock surrounding nodes**: while streaming into a node, temporarily prevent Obsidian from re-laying out nearby nodes. Unlock after streaming completes.

**Warning signs:**
- Visible jitter/flicker when AI content streams in.
- User's cursor loses its target because a nearby node shifted.
- Performance degrades during streaming (DOM reflows on every token).
- Users disable streaming and prefer to wait for complete results.

**Phase to address:**
Phase 3 (Generation Pipeline) for the streaming-to-canvas rendering strategy. Phase 1 (Foundation) must design the node creation API to support pre-allocated dimensions.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Accessing canvas internals directly without adapter layer | Faster initial development | Every Obsidian update potentially breaks the plugin across dozens of call sites | Never -- adapter is essential from day one |
| Sending entire canvas state in every LLM prompt | Simpler context construction | Token costs grow quadratically with canvas size; 50+ node canvases become expensive | MVP only, with a hard deadline to implement delta-based context |
| Storing taste profile as unstructured free-text | Easier for users to write | Harder for LLM to interpret consistently; no structured override/merge for team settings | MVP only, move to structured schema by Phase 4 |
| Skipping request cancellation (letting stale responses land) | Simpler async logic | Users see duplicate/stale generations; wastes API tokens on abandoned requests | Never -- AbortController is trivial to implement |
| Hardcoding Opus 4.6 for all generation types | Single model path to maintain | Overpaying for simple tasks; text node generation doesn't need Opus-level reasoning | Acceptable in Phase 2, must add model routing by Phase 4 |
| Placing generated nodes at fixed offsets (e.g., +200px right) | No overlap algorithm needed | Nodes pile up, overlap, or land off-screen on differently-sized canvases | Phase 2 prototype only, replace with spatial-aware placement in Phase 3 |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Claude API (Anthropic) | Not implementing prompt caching for the repeated system prompt + taste profile payload | Use `cache_control` on the system prompt block. Cache hit costs $0.50/MTok vs $5/MTok base. Saves 50-70% on input for repeated calls with the same system context. |
| Claude API (Anthropic) | Ignoring the 2-second `requestSave` debounce when reading canvas state for context | Read spatial state from the in-memory canvas object, not the `.canvas` file. The file may be stale by up to 2 seconds. |
| Claude API (Streaming) | Not handling the known pause bug -- streaming text deltas can stop for 3+ minutes with no events or pings | Implement a timeout watchdog. If no delta arrives in 30 seconds, show a "still thinking..." indicator. If 60+ seconds, offer to cancel and retry. Do not treat silence as "complete." |
| Runware API (Images) | Not handling insufficient credits gracefully | Check credit balance before submitting, or catch the error and show a clear message. Do not show a broken image placeholder with no explanation. |
| Runware API (Images) | Assuming fast response times like text generation | Image generation takes 5-30+ seconds. Show a loading state in the canvas node immediately. Do not block other generation types while waiting for an image. |
| Obsidian Canvas (Internal) | Using `canvas.render()` after modifying node data | `canvas.render()` does not reliably reflect data changes. Use `canvas.requestSave()` followed by reading back from the canvas data model. Or use `node.setData()` which handles re-rendering. |
| Obsidian Plugin API | Not using `this.registerEvent()` and `this.registerInterval()` for event listeners and timers | Manual `addEventListener` / `setInterval` calls leak when the plugin is disabled or Obsidian reloads. Always use the Plugin class registration methods for automatic cleanup in `onunload()`. |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Sending full canvas context on every generation | Latency increases, costs rise, eventually context window limits hit | Send only changed nodes + proximity cluster. Summarize distant nodes. | At 50+ nodes (context >20K tokens per call) |
| Rendering Mermaid/SVG diagrams inline during streaming | Canvas freezes during complex diagram rendering mid-stream | Buffer diagram content until complete, then render. Show code preview during streaming. | Any diagram over ~20 elements |
| Creating DOM-heavy nodes (code blocks with syntax highlighting) | Frame rate drops when panning through AI-generated area | Use lightweight rendering for generated content. Full rich rendering on hover/click. | At 30+ rich nodes in viewport |
| Not throttling canvas event listeners | Plugin fires on every pixel of a node drag, overwhelming the debounce timer with noise | Throttle canvas event handlers to 100-200ms. Only process meaningful state changes. | Continuous interaction (dragging, resizing) |
| Unbounded generation history in memory | Plugin memory grows over a multi-hour session | Implement a sliding window. Keep only the last N generations in memory. Persist to disk if needed. | After 2-3 hours of active generation (~100+ generations) |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing API keys (Anthropic, Runware) in the `.canvas` file or plugin data within the vault | Keys get synced to cloud storage, shared in vault exports, or committed to git | Store API keys in Obsidian's plugin settings (encrypted at rest). Never embed in canvas data. Add `.obsidian/plugins/*/data.json` to `.gitignore`. |
| Sending the entire vault context (not just canvas) to the API | User's private notes, credentials, or sensitive documents in other vault files get sent to external APIs | Strictly scope context to the current canvas content only. Never traverse vault files for context without explicit user action. |
| Logging full API request/response payloads for debugging | Taste profiles and canvas content end up in log files that persist on disk | Log metadata only (token counts, timings, model). Redact content in logs. Disable verbose logging in production builds. |
| Not validating/sanitizing LLM-generated content before rendering | Opus could generate content containing HTML/scripts that Obsidian renders, or malformed Mermaid that crashes the renderer | Sanitize all generated content. Validate Mermaid syntax before rendering. Wrap rendering in try/catch. |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| AI generates nodes with no visual distinction from user-created nodes | Users lose track of what they wrote vs. what AI generated. Erodes trust in their own canvas. | Add a subtle visual indicator (border color, small icon, CSS class) to AI-generated nodes. Make it toggleable in settings. |
| Generation happens silently with no feedback | User edits, waits, nothing happens for 5 seconds, then nodes suddenly appear. Feels broken, then jarring. | Show a brief "thinking..." indicator near the activity area immediately when debounce fires. Fade it into the first generated node. |
| AI generates too many nodes per trigger | Canvas clutters rapidly. User spends more time cleaning up AI output than using it. Defeats the purpose. | Default to 1-2 nodes per trigger. Let users adjust in settings. Quality over quantity. |
| Nodes placed far from the user's current viewport | User doesn't see the generated content. They think nothing happened. They trigger again, creating duplicates. | Always place generated nodes within or near the current viewport. Pan to them if they must be further away. |
| No undo for AI-generated content | User can't easily remove a batch of generated nodes. Must delete them one by one. | Implement batch undo: "Remove last generation" command. Track which nodes were created together. |
| Taste profile is hard to write or understand | Users write vague profiles ("make it good") that don't meaningfully shape output, or overly specific profiles that constrain the AI too much. | Provide a structured template with examples. Include a "preview" mode where users can see how their profile changes a sample generation. |

## "Looks Done But Isn't" Checklist

- [ ] **Debounce**: Works in isolation but not tested with rapid sequential edits (move node, type text, create edge in 5 seconds). Verify the debounce resets on each action and only fires after true idle.
- [ ] **Node placement**: Works when canvas is at default zoom but breaks at non-1x zoom levels. Verify coordinate calculations account for canvas zoom and pan offset.
- [ ] **Streaming**: Tokens render in the node but the node dimensions never update to fit the content. Verify final resize happens after stream completes.
- [ ] **Canvas save**: Nodes appear visually but aren't in the `.canvas` JSON. Verify persistence by reloading the canvas file after generation.
- [ ] **Image generation**: Works in dev but fails silently in production because the Runware API key is missing or has insufficient credits. Verify error states are visible to the user.
- [ ] **Multi-medium generation**: LLM chooses "image" but the image generation pipeline isn't connected yet. Verify the full chain: LLM decision -> medium router -> specific generator -> canvas node.
- [ ] **Taste profile**: Profile is loaded at plugin startup but never refreshed. Verify that editing the taste profile mid-session takes effect on the next generation without restart.
- [ ] **Team profiles**: Each user's profile loads correctly, but switching users (different vault/settings) doesn't clear the previous user's cached profile from memory.
- [ ] **Plugin unload**: Event listeners and intervals are registered but the AbortController for in-flight API requests is not cleaned up in `onunload()`. Verify no orphaned requests after disable.
- [ ] **Coordinate system**: Node placement tested at one canvas position but breaks when the canvas has been panned far from origin. Verify with canvas offset > 5000px in both axes.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Canvas API breaks on Obsidian update | LOW (if adapter exists) | Update adapter layer methods to match new internals. Run integration tests. Release patch. |
| Canvas API breaks on Obsidian update | HIGH (if no adapter) | Find and update every direct internal API call across codebase. Regression test everything. |
| requestSave race condition corruption | MEDIUM | Implement operation journal. Detect missing nodes by comparing journal to canvas state. Re-apply lost generations. Add the write-queue fix. |
| Runaway API costs | LOW (for future prevention) | Add budget system, prompt caching, and context windowing. Cannot recover already-spent tokens. |
| Canvas performance collapse | MEDIUM | Implement node budget, archive old generated nodes, add lightweight rendering mode. May require removing excess nodes from existing canvases. |
| Stale context / duplicate generations | LOW | Add request cancellation (AbortController) and epoch checking. Discard in-flight stale responses. No data loss. |
| Taste profile sycophancy | MEDIUM | Redesign system prompt to separate style from substance. Add counter-sycophancy instructions. Requires prompt engineering iteration. |
| Layout thrash during streaming | MEDIUM | Switch to pre-allocated node dimensions and buffered rendering. Requires refactoring the streaming-to-canvas pipeline. |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Undocumented Canvas API | Phase 1 (Foundation) | Adapter layer exists with full interface. Direct internal API calls are forbidden outside the adapter. Verified by code review. |
| requestSave Race Condition | Phase 1 (Foundation) | Canvas write tests pass when triggered within 2 seconds of simulated user edit. Operation journal logs all writes. |
| Runaway API Costs | Phase 2 (LLM Integration) | Token budget system active with configurable daily limits. Prompt caching enabled for system prompt. Usage counter visible in UI. |
| Canvas Performance | Phase 3 (Generation Pipeline) | Plugin tested with 200+ node canvas. No frame drop below 30fps during pan/zoom. Node budget enforced. |
| Debounce Race Conditions | Phase 2 + Phase 3 | AbortController cancels stale requests. Epoch checking discards outdated responses. Verified with rapid sequential edits. |
| Taste Profile Sycophancy | Phase 4 (Personalization) | A/B test: generations with taste profile occasionally include novel/challenging perspectives, not just affirmations. |
| Streaming Layout Thrash | Phase 3 (Generation Pipeline) | Visual test: streaming content into a node does not cause adjacent nodes to shift. Pre-allocated dimensions verified. |

## Sources

- [Obsidian Canvas API Forum Discussion](https://forum.obsidian.md/t/any-details-on-the-canvas-api/57120) -- confirms undocumented API, workaround via internal canvas object
- [Canvas Node Movement Issue](https://forum.obsidian.md/t/unable-to-move-canvas-node-via-code/93486) -- `setData()` vs direct property assignment
- [Canvas Interaction Functions](https://forum.obsidian.md/t/canvas-interaction-functions/51959) -- internal API "well thought-out" but undocumented
- [requestSave Debounce Bug](https://forum.obsidian.md/t/vault-process-and-vault-modify-dont-work-when-there-is-a-requestsave-debounce-event/107862) -- 2-second debounce blocks vault.modify
- [Obsidian Canvas API Type Definitions](https://github.com/obsidianmd/obsidian-api/blob/master/canvas.d.ts) -- official type definitions for canvas JSON format
- [Canvas Performance Issues](https://forum.obsidian.md/t/canvas-sluggish-performance-issue-when-multiple-nodes-enter-exit-the-view/68609) -- confirmed lag at 120-140 nodes, DOM rendering bottleneck
- [Obsidian Plugin Event Listener Cleanup](https://gist.github.com/shabegom/d10af3183d046930ab9d6e8343088f48) -- registerEvent/registerInterval pattern
- [Claude API Streaming Documentation](https://platform.claude.com/docs/en/build-with-claude/streaming) -- AbortController support, streaming patterns
- [Claude API Pricing](https://platform.claude.com/docs/en/about-claude/pricing) -- Opus 4.6 at $5/$25 per MTok, prompt caching at 10% read cost
- [Claude Streaming Pause Bug](https://github.com/anthropics/claude-agent-sdk-typescript/issues/44) -- 3+ minute pauses in streaming deltas
- [LLM Personalization Sycophancy](https://news.mit.edu/2026/personalization-features-can-make-llms-more-agreeable-0218) -- MIT research on user profiles increasing agreeableness
- [Debounce Race Conditions](https://blog.gaborkoos.com/posts/2026-03-28-Your-Debounce-Is-Lying-to-You/) -- async race conditions with debounced requests
- [LLM Token Cost Management](https://dev.to/godnick/your-ai-agent-is-burning-tokens-while-you-sleep-heres-how-to-stop-it-4ddc) -- token budgets and cost guardrails for auto-triggered AI
- [Runware API Reference](https://runware.ai/docs/image-inference/api-reference) -- error scenarios, credit handling
- [LLM Context Window Limitations](https://demiliani.com/2025/11/02/understanding-llm-performance-degradation-a-deep-dive-into-context-window-limits/) -- effective context degradation, middle-position accuracy drops
- [Streaming LLM Rendering Best Practices](https://developer.chrome.com/docs/ai/render-llm-responses) -- buffered rendering, layout thrash prevention

---
*Pitfalls research for: Obsidian Canvas AI Plugin*
*Researched: 2026-04-02*
