# Phase 3: Core Generation Loop - Research

**Researched:** 2026-04-03
**Domain:** LLM streaming into Obsidian canvas nodes, taste profile system, token budget management
**Confidence:** HIGH

## Summary

Phase 3 connects the spatial engine (Phase 2) to the Claude API and closes the core value loop: after idle, read spatial context, call Claude with streaming, and progressively render text into pre-allocated canvas nodes. The research covers four domains: (1) Anthropic SDK streaming patterns in Electron, (2) Canvas internal API for programmatic node creation and text updates, (3) Taste profile file format and system prompt composition, and (4) Token budget tracking.

The Anthropic TypeScript SDK v0.82.0 provides `client.messages.stream()` with the `.on('text', callback)` convenience handler, which is the recommended pattern for progressive text delivery. Canvas node creation uses the undocumented `canvas.createTextNode()` internal API, and text updates use `node.setText()` -- both verified by examining obsidian-typings v5.17.0 and two production plugins (obsidian-chat-stream, Obsidian-Canvas-Presentation). Prompt caching has a 4,096-token minimum for Opus, which the system prompt + taste profile should comfortably exceed.

**Primary recommendation:** Use `client.messages.stream()` with `.on('text')` handler, buffer tokens at 200-300ms, call `node.setText(accumulated)` on each flush, and `node.moveAndResize()` at completion to fit content. Use `canvas.createTextNode()` for pre-allocation.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Pre-allocate + stream -- create a sized empty node immediately at the computed placement position, then stream text progressively into it (~200-300ms buffer intervals). User sees the node appear instantly and fill up with content.
- **D-02:** 1-3 nodes per trigger, Claude decides based on canvas context. Multiple nodes use Phase 2's orbital placement to fan out.
- **D-03:** Sequential node streaming -- first node streams to completion, then the next node appears and begins streaming. Easier to follow and read.
- **D-04:** Subtle pulsing border on pre-allocated nodes while waiting for the first token. No placeholder text -- the status bar already shows "AI: thinking". Once tokens arrive, pulsing stops and content fills in.
- **D-05:** Inverse of default node color -- adaptive to theme. UI-SPEC resolved to canvas color preset "6" (typically purple/violet).
- **D-06:** Settings option to change AI node color and styling properties globally.
- **D-07:** No text label or content prefix -- color/styling only distinction.
- **D-08:** Taste profile: Markdown with YAML frontmatter format -- structured fields in frontmatter, freeform markdown body.
- **D-09:** Stored at `.obsidian/plugins/canvas-ai/taste-profile.md`.
- **D-10:** Seeded on first run with user's design philosophy (Swiss rational tradition).
- **D-11:** Daily token cap only -- single number in settings (e.g., 500K tokens/day). Resets at midnight. No hourly burst cap.
- **D-12:** Hard stop when budget exceeded + "Continue anyway" override button. Status bar shows "AI: budget".
- **D-13:** Token usage persisted in plugin's data.json via saveData(). Tracked: date, inputTokens, outputTokens, budgetOverride. Auto-resets when date changes.

