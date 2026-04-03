# Phase 4: Multi-Medium Expansion - Research

**Researched:** 2026-04-03
**Domain:** Multi-medium content generation (code, Mermaid, images) via typed node protocol and Runware image API
**Confidence:** HIGH

## Summary

Phase 4 extends the existing text-only generation pipeline (Phase 3) to support four distinct medium types: text, code, mermaid diagrams, and images. The core technical challenge is threefold: (1) evolving the stream handler's `<node>` boundary detection to parse typed attributes like `<node type="code" lang="typescript">`, (2) implementing medium-specific rendering strategies (progressive streaming for text/code, buffered flush for mermaid, async placeholder-swap for images), and (3) integrating the Runware SDK for image generation via WebSocket in Obsidian's Electron environment.

The existing codebase provides strong foundations. The stream handler (`stream-handler.ts`) already detects `<node>` boundaries and routes via callbacks. The canvas adapter already creates text nodes. The prompt builder has a placeholder section for medium selection. The settings already store a Runware API key. The primary work is extending these existing systems, not building from scratch.

The Runware SDK (`@runware/sdk-js` v1.2.8) is now installed and uses WebSocket with auto-reconnect. In Electron, it auto-detects the browser WebSocket API (no `ws` polyfill needed in the renderer process). The Riverflow 2.0 Pro model AIR identifier is `sourceful:riverflow-2.0@pro`. Images can be returned as URL or base64Data -- base64Data is preferred for saving directly to vault without a second HTTP fetch.