### Claude's Discretion
- System prompt structure and wording
- Prompt caching strategy for system prompt (GENP-08)
- Exact pre-allocation node dimensions before streaming begins
- Timeout watchdog implementation details (GENP-11)
- API error retry strategy and backoff timing (GENP-12)
- How Claude decides between 1, 2, or 3 nodes per trigger
- Pulsing border animation CSS implementation
- Token counting approach (response headers vs manual counting)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GENP-01 | Claude Opus 4.6 called via Anthropic SDK with SSE streaming | SDK v0.82.0 `client.messages.stream()` with `.on('text')` handler. Verified via official docs. |
| GENP-02 | Streaming uses Node.js fetch in Electron (not requestUrl) | SDK supports custom `fetch` parameter. Electron's Node context provides native fetch. Set `dangerouslyAllowBrowser: true` as safety fallback. |
| GENP-03 | Text content streams progressively into pre-allocated canvas nodes | `canvas.createTextNode()` creates node, `node.setText(accumulated)` updates text. Verified in obsidian-chat-stream and obsidian-typings. |
| GENP-04 | Streaming updates buffered to 200-300ms intervals | Timer-based buffer accumulating text deltas, flushing to `node.setText()` at interval. Standard pattern. |
| GENP-05 | Node dimensions pre-allocated before streaming begins | `createTextNode({ pos, size, text: '', focus: false })` creates correctly sized empty node. |
| GENP-06 | System prompt includes spatial context, taste profile, medium instructions | Compose system prompt array with spatial narrative (Phase 2), taste profile content, and generation instructions. |
| GENP-07 | Opus decides which medium type(s) based on context | System prompt instructs Claude to output structured response with medium type tags. Phase 3 handles text/markdown only; code/mermaid/image deferred to Phase 4. |
| GENP-08 | Prompt caching enabled for system prompt | Use `cache_control: { type: "ephemeral" }` on system prompt blocks. Opus requires 4,096 token minimum. System prompt + taste profile should exceed this. |
| GENP-09 | Token budget system with configurable daily cap | Track tokens from `stream.finalMessage().usage`. Persist in data.json with date-based auto-reset. |
| GENP-10 | Budget exceeded state shown in UI, generation paused | Add "budget" state to StatusBarManager. Show persistent Notice. Check budget before generation. |
| GENP-11 | Timeout watchdog detects streaming pauses >30s | Reset timer on each text delta. If 30s passes without delta, abort stream and show error. |
| GENP-12 | API errors handled gracefully (retry with backoff) | SDK has built-in retry (2 retries by default). Supplement with custom error handling for 401, 429, 500+. |
| MMED-01 | Text/markdown nodes generated with properly formatted content | Claude outputs markdown. `node.setText()` accepts markdown strings. Obsidian renders markdown in canvas text nodes. |
| MMED-09 | Each medium type has appropriate node sizing | Text nodes: 300x200 default (matches Phase 2 placement). Adjust with `moveAndResize()` after streaming completes. |
| MMED-10 | AI-generated nodes visually distinguishable | `node.setData({ color: settings.aiNodeColor })` after creation. Default "6" per UI-SPEC. |
| TAST-01 | Global taste profile stored as markdown file in vault | YAML frontmatter + freeform body at `.obsidian/plugins/canvas-ai/taste-profile.md`. Read via `vault.adapter.read()`. |
| TAST-02 | Taste profile includes fields: thinking style, tone, visual preference, depth | YAML frontmatter fields: `tone`, `depth`, `visual_preference`, `thinking_style`. |
| TAST-03 | Taste profile injected into system prompt | Read file, parse frontmatter + body, insert as system prompt content block before spatial context. |
</phase_requirements>

## Standard Stack

### Core (Phase 3 additions)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/sdk` | 0.82.0 | Claude Opus 4.6 API streaming | Official Anthropic TypeScript SDK. `client.messages.stream()` with `.on('text')` for progressive delivery. Must use `dangerouslyAllowBrowser: true` in Electron. Verified 0.82.0 is latest on npm. |
| `uuid` | ^9.0.0 | Unique node ID generation | Canvas nodes need unique IDs. uuid v4 is standard. Already available transitively via obsidian-typings->mermaid, but should be a direct dependency. Current npm latest: 13.0.0 (major breaking changes -- stick with ^9.0 for compatibility with existing ecosystem). |

### Already Installed (from Phase 1/2)
| Library | Version | Purpose |
|---------|---------|---------|
| `obsidian` | ^1.12.3 | Plugin API, vault I/O, Setting, Notice |
| `obsidian-typings` | 5.17.0 | Canvas internal API types (CanvasViewCanvas, CanvasViewCanvasNode) |
| `monkey-around` | 3.0.0 | Monkey-patching canvas prototype |
| `esbuild` | ^0.24.2 | Bundler |
| TypeScript | ^5.5 | Language |

### Not Needed for Phase 3
| Library | Why Not |
|---------|---------|
| `zod` | Not needed yet -- Claude response parsing uses simple string accumulation. Structured output validation deferred to Phase 4 when medium selection becomes complex. |
| `js-tiktoken` | Token counting via SDK response `usage` object, not manual counting. |
| `gray-matter` or YAML parser | Obsidian provides `parseFrontMatterStringArray` and related utils, or use simple regex for YAML frontmatter parsing. Lightweight enough to not need a dependency. |

**Installation:**
```bash
npm install @anthropic-ai/sdk@^0.82.0 uuid@^9.0.0
npm install --save-dev @types/uuid
```

**Version verification:**
- `@anthropic-ai/sdk` 0.82.0 -- verified as `latest` on npm 2026-04-03
- `uuid` 9.0.1 available (13.0.0 exists but is a major version jump with potential breaking changes; ^9.0 is safer)
- Node.js 24.14.1 installed (exceeds ^20 LTS requirement)

## Architecture Patterns