**Primary recommendation:** Extend the stream handler to parse typed `<node>` tags, route each medium type to its specific rendering strategy in main.ts's `onNodeBoundary` callback, create a new `RunwareClient` module for image generation, and add a `createFileNodeOnCanvas()` method to the canvas adapter for image file nodes.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Typed node tags with attributes: `<node type="text">`, `<node type="code" lang="typescript">`, `<node type="mermaid">`, `<node type="image">`. Extend existing `<node>` boundary detection in stream-handler.ts to parse type attribute from opening tag.
- **D-02:** One node per content type per generation. Each trigger produces at most 1 text + 1 code + 1 mermaid + 1 image (up to 4 nodes total, each a distinct type). Never two text nodes or two code nodes in one response. This replaces Phase 3's 1-3 same-type cap.
- **D-03:** Claude can mix medium types freely within the one-per-type constraint. A single trigger might produce a text explanation + a code example + a diagram. The type attribute on `<node>` tags signals which medium each node is.
- **D-04:** Context-driven medium selection guidelines in the prompt. Claude uses judgment: text for ideas/analysis, code when technical, mermaid for relationships/flows, image when visual concept is powerful. Prefer text unless another medium adds clear value.
- **D-05:** Image prompt is plain natural language text inside `<node type="image">` tags. Claude writes the prompt, plugin extracts and sends to Runware/Riverflow 2.0 Pro.
- **D-06:** Image placeholder: pre-allocate a square node at placement position with pulsing border and "generating..." text (no icon). Same pulsing pattern as Phase 3 D-04. When image returns, swap placeholder for file node.
- **D-07:** Generated images saved to vault-visible folder: `canvas-ai-images/` at vault root. Naming convention: `{date}_{uuid-short}.png`. User can see and organize images.
- **D-08:** Image generation is parallel/non-blocking. When `<node type="image">` boundary is detected, fire Runware request asynchronously. The Claude stream continues to the next node immediately. Image placeholder swaps to file node when Runware returns.
- **D-09:** Mermaid diagrams are fenced \`\`\`mermaid code blocks inside regular text nodes. Obsidian's canvas renders Mermaid natively in text node markdown preview. No special node type or external renderer needed.
- **D-10:** Mermaid content is buffered until complete (MMED-04). Node shows pulsing empty state while content accumulates. When `</node>` boundary is detected, flush the complete mermaid block into the node all at once.
- **D-11:** Code blocks are fenced code with language tags inside regular text nodes. Obsidian renders syntax highlighting natively. No special node type needed.
- **D-12:** Code nodes stream progressively (like text nodes), not buffered. User sees code being written line by line with live syntax highlighting.
- **D-13:** Edit-mode gate -- generation only triggers after user clicks out of a node (`isEditing=false`). No mid-thought interruption while user is typing.
- **D-14:** AI node isolation -- AI-created node IDs are tracked. Interactions with AI nodes never trigger new generation. Only user-created/edited nodes trigger.
- **D-15:** Blank node skip -- empty or whitespace-only trigger nodes are ignored. No generation on blank nodes.

### Claude's Discretion
- Runware API integration details (SDK initialization, error handling, retry strategy)
- Exact image prompt enhancement (whether to append style tokens from taste profile)
- Image file node dimensions and aspect ratio handling
- Mermaid buffer detection implementation (how to detect boundary in stream)
- Code node width adjustment logic (MMED-09 says code wider)
- Stream handler refactoring approach for typed node parsing

### Deferred Ideas (OUT OF SCOPE)
- Code execution/preview -- Rendering the output of generated code in a companion node (e.g., running HTML/SVG and showing the visual result alongside the code). New capability that requires sandboxed execution, security model, and multiple language runtime support. Would be a powerful future phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MMED-02 | Code block nodes generated with language-tagged fenced code blocks | D-11, D-12: Code is fenced code inside text nodes, streams progressively. stream-handler parses `<node type="code" lang="...">`, wraps content in fenced block. |
| MMED-03 | Mermaid diagram nodes generated using Obsidian's built-in Mermaid renderer | D-09: Mermaid is fenced \`\`\`mermaid block inside text node. Obsidian renders natively. No bundled mermaid.js needed. |
| MMED-04 | Mermaid rendering buffered until diagram is complete (no mid-stream render) | D-10: Buffer mermaid content during streaming. Flush complete block on `</node>` boundary. Node shows pulsing placeholder while buffering. |
| MMED-05 | Image generation triggered via Runware API with Riverflow 2.0 Pro model | D-05, D-08: Runware SDK initialized with `new Runware({ apiKey })`, calls `requestImages({ model: 'sourceful:riverflow-2.0@pro', positivePrompt, width: 1024, height: 1024, outputType: 'base64Data', outputFormat: 'PNG' })`. |
| MMED-06 | Opus generates image prompts, Runware renders the image | D-05: Claude writes natural language prompt inside `<node type="image">` tags. Plugin extracts and passes to Runware. |
| MMED-07 | Generated images saved to vault and displayed as file nodes on canvas | D-07: Save to `canvas-ai-images/{date}_{uuid-short}.png` via `vault.createBinary()`. Swap text placeholder for file node via `canvas.createFileNode()`. |
| MMED-08 | Image generation loading state visible (placeholder node while generating) | D-06: Pre-allocate square text node with pulsing border and "generating..." text. Swap to file node when Runware returns. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **API**: Claude API (Opus 4.6) for reasoning, Runware API for image generation
- **Image model**: Riverflow 2.0 Pro specifically, accessed through Runware
- **Platform**: Obsidian plugin (TypeScript, Obsidian API)
- **Build tool**: esbuild only (no webpack/vite/rollup)
- **No bundled Mermaid**: Obsidian ships with Mermaid built-in. Generate mermaid code blocks in text nodes.
- **No React/Svelte/Vue**: Vanilla DOM + Obsidian APIs only
- **Image storage**: Vault files, not inline base64 (CLAUDE.md Key Decision #3)
- **Diagram generation**: Mermaid code blocks in text nodes (CLAUDE.md Key Decision #4)
- **Streaming**: Node.js fetch in Electron for Claude SDK (CLAUDE.md Key Decision #1)
- **Canvas writes**: Internal API only, never vault.modify() while canvas is active (FOUN-13)
- **@runware/sdk-js** and **@anthropic-ai/sdk** are BUNDLED (not external) by esbuild

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/sdk` | ^0.82.0 | Claude Opus 4.6 API calls | Already used in Phase 3. Extended prompt, same SDK. |
| `@runware/sdk-js` | ^1.2.8 | Runware image generation API | Official SDK. WebSocket-based, auto-reconnect, TypeScript types. Now installed. |
| `uuid` | ^9.0.1 | Unique ID generation | Already used. Needed for image filenames. |
| `obsidian-typings` | 5.17.0 | Canvas internal API types | Already used. Has `createFileNode` type (undocumented internals). |

### No New Dependencies Needed
The Runware SDK is the only new dependency and is already installed. All other work uses existing packages and Obsidian APIs. The `ws` package (Runware dependency) is bundled by esbuild.

**Version verification (2026-04-03):**
- `@runware/sdk-js`: 1.2.8 (latest on npm, confirmed)
- `@anthropic-ai/sdk`: 0.82.0 (already installed)
- `uuid`: 9.0.1 (already installed)

## Architecture Patterns

### Modified Project Structure
```
src/
  ai/
    prompt-builder.ts     # MODIFY: Replace medium selection placeholder with full multi-medium instructions
    stream-handler.ts     # MODIFY: Parse <node type="..."> attributes, expose type to callbacks
    claude-client.ts      # NO CHANGE
    token-budget.ts       # NO CHANGE
  canvas/
    canvas-adapter.ts     # MODIFY: Add createFileNodeOnCanvas() method
    canvas-patcher.ts     # NO CHANGE
    canvas-events.ts      # NO CHANGE
    generation-controller.ts  # NO CHANGE
  image/
    runware-client.ts     # NEW: Runware SDK wrapper (init, generateImage, error handling)
    image-saver.ts        # NEW: Save base64 to vault, return TFile
  types/
    settings.ts           # MINOR: Add image folder path setting
    canvas.ts             # NO CHANGE
    generation.ts         # NEW: NodeType union, TypedNodeInfo interface
  spatial/                # NO CHANGE (all pure math)
  taste/                  # NO CHANGE
  ui/
    status-bar.ts         # NO CHANGE
  main.ts                 # MODIFY: Route by node type in onNodeBoundary, wire Runware client
  settings.ts             # MINOR: Add image folder setting
styles.css                # MINOR: Add image placeholder CSS class
```

### Pattern 1: Typed Node Tag Parsing
**What:** Extend stream handler to parse `<node type="..." lang="...">` opening tags and expose parsed type metadata to callbacks.
**When to use:** Every generation cycle -- the stream handler must know what type of node it's processing.
**Implementation approach:**

The current stream handler searches for `<node>` and `</node>` literal strings. The extension replaces the simple `<node>` detection with a regex that extracts attributes:

```typescript
// Current: rawAccumulated.indexOf('<node>')
// New: Match <node type="text">, <node type="code" lang="typescript">, etc.
const TYPED_NODE_OPEN = /<node\s+type="(text|code|mermaid|image)"(?:\s+lang="([^"]*)")?\s*>/g;

interface TypedNodeMeta {
  type: 'text' | 'code' | 'mermaid' | 'image';
  lang?: string;  // Only for code nodes
}
```

The `onNodeBoundary` callback signature expands to include the node type:

```typescript
onNodeBoundary: (completedNodeContent: string, nodeIndex: number, meta: TypedNodeMeta) => void;
```

The `onTextUpdate` callback also needs the current node's type so the caller knows whether to buffer (mermaid) or stream (text/code):

```typescript
onTextUpdate: (text: string, meta: TypedNodeMeta) => void;
```

**Backward compatibility:** The `parseNodeContent` function should still work for final content extraction. The `extractCurrentNodeVisibleText` function needs updating to handle the longer opening tag.

### Pattern 2: Medium-Specific Rendering Strategy
**What:** Route each node type to its specific rendering behavior in main.ts's generation pipeline.
**When to use:** In the `onNodeBoundary` and `onTextUpdate` callbacks.

```typescript
// In main.ts streamWithRetry, the onNodeBoundary callback routes by type:
onNodeBoundary: (content: string, index: number, meta: TypedNodeMeta) => {
  // Finalize current node
  this.adapter.removeNodeCssClass(activeNode, 'canvas-ai-node--streaming');
  
  // For completed mermaid nodes: flush buffered content
  if (currentMeta?.type === 'mermaid') {
    const mermaidBlock = '```mermaid\n' + mermaidBuffer + '\n```';
    this.suppressEvents(() => this.adapter.updateNodeText(activeNode, mermaidBlock));
  }
  
  // For completed image nodes: fire async Runware request
  if (currentMeta?.type === 'image') {
    this.fireImageGeneration(content, activeNode, canvas);
    // Don't wait -- stream continues to next node
  }
  
  // Pre-allocate next node if within limit
  if (nextNodeAllowed(seenTypes, meta.type)) {
    const nextPlacement = placements[placementIndex++];
    activeNode = this.suppressEvents(() =>
      this.adapter.createTextNodeOnCanvas(canvas, nextPlacement, this.settings.aiNodeColor)
    );
    // ... tracking, CSS class, etc.
  }
}
```