### Recommended Project Structure (Phase 3 additions)
```
src/
  ai/
    claude-client.ts      # Anthropic SDK wrapper, client initialization
    prompt-builder.ts     # System prompt composition (spatial + taste + instructions)
    stream-handler.ts     # Streaming orchestration, buffered updates, timeout watchdog
    token-budget.ts       # Token tracking, budget check, persistence
  canvas/
    canvas-adapter.ts     # EXTENDED: add createNode(), updateNodeText() methods
    canvas-events.ts      # Existing (no changes)
    canvas-patcher.ts     # Existing (no changes)
    generation-controller.ts  # MODIFIED: onTrigger callback replaced with real pipeline
  spatial/
    (all existing, no changes)
  taste/
    taste-profile.ts      # Read/write/seed taste profile, parse frontmatter
  types/
    canvas.ts             # Existing (no changes)
    settings.ts           # EXTENDED: add budget, aiNodeColor, tasteProfilePath fields
  ui/
    status-bar.ts         # EXTENDED: add 'streaming' and 'budget' states
  settings.ts             # EXTENDED: add Token Budget, AI Appearance, Taste Profile sections
  main.ts                 # MODIFIED: wire real generation pipeline, new settings fields
styles.css                # EXTENDED: add streaming/budget status, pulsing node animation
```

### Pattern 1: Generation Pipeline (Main Flow)
**What:** End-to-end flow from canvas event to streamed content
**When to use:** Every generation trigger

```typescript
// Source: Derived from CONTEXT.md D-01/D-02/D-03 and SDK docs
async function handleGeneration(signal: AbortSignal): Promise<void> {
  // 1. Check budget
  if (isBudgetExceeded() && !isBudgetOverridden()) {
    setStatus('budget');
    showBudgetNotice();
    return;
  }

  // 2. Read canvas state
  const canvas = adapter.getActiveCanvas();
  const nodes = adapter.getNodesFromCanvas(canvas);
  const edges = adapter.getEdgesFromCanvas(canvas);

  // 3. Build spatial context (Phase 2)
  const spatialCtx = buildSpatialContext(nodes, edges, triggerNodeId);

  // 4. Read taste profile
  const tasteContent = await readTasteProfile(vault);

  // 5. Build system prompt
  const systemPrompt = buildSystemPrompt(spatialCtx.narrative, tasteContent);

  // 6. Pre-allocate nodes at placement positions
  const placements = spatialCtx.placementSuggestions;
  setStatus('thinking');

  // 7. Stream into nodes sequentially (D-03)
  for (let i = 0; i < nodeCount; i++) {
    if (signal.aborted) return;
    const nodeRef = createPreAllocatedNode(canvas, placements[i]);
    addPulsingAnimation(nodeRef);
    await streamIntoNode(client, systemPrompt, nodeRef, signal);
    resizeNodeToContent(nodeRef);
  }

  setStatus('idle');
}
```

### Pattern 2: Buffered Streaming into Canvas Node
**What:** Accumulate streaming text deltas and flush to canvas node at intervals
**When to use:** Every streaming response

```typescript
// Source: Anthropic SDK docs + obsidian-chat-stream setText pattern
async function streamIntoNode(
  client: Anthropic,
  systemPrompt: SystemPromptBlock[],
  nodeRef: CanvasNode,
  signal: AbortSignal
): Promise<StreamResult> {
  let accumulated = '';
  let lastFlush = Date.now();
  const BUFFER_INTERVAL = 250; // ms (D-04: 200-300ms)
  let firstToken = true;

  const stream = client.messages.stream({
    model: 'claude-opus-4-6',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: 'Generate based on the canvas context.' }],
  }, { signal });

  // Timeout watchdog (GENP-11)
  let watchdog = resetWatchdog();

  stream.on('text', (text) => {
    if (firstToken) {
      removePulsingAnimation(nodeRef);
      setStatus('streaming');
      firstToken = false;
    }

    accumulated += text;
    watchdog = resetWatchdog(watchdog);

    const now = Date.now();
    if (now - lastFlush >= BUFFER_INTERVAL) {
      nodeRef.setText(accumulated);
      lastFlush = now;
    }
  });

  const finalMessage = await stream.finalMessage();

  // Final flush
  nodeRef.setText(accumulated);

  // Track tokens (GENP-09)
  trackTokenUsage(finalMessage.usage);

  clearWatchdog(watchdog);

  return { text: accumulated, usage: finalMessage.usage };
}
```

### Pattern 3: Canvas Node Creation via Internal API
**What:** Create a pre-allocated text node at a computed position
**When to use:** Before streaming begins