### Pattern 3: Async Image Generation with Placeholder Swap
**What:** When an image node boundary is detected, fire Runware request asynchronously while the Claude stream continues.
**When to use:** On `</node>` for `type="image"` nodes.

```typescript
// Non-blocking image generation
private async fireImageGeneration(prompt: string, placeholderNode: any, canvas: any): Promise<void> {
  try {
    // 1. Call Runware
    const images = await this.runwareClient.generateImage(prompt);
    if (!images || images.length === 0) {
      this.adapter.updateNodeText(placeholderNode, 'Image generation failed.');
      return;
    }
    
    // 2. Save image to vault
    const imageData = images[0];
    const filePath = await this.imageSaver.saveToVault(imageData.imageBase64Data!);
    
    // 3. Remove placeholder, create file node at same position
    const pos = { x: placeholderNode.x, y: placeholderNode.y, 
                  width: placeholderNode.width, height: placeholderNode.height };
    this.suppressEvents(() => {
      canvas.removeNode(placeholderNode);
      const fileNode = this.adapter.createFileNodeOnCanvas(canvas, pos, filePath, this.settings.aiNodeColor);
      if (fileNode?.id) this.aiNodeIds.add(fileNode.id);
    });
    this.adapter.requestCanvasSave(canvas);
  } catch (err) {
    console.error('[Canvas AI] Image generation failed:', err);
    this.adapter.updateNodeText(placeholderNode, 'Image generation failed.');
    this.adapter.removeNodeCssClass(placeholderNode, 'canvas-ai-node--streaming');
  }
}
```

### Pattern 4: One-Per-Type Enforcement
**What:** Track which medium types have been generated in the current response. Reject duplicate types.
**When to use:** In the `onNodeBoundary` callback when deciding whether to create the next node.

```typescript
const seenTypes = new Set<string>();

function nextNodeAllowed(seenTypes: Set<string>, nextType: string): boolean {
  if (seenTypes.has(nextType)) return false;  // Duplicate type -- skip
  if (seenTypes.size >= 4) return false;       // Max 4 nodes (one per type)
  seenTypes.add(nextType);
  return true;
}
```

### Anti-Patterns to Avoid
- **Bundling mermaid.js:** Obsidian already includes Mermaid. Generate fenced code blocks and let Obsidian render them natively. Bundling adds ~2MB and creates version conflicts.
- **Blocking on image generation:** Claude stream must NOT wait for Runware. Fire-and-forget with async placeholder swap. Otherwise, the entire generation stalls for 2-10 seconds per image.
- **Using vault.modify() for image file nodes:** Canvas internal API's `createFileNode()` is the correct approach. `vault.modify()` conflicts with canvas's `requestSave` debounce (FOUN-13).
- **Streaming partial Mermaid:** Flushing incomplete Mermaid syntax causes Obsidian to show a broken render that flickers and re-renders. Buffer until `</node>` boundary, then flush the complete block.
- **Two text nodes in one generation:** D-02 explicitly replaces Phase 3's 1-3 same-type cap. Each type can only appear once. The prompt must instruct Claude accordingly, and the code must enforce it.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebSocket image generation | Custom WebSocket client for Runware | `@runware/sdk-js` Runware class | SDK handles reconnection, authentication, heartbeat, retry, TypeScript types |
| Mermaid rendering | Custom SVG renderer or bundled mermaid.js | Obsidian's built-in Mermaid renderer | Obsidian natively renders \`\`\`mermaid code blocks in text nodes. Zero effort. |
| Image file saving | Manual Buffer manipulation | `vault.createBinary()` with base64 decode | Obsidian's vault API handles file creation, indexing, and normalization |
| UUID generation | `crypto.randomUUID()` or `Date.now()` | `uuid` package (already installed) | Consistent, collision-proof IDs. Already used throughout the codebase. |
| Node tag regex parsing | Character-by-character state machine | Regex with named groups on accumulated text | The accumulated text is small (< 50KB). Regex is simpler, correct, and fast enough. |

**Key insight:** The Runware SDK handles WebSocket complexity (connection management, auto-reconnect, heartbeat, authentication) that would be extremely error-prone to hand-roll. The SDK auto-detects Electron's browser WebSocket API and works without `ws` polyfill in the renderer process.

## Common Pitfalls