```typescript
// Source: obsidian-chat-stream canvas-patches.ts + obsidian-typings CanvasViewCanvas
function createPreAllocatedNode(
  canvas: any, // CanvasViewCanvas
  placement: PlacementCoordinate,
  color: string = '6'
): any {
  // createTextNode parameter format (Obsidian 1.1.10+)
  const node = canvas.createTextNode({
    pos: { x: placement.x, y: placement.y },
    size: { width: placement.width, height: placement.height },
    text: '',
    focus: false,
  });

  // Set AI node color (MMED-10)
  node.setData({ color });

  // Add to canvas (may be done automatically by createTextNode)
  // canvas.addNode(node); // Only if createTextNode doesn't auto-add

  // Add pulsing animation CSS class (D-04)
  node.nodeEl?.addClass('canvas-ai-node--streaming');

  return node;
}
```

### Pattern 4: Anthropic Client Initialization in Electron
**What:** Configure SDK for Electron's browser-like environment
**When to use:** Plugin initialization

```typescript
// Source: Anthropic SDK docs + CLAUDE.md Key Decision #1
import Anthropic from '@anthropic-ai/sdk';

function createClaudeClient(apiKey: string): Anthropic {
  return new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
    // Electron provides Node.js fetch -- no custom fetch needed
    // SDK auto-detects Node.js fetch in Electron context
    maxRetries: 2, // SDK default, explicit for clarity
  });
}
```

### Pattern 5: Prompt Caching for System Prompt
**What:** Cache the system prompt to reduce input token costs
**When to use:** Every Claude API call

```typescript
// Source: Anthropic prompt caching docs
function buildSystemPrompt(
  spatialNarrative: string,
  tasteContent: string
): Anthropic.MessageCreateParams['system'] {
  return [
    {
      type: 'text' as const,
      text: `You are a spatial thinking partner embedded in an Obsidian canvas...
[generation instructions, medium selection rules, style guidelines]

## Taste Profile
${tasteContent}`,
      cache_control: { type: 'ephemeral' as const },
      // Cache the static portion (instructions + taste profile)
      // Minimum 4,096 tokens for Opus -- instructions + taste profile should exceed this
    },
    {
      type: 'text' as const,
      text: spatialNarrative,
      // Spatial context changes every trigger -- NOT cached
    },
  ];
}
```

### Anti-Patterns to Avoid
- **Writing to canvas via vault.modify() while canvas is active:** Canvas's requestSave debounce (2s) will overwrite file changes. Always use internal API (createTextNode, setText, setData) when canvas view is active.
- **Flushing every text delta to setText:** Causes layout thrash and DOM reflow storms. Buffer at 200-300ms intervals.
- **Creating all nodes simultaneously:** Per D-03, nodes stream sequentially. Don't pre-allocate all nodes at once; create the next only after the previous completes.
- **Manual SSE parsing:** The SDK handles SSE parsing internally. Don't use raw fetch + manual event parsing.
- **Blocking the generation pipeline with sync operations:** All canvas API calls, file reads, and streaming must be async. Never block the Obsidian event loop.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSE stream parsing | Custom EventSource or fetch+ReadableStream parser | `@anthropic-ai/sdk` `client.messages.stream()` | SDK handles reconnection, backpressure, event parsing, type safety. Rolling your own SSE parser is error-prone. |
| Token counting | Manual tiktoken encoding | `stream.finalMessage().usage` response field | SDK returns exact token counts (input_tokens, output_tokens, cache_read_input_tokens, cache_creation_input_tokens). No need for client-side counting. |
| HTTP retry logic | Custom exponential backoff | SDK built-in retry (maxRetries: 2 default) | SDK retries 429, 500+, connection errors automatically with backoff. Add custom handling only for 401 and budget checks. |
| YAML frontmatter parsing | Full YAML parser library | Simple regex extraction (split on `---` markers) | Taste profile frontmatter is simple key-value pairs. A full YAML parser (gray-matter, js-yaml) is overkill. |
| Unique ID generation | `Math.random().toString(36)` or `crypto.randomUUID()` | `uuid` v4 | Consistent format matching Obsidian's canvas node ID expectations. |

**Key insight:** The Anthropic SDK abstracts virtually all HTTP/streaming complexity. The main engineering challenge is the canvas integration layer (node creation, text updates, animation) and the orchestration logic (sequential streaming, budget checks, abort handling).

## Common Pitfalls

### Pitfall 1: createTextNode API Version Mismatch
**What goes wrong:** Obsidian changed the `createTextNode` parameter format around version 1.1.10. Old format: `createTextNode(pos, size, save)`. New format: `createTextNode({ pos, size, text, focus })`.
**Why it happens:** Undocumented internal API changed without notice.
**How to avoid:** Target the new format (object parameter) since we target Obsidian ^1.12.0. The old format is irrelevant. If createTextNode fails, fall back to file-based node creation via vault.modify().
**Warning signs:** TypeError or "undefined is not a function" on node creation.