### Pitfall 1: Partial Tag Matching with Typed Tags
**What goes wrong:** The current partial tag detection in `partialTagSuffixLength()` only checks for `<`, `<n`, `<no`, `<nod`, `<node`. With typed tags like `<node type="code" lang="ts">`, the partial detection is much more complex.
**Why it happens:** The opening tag is now variable-length (up to ~40 chars) instead of fixed 6 chars (`<node>`).
**How to avoid:** Change the approach: instead of holding back partial suffixes character by character, track whether we're "inside an opening tag" (seen `<node` but not yet `>`). While inside an opening tag, hold back all characters after the `<node` prefix. Once `>` is found, parse the complete tag.
**Warning signs:** Visible `<node type=` text in the canvas node, or `type="code"` appearing in rendered content.

### Pitfall 2: Runware WebSocket in Electron Renderer
**What goes wrong:** Runware SDK creates a WebSocket connection. If Obsidian's Content Security Policy (CSP) blocks WebSocket connections to external hosts, the connection fails silently.
**Why it happens:** Electron apps can have CSP that restricts `connect-src`.
**How to avoid:** Test WebSocket connection during initialization. Obsidian does NOT enforce strict CSP on plugin WebSocket connections (confirmed by existing WebSocket-using plugins). But wrap Runware init in try/catch and surface connection errors to the user via Notice.
**Warning signs:** Runware `requestImages` hangs indefinitely or times out without error message.

### Pitfall 3: Canvas removeNode + createFileNode Race
**What goes wrong:** When swapping placeholder text node for image file node, `removeNode` followed immediately by `createFileNode` can cause visual glitch (canvas re-renders between calls).
**Why it happens:** Each canvas mutation triggers a requestSave debounce and potential re-render.
**How to avoid:** Call both operations within the same `suppressEvents()` block. Consider using `canvas.removeNode(placeholder)` then immediately `canvas.createFileNode(...)` before yielding control. Alternatively, skip the remove -- just hide the placeholder by setting empty text, then create the file node at the same position. The placeholder becomes invisible.
**Warning signs:** Brief flash of empty space before image appears, or duplicate nodes.

### Pitfall 4: Mermaid Buffer Not Flushing on Stream Error
**What goes wrong:** If the Claude stream errors or times out mid-mermaid, the buffered content is never flushed to the node. The user sees an empty pulsing node that never resolves.
**Why it happens:** Error path doesn't check for buffered mermaid content.
**How to avoid:** In the error/cleanup handler, check if there's buffered mermaid content and flush whatever we have (even if incomplete). Mark it as partial with a comment like `%% (incomplete)` so the user knows.
**Warning signs:** Empty pulsing node that never resolves after an error.

### Pitfall 5: createFileNode Parameter Shape
**What goes wrong:** Calling `canvas.createFileNode()` with wrong parameter shape causes silent failure (returns undefined).
**Why it happens:** The internal API is undocumented. `obsidian-typings` types the parameter as `unknown`. The actual shape must be inferred from `createTextNode` pattern.
**How to avoid:** Follow the same object shape as `createTextNode`: `{ pos: { x, y }, size: { width, height }, file: 'path/to/file.png', focus: false }`. The key difference is `file` (vault path string) instead of `text`. Add defensive null check on the return value, same pattern as `createTextNodeOnCanvas`.
**Warning signs:** `createFileNodeOnCanvas` returns null, no node appears on canvas.

### Pitfall 6: Base64 Decode Size
**What goes wrong:** A 1024x1024 PNG image as base64 is ~2-4MB of string data. Decoding this in the renderer thread could cause a brief UI freeze.
**Why it happens:** Base64 decode + vault write is synchronous-feeling in the call chain.
**How to avoid:** Use `Uint8Array` from `atob()` for the decode, then pass to `vault.createBinary()`. The vault write is async (returns Promise). Keep the total operation under 50ms. For 1024x1024 PNGs this should be fine. If images get larger (2K+), consider chunked decode. For v1, 1024x1024 is the target resolution.
**Warning signs:** UI freeze for 100ms+ when image arrives.

### Pitfall 7: Runware API Key Validation Timing
**What goes wrong:** Runware SDK validates the API key on first WebSocket connection (authentication message). If the key is invalid, the first `requestImages` call fails with an auth error.
**Why it happens:** Unlike the Claude SDK which validates on each HTTP request, Runware validates once on WebSocket connect.
**How to avoid:** Initialize the Runware client lazily (on first image node detection, not on plugin load). Handle auth errors from `requestImages` gracefully -- show Notice and update the placeholder node with error text. Don't crash the generation pipeline.
**Warning signs:** First image generation always fails, subsequent ones work after key fix.

## Code Examples

### Typed Node Tag Parsing (extending stream-handler.ts)

```typescript
// New types for stream handler
export interface TypedNodeMeta {
  type: 'text' | 'code' | 'mermaid' | 'image';
  lang?: string;
}

// Regex to match typed opening tags
const TYPED_NODE_OPEN_RE = /<node\s+type="(text|code|mermaid|image)"(?:\s+lang="([^"]*)")?\s*>/;

// Parse a typed opening tag from accumulated text
function parseTypedNodeTag(rawText: string, searchFrom: number): { 
  index: number; 
  endIndex: number;
  meta: TypedNodeMeta 
} | null {
  const substring = rawText.substring(searchFrom);
  const match = TYPED_NODE_OPEN_RE.exec(substring);
  if (!match) return null;
  return {
    index: searchFrom + match.index,
    endIndex: searchFrom + match.index + match[0].length,
    meta: {
      type: match[1] as TypedNodeMeta['type'],
      lang: match[2] || undefined,
    },
  };
}
```

### Runware Client Module (new: src/image/runware-client.ts)

```typescript
// Source: @runware/sdk-js v1.2.8 type definitions
import { Runware } from '@runware/sdk-js';
import type { ITextToImage } from '@runware/sdk-js';

const RIVERFLOW_MODEL = 'sourceful:riverflow-2.0@pro';
const DEFAULT_IMAGE_SIZE = 1024;

export class RunwareImageClient {
  private client: InstanceType<typeof Runware> | null = null;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async ensureClient(): Promise<InstanceType<typeof Runware>> {
    if (!this.client) {
      this.client = new Runware({ apiKey: this.apiKey });
      await this.client.ensureConnection();
    }
    return this.client;
  }

  async generateImage(prompt: string): Promise<ITextToImage[] | undefined> {
    const client = await this.ensureClient();
    return client.requestImages({
      positivePrompt: prompt,
      model: RIVERFLOW_MODEL,
      width: DEFAULT_IMAGE_SIZE,
      height: DEFAULT_IMAGE_SIZE,
      outputType: 'base64Data',
      outputFormat: 'PNG',
      numberResults: 1,
    });
  }

  async disconnect(): Promise<void> {
    await this.client?.disconnect();
    this.client = null;
  }
}
```

### Image Saver Module (new: src/image/image-saver.ts)

```typescript
// Source: Obsidian API vault.createBinary (obsidian.d.ts line 6431)
import type { Vault } from 'obsidian';
import { v4 as uuidv4 } from 'uuid';

const IMAGE_FOLDER = 'canvas-ai-images';

export class ImageSaver {
  constructor(private vault: Vault) {}

  async saveToVault(base64Data: string): Promise<string> {
    // Ensure folder exists
    if (!this.vault.getAbstractFileByPath(IMAGE_FOLDER)) {
      await this.vault.createFolder(IMAGE_FOLDER);
    }

    // Generate filename: {date}_{uuid-short}.png
    const date = new Date().toISOString().split('T')[0]; // "2026-04-03"
    const shortId = uuidv4().split('-')[0]; // First 8 chars
    const fileName = `${date}_${shortId}.png`;
    const filePath = `${IMAGE_FOLDER}/${fileName}`;

    // Decode base64 to ArrayBuffer
    const binary = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    await this.vault.createBinary(filePath, binary.buffer);

    return filePath;
  }
}
```

### Canvas Adapter: createFileNodeOnCanvas (extending canvas-adapter.ts)

```typescript
// Source: obsidian-typings Canvas.createFileNode (dist/cjs/types.d.cts line 26362)
// Parameter shape inferred from createTextNode pattern: { pos, size, file, focus }
createFileNodeOnCanvas(
  canvas: any,
  position: { x: number; y: number; width: number; height: number },
  filePath: string,
  color?: string
): any | null {
  try {
    const node = canvas.createFileNode({
      pos: { x: position.x, y: position.y },
      size: { width: position.width, height: position.height },
      file: filePath,
      focus: false,
    });

    if (color !== undefined) {
      node.setData({ color });
    }

    if (!canvas.nodes.has(node.id)) {
      canvas.addNode(node);
    }

    return node;
  } catch (e) {
    console.error('CanvasAdapter: createFileNodeOnCanvas failed', e);
    return null;
  }
}
```