### Pitfall 2: setText Triggers requestSave Debounce
**What goes wrong:** Each `node.setText()` call may trigger canvas's internal `requestSave` debounce. Rapid calls (un-buffered streaming) can cause save conflicts or lost content.
**Why it happens:** Canvas treats setText as an edit, scheduling a save. Multiple rapid saves within the 2-second debounce window merge unpredictably.
**How to avoid:** Buffer text updates to 200-300ms intervals (D-04). This is slow enough that requestSave completes between flushes. After streaming completes, call `canvas.requestSave()` explicitly to ensure final state is persisted.
**Warning signs:** Node content reverts to earlier state, or content disappears after streaming completes.

### Pitfall 3: Streaming Abortion After AbortSignal
**What goes wrong:** The SDK stream continues delivering events briefly after `signal.abort()` due to buffered data. Code accessing the aborted node throws errors.
**Why it happens:** AbortSignal cancels the fetch, but already-buffered SSE events may still fire handlers before the abort propagates.
**How to avoid:** Check `signal.aborted` at the start of every text handler callback. Guard all node operations with an "isAlive" check (node not destroyed, canvas still active).
**Warning signs:** "Cannot read property of null" errors after canvas switch or rapid re-trigger.

### Pitfall 4: Prompt Cache Miss Due to Content Below Minimum
**What goes wrong:** System prompt is too short for caching. Every request pays full input token cost.
**Why it happens:** Claude Opus 4.6 requires 4,096 tokens minimum for prompt caching. If the static system prompt + taste profile is shorter, caching silently fails (no error, just no cache).
**How to avoid:** Ensure the cached content block (generation instructions + taste profile) exceeds 4,096 tokens. The taste profile seed content (~400 words) plus generation instructions (~2000 words) should comfortably reach this. Monitor `cache_creation_input_tokens` and `cache_read_input_tokens` in usage responses.
**Warning signs:** `cache_read_input_tokens` is always 0 across requests.

### Pitfall 5: Node Color Not Persisting
**What goes wrong:** AI node color resets to default after canvas reload.
**Why it happens:** `node.color` is a runtime property. Must use `node.setData({ color: '6' })` to persist to the canvas JSON file.
**How to avoid:** Always use `setData()` for persistent properties, not direct property assignment. Call `canvas.requestSave()` after setting data.
**Warning signs:** AI nodes lose their color after closing and reopening the canvas.

### Pitfall 6: Taste Profile File Not Found on First Run
**What goes wrong:** Plugin tries to read taste profile before it exists, fails silently, and generates content without taste shaping.
**Why it happens:** `.obsidian/plugins/canvas-ai/taste-profile.md` doesn't exist until seeded.
**How to avoid:** On plugin load (or first generation trigger), check if taste profile exists. If not, create it with seed content (D-10). Use `vault.adapter.exists()` then `vault.adapter.write()` since the path is outside the vault root.
**Warning signs:** Generated content has no stylistic consistency with user preferences.

### Pitfall 7: Budget Check Race Condition
**What goes wrong:** Two rapid triggers both pass the budget check, then both complete, exceeding the budget.
**Why it happens:** GenerationController cancels in-flight requests (FOUN-09), but the budget check is non-atomic with the API call.
**How to avoid:** This is an acceptable edge case given FOUN-09 (abort cancels the first generation). At worst, one extra generation sneaks through. The budget tracking updates immediately on `finalMessage()` usage data, so subsequent triggers will see the updated count.
**Warning signs:** Budget slightly exceeded by one generation's worth of tokens.

### Pitfall 8: CSS Class on Canvas Node Elements
**What goes wrong:** Adding CSS classes to `node.nodeEl` or `node.containerEl` doesn't work, or classes are removed on re-render.
**Why it happens:** Canvas may re-render nodes (e.g., on zoom, scroll, viewport change), replacing DOM elements.
**How to avoid:** Re-apply CSS classes after `canvas.requestFrame()` or observe for DOM changes. Use a data attribute or the `unknownData` property on the node as a persistent marker, and apply CSS via data-attribute selector as a fallback.
**Warning signs:** Pulsing animation disappears immediately after appearing, or doesn't appear on some nodes.

## Code Examples

### Example 1: Complete Client Initialization
```typescript
// Source: Anthropic SDK official docs + CLAUDE.md Key Decision #1
import Anthropic from '@anthropic-ai/sdk';

export function createClient(apiKey: string): Anthropic {
  return new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true, // Required: Electron = browser-like env
    maxRetries: 2,                 // Default, explicit
    timeout: 60_000,               // 60s timeout for streaming
  });
}
```