### Updated Prompt (GENERATION_INSTRUCTIONS medium selection section)

```typescript
// Replace the "Medium Selection" section in GENERATION_INSTRUCTIONS
`## Output Format
Wrap each node in typed <node> tags. You may generate AT MOST one node per content type:

<node type="text">
A markdown explanation or insight.
</node>

<node type="code" lang="typescript">
const example = "properly fenced code";
</node>

<node type="mermaid">
graph TD
  A --> B --> C
</node>

<node type="image">
A vivid description of the image to generate.
</node>

Rules:
- Each <node> becomes a separate canvas node
- AT MOST one node of each type per response (max 4 nodes total)
- Never two text nodes or two code nodes
- Use 1-2 nodes for simple contexts, more types for rich/complex contexts
- Prefer text unless another medium adds clear value
- Code: use when context is technical -- always include lang attribute
- Mermaid: use for relationships, flows, hierarchies, sequences
- Image: use sparingly -- only when a visual concept is genuinely powerful
- Each node should contain a distinct idea, not duplicate information across types
- Never prefix content with labels like "AI:" or "Generated:"

## Medium Selection Guidelines
- Default to text for ideas, analysis, and narrative
- Add code when the user is working on something technical
- Add mermaid when relationships/structure would clarify
- Add image only when a visual would be genuinely impactful
- Do not generate images unless the spatial context strongly calls for it`
```

## State of the Art

| Old Approach (Phase 3) | New Approach (Phase 4) | What Changed | Impact |
|------------------------|------------------------|-------------|--------|
| `<node>content</node>` (untyped) | `<node type="text">content</node>` (typed) | D-01: Type attribute on opening tag | Stream handler must parse attributes |
| 1-3 same-type text nodes | Max 1 per type, up to 4 distinct types | D-02: One-per-type constraint | Prompt updated, enforcement in onNodeBoundary |
| Single rendering strategy (progressive) | Type-specific: progressive/buffered/async | D-10, D-12: Medium-specific behavior | Main.ts routing logic expanded |
| No image generation | Runware SDK with Riverflow 2.0 Pro | MMED-05, MMED-07: New capability | New module, new vault write path |

## Open Questions

1. **createFileNode exact parameter shape**
   - What we know: `createTextNode` takes `{ pos, size, text, focus }`. `obsidian-typings` shows `createFileNode(arg1: unknown)` exists.
   - What's unclear: The exact property names for the file path parameter. Is it `file` (matching CanvasFileData.file) or `filePath` (matching internal node property)?
   - Recommendation: Try `file` first (matching the canvas JSON format). Fall back to file-based JSON manipulation via vault if internal API fails. Defensive null check will catch incorrect shape immediately during manual testing.

2. **Placeholder-to-file-node swap mechanism**
   - What we know: We can removeNode and createFileNode. Both are internal API calls.
   - What's unclear: Whether `removeNode` properly cleans up the DOM element before `createFileNode` creates a new one, or if there's a brief visual gap.
   - Recommendation: Test both approaches: (a) remove then create, (b) create file node at same position then remove old. Pick whichever has smoother visual transition during manual testing.

3. **Runware connection lifecycle in Obsidian**
   - What we know: SDK uses WebSocket with auto-reconnect. Obsidian may close/reopen tabs.
   - What's unclear: Whether the WebSocket stays alive across Obsidian workspace changes (tab switches, window minimize).
   - Recommendation: Initialize lazily on first image request. If `requestImages` fails with connection error, re-initialize and retry once. Disconnect on plugin unload.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29 + ts-jest 29 |
| Config file | `jest.config.js` |
| Quick run command | `npm test -- --bail` |
| Full suite command | `npm test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MMED-02 | Code blocks with language tags in text nodes | unit | `npx jest tests/ai/stream-handler.test.ts -x` | Existing -- needs new test cases |
| MMED-03 | Mermaid fenced code blocks in text nodes | unit | `npx jest tests/ai/stream-handler.test.ts -x` | Existing -- needs new test cases |
| MMED-04 | Mermaid buffered until complete | unit | `npx jest tests/ai/stream-handler.test.ts -x` | Existing -- needs new test cases |
| MMED-05 | Runware API called with correct model/params | unit | `npx jest tests/image/runware-client.test.ts -x` | New file needed |
| MMED-06 | Image prompt extracted from node content | unit | `npx jest tests/ai/stream-handler.test.ts -x` | Existing -- needs new test cases |
| MMED-07 | Image saved to vault path | unit | `npx jest tests/image/image-saver.test.ts -x` | New file needed |
| MMED-08 | Placeholder node created before image generation | unit | `npx jest tests/canvas/canvas-adapter-write.test.ts -x` | Existing -- needs new test cases |

### Sampling Rate
- **Per task commit:** `npm test -- --bail`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/image/runware-client.test.ts` -- covers MMED-05 (Runware client with mocked SDK)
- [ ] `tests/image/image-saver.test.ts` -- covers MMED-07 (image save with mocked vault)
- [ ] `tests/__mocks__/runware.ts` -- mock Runware SDK for unit tests
- [ ] New test cases in `tests/ai/stream-handler.test.ts` for typed node parsing
- [ ] New test cases in `tests/ai/prompt-builder.test.ts` for multi-medium prompt instructions
- [ ] New test cases in `tests/canvas/canvas-adapter-write.test.ts` for createFileNodeOnCanvas

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build, test | Yes | v24.14.1 | -- |
| npm | Package management | Yes | 11.11.0 | -- |
| `@runware/sdk-js` | Image generation | Yes | 1.2.8 (installed) | -- |
| Runware API key | Image generation | Configurable | -- | Image nodes show error text; non-image generation unaffected |
| Obsidian (Electron) | Runtime, canvas API | Manual test only | -- | -- |

**Missing dependencies with no fallback:** None -- all dependencies are available.

**Missing dependencies with fallback:**
- Runware API key not configured: Image generation skipped gracefully, text/code/mermaid still work. Settings UI already has the field.

## Sources

### Primary (HIGH confidence)
- `@runware/sdk-js` v1.2.8 `dist/index.d.ts` -- Full TypeScript type definitions for RunwareBase, IRequestImage, ITextToImage, IImage interfaces
- `obsidian-typings` v5.17.0 `dist/cjs/types.d.cts` line 26362 -- `createFileNode(arg1: unknown)` exists on Canvas prototype
- `obsidian` v1.12.3 `obsidian.d.ts` line 6431 -- `vault.createBinary(path, data)` for binary file creation
- [Obsidian Canvas API type definitions](https://github.com/obsidianmd/obsidian-api/blob/master/canvas.d.ts) -- CanvasFileData interface: `{ type: 'file', file: string, subpath?: string }`
- Existing codebase: `src/ai/stream-handler.ts`, `src/canvas/canvas-adapter.ts`, `src/main.ts`, `src/ai/prompt-builder.ts`

### Secondary (MEDIUM confidence)
- [Runware SDK GitHub README](https://github.com/Runware/sdk-js) -- WebSocket-based, auto-reconnect, `requestImages` API
- [Runware JS Library docs](https://runware.ai/docs/en/libraries/javascript) -- SDK initialization and `requestImages` parameters
- [Riverflow 2.0 Pro model page](https://runware.ai/models/sourceful-riverflow-2-0-pro) -- AIR ID confirmed as `sourceful:riverflow-2.0@pro`
- [Obsidian Developer Documentation](https://docs.obsidian.md/Home) -- Plugin lifecycle, vault API
- Runware SDK bundled source (`dist/index.js`) -- Confirmed browser WebSocket detection via `typeof WebSocket < "u"`, `ws` dependency for Node.js fallback

### Tertiary (LOW confidence)
- `createFileNode` parameter shape -- Inferred from `createTextNode` pattern (`{ pos, size, file, focus }`). Not documented. Needs manual verification in Obsidian.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All libraries verified, installed, types checked
- Architecture: HIGH -- Extending well-understood existing patterns; stream handler, adapter, and prompt builder are thoroughly tested
- Runware integration: MEDIUM -- SDK is well-typed and documented, but WebSocket behavior in Electron untested; model AIR ID confirmed from multiple sources
- createFileNode shape: LOW -- Parameter format inferred from createTextNode analogy; obsidian-typings types it as `unknown`; needs manual testing
- Pitfalls: HIGH -- Based on direct codebase analysis and known Obsidian canvas behaviors from Phase 1-3 experience

**Research date:** 2026-04-03
**Valid until:** 2026-05-03 (stable stack, well-understood patterns)