### Example 2: Streaming with .on('text') and Buffering
```typescript
// Source: Anthropic SDK streaming docs
const stream = client.messages.stream({
  model: 'claude-opus-4-6',
  max_tokens: 4096,
  system: systemPromptBlocks,
  messages: [{ role: 'user', content: userPrompt }],
}, { signal: abortSignal });

let accumulated = '';
let lastFlush = Date.now();

stream.on('text', (text) => {
  accumulated += text;
  const now = Date.now();
  if (now - lastFlush >= 250) {
    canvasNode.setText(accumulated);
    lastFlush = now;
  }
});

const message = await stream.finalMessage();
canvasNode.setText(accumulated); // Final flush

// Token usage from response
const { input_tokens, output_tokens } = message.usage;
// Prompt caching usage (if applicable):
// message.usage.cache_creation_input_tokens
// message.usage.cache_read_input_tokens
```

### Example 3: Canvas Node Creation (Internal API)
```typescript
// Source: obsidian-typings CanvasViewCanvas + obsidian-chat-stream
// canvas is obtained via CanvasAdapter.getActiveCanvas()
const node = canvas.createTextNode({
  pos: { x: 100, y: 200 },
  size: { width: 300, height: 200 },
  text: '',
  focus: false,
});

// Set persistent data (color, custom properties)
node.setData({ color: '6' });

// Add CSS class for pulsing animation
if (node.nodeEl) {
  node.nodeEl.addClass('canvas-ai-node--streaming');
}

// Later: update text content
await node.setText('# Generated Content\n\nThis is AI-generated text.');

// Resize to fit content after streaming
node.moveAndResize({
  x: node.x,
  y: node.y,
  width: node.width,
  height: calculatedHeight,
});

// Persist changes
canvas.requestSave();
```

### Example 4: Taste Profile Format
```markdown
---
tone: Restrained, considered, unhurried. Direct without being blunt.
depth: Deep structural analysis. First-principles thinking.
visual_preference: Monochromatic default. Color used surgically.
thinking_style: Swiss rational tradition. Systematic over intuitive.
---

We believe design begins with restraint...
[user's freeform design philosophy]
```

### Example 5: Token Budget Tracking
```typescript
// Source: Derived from D-11, D-12, D-13
interface TokenUsageData {
  date: string;          // "2026-04-03"
  inputTokens: number;
  outputTokens: number;
  budgetOverride: boolean;
}

function isBudgetExceeded(usage: TokenUsageData, dailyLimit: number): boolean {
  return (usage.inputTokens + usage.outputTokens) >= dailyLimit;
}

function trackTokens(
  current: TokenUsageData,
  responseUsage: { input_tokens: number; output_tokens: number }
): TokenUsageData {
  const today = new Date().toISOString().split('T')[0];

  // Auto-reset on date change
  if (current.date !== today) {
    return {
      date: today,
      inputTokens: responseUsage.input_tokens,
      outputTokens: responseUsage.output_tokens,
      budgetOverride: false,
    };
  }

  return {
    ...current,
    inputTokens: current.inputTokens + responseUsage.input_tokens,
    outputTokens: current.outputTokens + responseUsage.output_tokens,
  };
}
```

### Example 6: System Prompt with Prompt Caching
```typescript
// Source: Anthropic prompt caching docs
function buildSystemPrompt(
  tasteProfile: string,
  spatialNarrative: string
): Anthropic.Messages.MessageCreateParams['system'] {
  return [
    {
      type: 'text',
      text: `You are a spatial thinking partner embedded in an Obsidian canvas.

## Your Role
When the user acts on the canvas (creates, edits, moves nodes), you observe
the spatial arrangement and generate new content that extends their thinking.
You generate 1-3 text nodes depending on the richness of the context.

## Generation Rules
- Output markdown text suitable for a canvas text node
- Each node should contain a distinct idea or perspective
- Content should feel like a natural extension of the user's thinking
- Never repeat or paraphrase existing node content
- Maintain appropriate depth and complexity for the context

## Medium Selection
For Phase 3, generate text/markdown nodes only.
- Use headers, lists, and emphasis for structure
- Include code blocks when the context is technical
- Keep each node focused on a single concept

## Taste Profile
${tasteProfile}`,
      cache_control: { type: 'ephemeral' },
    },
    {
      type: 'text',
      text: spatialNarrative,
      // NOT cached -- changes every trigger
    },
  ];
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `client.messages.create({ stream: true })` raw iteration | `client.messages.stream()` with `.on('text')` helper | SDK v0.30+ | Simpler API, automatic message accumulation, typed event handlers |
| `createTextNode(pos, size, save)` positional args | `createTextNode({ pos, size, text, focus })` object arg | Obsidian ~1.1.10 | Must use object format for Obsidian ^1.12+ |
| Manual prompt caching with beta headers | `cache_control: { type: "ephemeral" }` in system content | 2024-2025 | No beta header needed. 5-min default TTL, optional 1-hour at 2x cost |
| Token counting via tiktoken | `message.usage` response field | Always available | No client-side counting needed. Server returns exact counts. |

**Deprecated/outdated:**
- `requestUrl()` for streaming: Obsidian's `requestUrl` does not support streaming responses. Must use Node.js fetch (available in Electron).
- Positional `createTextNode(pos, size, save)` format: Pre-1.1.10 API. Use object parameter format.
- `@anthropic-ai/sdk` < 0.30: Lacked `.stream()` convenience helper and `.on('text')` handler.

## Open Questions

1. **Does createTextNode auto-add to canvas?**
   - What we know: obsidian-chat-stream calls `canvas.addNode(node)` explicitly after `createTextNode()`. However, obsidian-typings shows `addNode` and `createTextNode` as separate methods. The behavior may differ by Obsidian version.
   - What's unclear: Whether Obsidian ^1.12 createTextNode auto-adds or requires explicit addNode.
   - Recommendation: Call `canvas.addNode(node)` after `createTextNode()` defensively. If double-add causes issues, guard with `canvas.nodes.has(node.id)`.

2. **Does node.setText return a Promise or fire synchronously?**
   - What we know: obsidian-typings declares `setText(text: string): Promise<void>`. obsidian-chat-stream treats it as sync (no await).
   - What's unclear: Whether the Promise matters for buffered updates at 250ms intervals.
   - Recommendation: Await `setText()` but don't block the buffer interval on it. Fire-and-forget for intermediate flushes; await only the final flush.

3. **CSS class persistence on canvas node DOM elements across renders**
   - What we know: Canvas re-renders nodes on viewport changes. CSS classes on DOM elements may be lost.
   - What's unclear: Whether `node.nodeEl` is stable across renders or recreated.
   - Recommendation: Use a combination of CSS class + data-attribute selector. If class is lost, re-apply on render. Consider using `node.unknownData` to persist a custom flag that CSS can target.

4. **Claude's structured output for multi-node generation**
   - What we know: D-02 says Claude decides 1-3 nodes. Need a way to delimit node boundaries in the streamed response.
   - What's unclear: Best delimiter format (XML tags, JSON blocks, or markdown separators).
   - Recommendation: Use XML-style delimiters in the system prompt instruction: `<node>content</node>`. Parse during streaming -- when a closing `</node>` tag is detected, complete the current node and start the next.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29 with ts-jest |
| Config file | `jest.config.js` |
| Quick run command | `npm test -- --bail` |
| Full suite command | `npm test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GENP-01 | Claude client initialization with correct params | unit | `npm test -- tests/ai/claude-client.test.ts -t "creates client"` | Wave 0 |
| GENP-03 | Text content streams into accumulated string | unit | `npm test -- tests/ai/stream-handler.test.ts -t "accumulates text"` | Wave 0 |
| GENP-04 | Buffer flushes at 200-300ms intervals | unit | `npm test -- tests/ai/stream-handler.test.ts -t "buffers"` | Wave 0 |
| GENP-06 | System prompt includes spatial + taste + instructions | unit | `npm test -- tests/ai/prompt-builder.test.ts -t "includes"` | Wave 0 |
| GENP-08 | Prompt caching cache_control present on system blocks | unit | `npm test -- tests/ai/prompt-builder.test.ts -t "cache_control"` | Wave 0 |
| GENP-09 | Token budget tracking and daily reset | unit | `npm test -- tests/ai/token-budget.test.ts` | Wave 0 |
| GENP-10 | Budget exceeded detection | unit | `npm test -- tests/ai/token-budget.test.ts -t "exceeded"` | Wave 0 |
| GENP-11 | Timeout watchdog fires after 30s inactivity | unit | `npm test -- tests/ai/stream-handler.test.ts -t "watchdog"` | Wave 0 |
| GENP-12 | Error classification (401, 429, 500+) | unit | `npm test -- tests/ai/claude-client.test.ts -t "error"` | Wave 0 |
| MMED-01 | Markdown text output validation | unit | `npm test -- tests/ai/prompt-builder.test.ts -t "markdown"` | Wave 0 |
| TAST-01 | Taste profile read/write/seed | unit | `npm test -- tests/taste/taste-profile.test.ts` | Wave 0 |
| TAST-02 | Frontmatter field parsing | unit | `npm test -- tests/taste/taste-profile.test.ts -t "frontmatter"` | Wave 0 |
| TAST-03 | Taste profile injected into system prompt | unit | `npm test -- tests/ai/prompt-builder.test.ts -t "taste"` | Wave 0 |
| MMED-09 | Node sizing constants | unit | Covered by stream-handler tests | Wave 0 |
| MMED-10 | AI node color setting | manual-only | Requires live Obsidian canvas | -- |
| GENP-02 | Node.js fetch in Electron | manual-only | Requires Electron environment | -- |
| GENP-05 | Pre-allocated node dimensions | manual-only | Requires live canvas | -- |
| GENP-07 | Opus medium selection | manual-only | Requires live API call + canvas | -- |

### Sampling Rate
- **Per task commit:** `npm test -- --bail`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/ai/claude-client.test.ts` -- SDK initialization, error handling
- [ ] `tests/ai/stream-handler.test.ts` -- Buffer accumulation, flush timing, watchdog timeout, abort handling
- [ ] `tests/ai/prompt-builder.test.ts` -- System prompt composition, cache_control presence, taste injection
- [ ] `tests/ai/token-budget.test.ts` -- Budget tracking, daily reset, exceeded detection, override
- [ ] `tests/taste/taste-profile.test.ts` -- File read/write, seed content, frontmatter parsing
- [ ] `tests/__mocks__/anthropic.ts` -- Mock Anthropic SDK for unit tests (stream simulation)
- [ ] Framework install: `npm install @anthropic-ai/sdk@^0.82.0` -- needed before tests can import types

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | esbuild, SDK | Yes | 24.14.1 | -- |
| npm | Package management | Yes | 11.11.0 | -- |
| @anthropic-ai/sdk | GENP-01 | Not installed | -- | Install via `npm install` |
| uuid | Node ID generation | Transitive only | 9.0.1 (via mermaid) | Install as direct dependency |
| Obsidian (runtime) | Canvas API | Manual testing only | -- | Cannot automate canvas interaction |

**Missing dependencies with no fallback:**
- `@anthropic-ai/sdk` must be installed before Phase 3 implementation begins

**Missing dependencies with fallback:**
- `uuid` available transitively but should be a direct dependency for stability

## Sources

### Primary (HIGH confidence)
- [Anthropic TypeScript SDK Official Docs](https://platform.claude.com/docs/en/api/sdks/typescript) -- Client initialization, streaming patterns, error handling, retry configuration
- [Anthropic Streaming Messages API](https://platform.claude.com/docs/en/api/messages-streaming) -- SSE event types (message_start, content_block_delta, message_stop), usage fields
- [Anthropic Prompt Caching Guide](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) -- cache_control format, 4,096 token minimum for Opus, pricing, TTL options
- [obsidian-typings v5.17.0](https://github.com/Fevol/obsidian-typings) (installed in project) -- CanvasViewCanvas interface: createTextNode, addNode, requestSave, requestFrame; CanvasViewCanvasNode interface: setText, setData, getData, moveAndResize, nodeEl, color
- [@anthropic-ai/sdk npm](https://www.npmjs.com/package/@anthropic-ai/sdk) -- Verified v0.82.0 is latest

### Secondary (MEDIUM confidence)
- [obsidian-chat-stream](https://github.com/rpggio/obsidian-chat-stream) -- Production plugin using createTextNode + setText + setData for AI -> canvas node creation. Examined full source for canvas-internal.d.ts and canvas-patches.ts.
- [Obsidian-Canvas-Presentation](https://github.com/Quorafind/Obsidian-Canvas-Presentation) -- Confirmed createTextNode parameter format change between Obsidian versions
- [Obsidian Advanced Canvas](https://github.com/Developer-Mike/obsidian-advanced-canvas) -- Canvas internal API patterns, monkey-around usage

### Tertiary (LOW confidence)
- Canvas node CSS class persistence across renders -- untested hypothesis based on DOM observation. Needs validation during implementation.
- createTextNode auto-add behavior -- conflicting evidence between plugins. Needs runtime testing.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- SDK version verified on npm, canvas API verified via obsidian-typings + production plugins
- Architecture: HIGH -- Patterns derived from SDK official docs, existing canvas plugins, and locked user decisions
- Pitfalls: MEDIUM -- Some pitfalls (CSS persistence, createTextNode auto-add) are based on inference from multiple sources, not direct testing
- Canvas internal API: MEDIUM -- Undocumented API, types are community-maintained, behavior may differ across Obsidian versions

**Research date:** 2026-04-03
**Valid until:** 2026-05-03 (stable domain -- SDK API unlikely to break within minor versions; canvas internals may shift on Obsidian updates)
