# Architecture Patterns

**Domain:** Obsidian Canvas AI Plugin (spatial AI ideation surface)
**Researched:** 2026-04-02

## Recommended Architecture

The plugin follows a **layered pipeline architecture** organized around Obsidian's plugin lifecycle. Six major components communicate through a central event bus, with data flowing from canvas observation through spatial analysis to multi-medium generation and back to canvas rendering.

```
+----------------------------------------------------------+
|                    Obsidian Plugin Shell                  |
|  (Plugin lifecycle, settings, commands, event registration)|
+----------------------------------------------------------+
        |              |              |              |
        v              v              v              v
+-------------+ +-------------+ +----------+ +-----------+
|   Canvas    | |   Spatial   | |   LLM    | |  Canvas   |
|  Observer   | |  Awareness  | | Pipeline | |  Renderer |
| (events +   | |  Engine     | | (Claude  | | (node     |
|  debounce)  | | (proximity, | |  + media | |  creation |
|             | |  clusters,  | |  routing) | |  + layout)|
|             | |  focus area)| |          | |           |
+------+------+ +------+------+ +-----+----+ +-----+-----+
       |               |              |             |
       v               v              v             v
+----------------------------------------------------------+
|                   Shared Services                         |
|  (API clients, taste profile, state manager, ID gen)     |
+----------------------------------------------------------+
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **Plugin Shell** | Obsidian lifecycle (`onload`/`onunload`), settings UI, command registration, resource cleanup | All components (owns their lifecycle) |
| **Canvas Observer** | Hooks into canvas events (node create/edit/move/delete), manages debounce timer, detects user idle | Spatial Awareness Engine (sends snapshot on idle) |
| **Spatial Awareness Engine** | Reads canvas state, computes proximity relationships, identifies clusters and focus areas, builds spatial context | Canvas Observer (receives triggers), LLM Pipeline (sends context) |
| **LLM Pipeline** | Orchestrates Claude API calls with spatial context + taste profile, routes Claude's medium decisions to generators, manages streaming | Spatial Awareness Engine (receives context), Image Generator (delegates), Canvas Renderer (sends content) |
| **Image Generator** | Manages Runware SDK connection, translates Claude's image descriptions into Runware API calls, handles async image delivery | LLM Pipeline (receives image requests), Canvas Renderer (sends image URLs/data) |
| **Canvas Renderer** | Creates new canvas nodes at computed positions, handles progressive text rendering during streaming, manages non-overlapping placement | LLM Pipeline (receives content), Spatial Awareness Engine (receives position guidance) |
| **Shared Services** | API client wrappers, taste profile manager, generation state tracker, unique ID generation | All components as needed |

### Data Flow

**Primary flow (idle trigger to rendered content):**

```
1. User acts on canvas (create/edit/move node)
         |
2. Canvas Observer detects event, resets debounce timer
         |
3. ~3s idle elapsed, debounce fires
         |
4. Spatial Awareness Engine reads canvas state:
   - All nodes with positions, dimensions, content
   - All edges (connections)
   - Identifies action area (recently changed nodes)
   - Computes proximity clusters around action area
   - Determines focus region for new content placement
         |
5. LLM Pipeline receives spatial context:
   - Builds prompt with spatial relationships + taste profile
   - Calls Claude API with streaming enabled
   - Claude decides medium type(s): text, code, diagram, image
         |
6. For each generated artifact:
   a. TEXT/CODE/MERMAID: Stream chunks to Canvas Renderer
      -> Renderer creates node, updates text progressively
   b. IMAGE: Claude provides description
      -> Image Generator calls Runware with description
      -> Receives image URL/data
      -> Canvas Renderer creates file node with image
         |
7. Canvas Renderer places nodes:
   - Calculates position near action area
   - Avoids overlapping existing nodes
   - Creates edges if semantically appropriate
   - Calls canvas.requestSave() to persist
```

**Secondary flows:**
- Settings changes -> Update taste profile -> Next generation uses new profile
- Canvas file change (external) -> Observer detects, does NOT trigger generation (only user actions trigger)

## Component Design Details

### 1. Plugin Shell

**Confidence:** HIGH (well-documented official API)

The Plugin Shell extends `Plugin` from `obsidian` and serves as the composition root. Obsidian plugins have a clean lifecycle:

```typescript
export default class CanvasAIPlugin extends Plugin {
  private canvasObserver: CanvasObserver;
  private spatialEngine: SpatialAwarenessEngine;
  private llmPipeline: LLMPipeline;
  private imageGenerator: ImageGenerator;
  private canvasRenderer: CanvasRenderer;
  private settings: CanvasAISettings;

  async onload(): Promise<void> {
    // 1. Load persisted settings
    this.settings = await this.loadSettings();

    // 2. Initialize shared services
    // 3. Initialize components (dependency injection via constructor)
    // 4. Register settings tab: this.addSettingTab(...)
    // 5. Register commands: this.addCommand(...)
    // 6. Register workspace events: this.registerEvent(...)
    // 7. Start canvas observation
  }

  onunload(): void {
    // Obsidian auto-cleans registerEvent/registerInterval/addChild
    // Manual cleanup: disconnect WebSocket (Runware), abort pending API calls
  }
}
```

Key patterns:
- Use `this.registerEvent()` for all event subscriptions (auto-cleanup on unload)
- Use `this.registerInterval()` for any polling (auto-cleanup on unload)
- Use `this.addChild()` for child components that extend `Component` (auto-cleanup)
- Settings via `this.loadData()` / `this.saveData()` persisted in `data.json`
- Obsidian provides a built-in `debounce()` utility importable from `'obsidian'`

### 2. Canvas Observer

**Confidence:** MEDIUM (relies on undocumented internal canvas API)

This is the trickiest component because Obsidian does **not** have an official, documented Canvas API for programmatic interaction. The canvas internals are accessed through undocumented paths that community plugins have reverse-engineered.

**Getting the canvas instance:**
```typescript
// Method 1: Active view (when user is looking at canvas)
const canvasView = this.app.workspace.getActiveViewOfType(ItemView);
if (canvasView?.getViewType() === 'canvas') {
  // @ts-ignore - undocumented internal API
  const canvas = (canvasView as any).canvas;
}

// Method 2: All canvas leaves
const canvasLeaves = this.app.workspace.getLeavesOfType('canvas');
const canvas = (canvasLeaves[0]?.view as any)?.canvas;
```

**Event detection strategy (two approaches):**

**Approach A - Monkey-patching (recommended):** Use the pattern from [obsidian-canvas-event-patcher](https://github.com/neonpalms/obsidian-canvas-event-patcher) to wrap internal canvas methods and emit custom events. This provides granular node-level events (create, move, edit, delete).

```typescript
// Conceptual pattern (based on community approach)
import { around } from 'monkey-around';

// Patch canvas prototype methods to emit events
const uninstaller = around(canvas.constructor.prototype, {
  addNode(original) {
    return function (...args: any[]) {
      const result = original.apply(this, args);
      // Emit custom event
      this.app.workspace.trigger('canvas-ai:node-added', result);
      return result;
    };
  }
});
// Store uninstaller for cleanup in onunload()
```

**Approach B - File watching (simpler fallback):** Watch the `.canvas` file for changes via `this.registerEvent(this.app.vault.on('modify', ...))` and diff the JSON to detect what changed. Simpler but loses granularity (cannot distinguish user actions from programmatic changes without a flag).

**Debounce integration:**
```typescript
import { debounce } from 'obsidian';

// Obsidian's built-in debounce
const debouncedTrigger = debounce(
  (canvasState: CanvasSnapshot) => {
    this.spatialEngine.analyze(canvasState);
  },
  3000,  // 3 second idle threshold
  true   // reset on each new event
);
```

**Critical caveat:** The canvas internal API (`canvas.getData()`, `canvas.nodes`, `canvas.edges`, `canvas.createTextNode()`, `canvas.requestSave()`) is undocumented and may break between Obsidian versions. The plugin must:
1. Guard all internal API access with try/catch
2. Check method existence before calling
3. Pin tested Obsidian versions in documentation
4. Have a fallback strategy (file-based approach)

### 3. Spatial Awareness Engine

**Confidence:** HIGH (pure computation, no external dependencies)

This is entirely custom logic -- no Obsidian API dependency beyond reading canvas data. It transforms raw node positions into semantic spatial relationships.

**Input:** Canvas snapshot (all nodes with positions + dimensions + content, all edges)

**Output:** `SpatialContext` object consumed by the LLM Pipeline

```typescript
interface SpatialContext {
  // The nodes that changed (trigger for this generation)
  actionNodes: NodeSummary[];

  // Nodes near the action area, grouped by proximity
  clusters: NodeCluster[];

  // The computed "focus area" where new content should appear
  focusRegion: BoundingBox;

  // All edges relevant to the action area
  connections: EdgeSummary[];

  // Human-readable spatial narrative for the LLM prompt
  spatialNarrative: string;
}

interface NodeCluster {
  centroid: { x: number; y: number };
  nodes: NodeSummary[];
  theme: string | null;  // Inferred from content if possible
  density: number;       // How tightly packed
}
```

**Core algorithms:**
- **Proximity calculation:** Euclidean distance between node centers, weighted by node dimensions. Nodes within a configurable radius (e.g., 500px) of the action node are "nearby."
- **Cluster detection:** Simple DBSCAN or threshold-based grouping. Nearby nodes that are also near each other form a cluster.
- **Focus area detection:** The action node's position biases placement. The spatial engine finds an open region near the action area that does not overlap existing nodes.
- **Spatial narrative generation:** Translates the spatial state into natural language for Claude. Example: "The user just edited a node about 'API Design' at center-right of the canvas. Nearby cluster (3 nodes) discusses 'REST patterns'. A distant cluster (5 nodes) at top-left covers 'Database Schema'. The edited node is connected via edge to 'Authentication' node."

### 4. LLM Pipeline

**Confidence:** HIGH (Anthropic TypeScript SDK is well-documented)

Orchestrates Claude API interaction. This is the "brain" that receives spatial context and produces generation instructions.

**Streaming approach (critical decision):**

Obsidian's `requestUrl()` does NOT support streaming responses. Since this is a desktop-only plugin, use the **Anthropic TypeScript SDK directly** via `@anthropic-ai/sdk`. Obsidian desktop runs on Electron which provides full Node.js capabilities, so the SDK's native `fetch`-based streaming works without CORS issues.

```typescript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: settings.anthropicApiKey });

const stream = client.messages.stream({
  model: 'claude-opus-4-6',
  max_tokens: 4096,
  system: buildSystemPrompt(tasteProfile, spatialContext),
  messages: [{ role: 'user', content: buildUserPrompt(spatialContext) }],
});

stream.on('text', (text) => {
  // Progressive rendering: update canvas node text as chunks arrive
  canvasRenderer.appendToActiveNode(text);
});

const finalMessage = await stream.finalMessage();
```

**Prompt architecture:**
- **System prompt:** Includes taste profile, output format instructions, medium selection criteria
- **User prompt:** Contains the spatial narrative, recent node contents, connection context
- **Output format:** Claude responds with structured blocks indicating medium type + content:

```
[TEXT]
Content here...
[/TEXT]

[CODE:typescript]
function example() { ... }
[/CODE]

[MERMAID]
graph TD
  A --> B
[/MERMAID]

[IMAGE]
Description for image generation: A watercolor illustration of...
[/IMAGE]
```

The pipeline parses these blocks and routes each to the appropriate renderer.

**Rate limiting and error handling:**
- Track in-flight requests; prevent re-triggering while generation is active
- Exponential backoff on API errors (429, 500, 529)
- Cancel in-flight generation if user resumes activity before completion

### 5. Image Generator

**Confidence:** HIGH (Runware SDK well-documented, WebSocket-based)

Manages the Runware SDK connection for image generation via Riverflow 2.0 Pro.

```typescript
import { Runware } from '@runware/sdk-js';

class ImageGenerator {
  private runware: Runware;

  async initialize(apiKey: string): Promise<void> {
    this.runware = new Runware({ apiKey });
    await this.runware.ensureConnection();
  }

  async generateImage(description: string, width = 1024, height = 1024): Promise<string> {
    const results = await this.runware.imageInference({
      positivePrompt: description,
      model: 'civitai:618692@693048',  // Riverflow 2.0 Pro AIR ID (VERIFY)
      width,
      height,
      numberResults: 1,
      outputType: 'URL',
      outputFormat: 'PNG',
    });
    return results[0].imageURL;
  }

  async disconnect(): Promise<void> {
    await this.runware.disconnect();
  }
}
```

**Image storage strategy:**
1. Download image from Runware URL to vault attachment folder
2. Create a canvas file node pointing to the local attachment
3. This ensures images persist even if URLs expire

**Key consideration:** The Runware SDK uses WebSocket connections. Initialize lazily (first image request) rather than at plugin load to avoid unnecessary connections. Disconnect on plugin unload.

**Riverflow 2.0 Pro model ID:** The exact AIR (Artificial Intelligence Resource) identifier for Riverflow 2.0 Pro on Runware needs to be verified at development time. Runware uses the format `civitai:{modelId}@{versionId}` for CivitAI-hosted models. Flag: LOW confidence on exact model ID -- must be looked up in Runware dashboard or docs during implementation.

### 6. Canvas Renderer

**Confidence:** MEDIUM (relies on undocumented internal canvas API)

Creates new nodes on the canvas and manages progressive text rendering during streaming.

**Two strategies for creating nodes:**

**Strategy A - Internal API (recommended for live canvases):**
```typescript
// Access canvas internals (undocumented)
// @ts-ignore
const canvas = canvasView.canvas;

// Create a text node
const node = canvas.createTextNode({
  pos: { x: targetX, y: targetY },
  size: { width: 400, height: 300 },
  text: '',  // Start empty, fill via streaming
});

// Progressive text update during streaming
node.setText(accumulatedText);

// Persist
canvas.requestSave();
```

**Strategy B - File modification (safer fallback):**
```typescript
// Read canvas file
const canvasFile = this.app.vault.getAbstractFileByPath('canvas.canvas');
const content = await this.app.vault.read(canvasFile);
const canvasData = JSON.parse(content);

// Add node to data
canvasData.nodes.push({
  id: generateId(),
  type: 'text',
  text: generatedContent,
  x: targetX,
  y: targetY,
  width: 400,
  height: 300,
});

// Write back
await this.app.vault.modify(canvasFile, JSON.stringify(canvasData));
```

**Critical warning:** `vault.modify()` and `vault.process()` fail if called within 2 seconds of a canvas `requestSave` debounce event. When using file modification, wait for the canvas's internal save debounce to complete, or exclusively use the internal API approach which avoids this conflict.

**Node types and how to render each medium:**

| Medium | Node Type | How to Render |
|--------|-----------|---------------|
| **Text/Markdown** | `text` node | Set `text` property with markdown content. Obsidian renders markdown natively in text nodes. |
| **Code blocks** | `text` node | Wrap in markdown code fence: ````typescript\n...\n```` |
| **Mermaid diagrams** | `text` node | Wrap in markdown code fence: ````mermaid\n...\n````. Obsidian renders Mermaid natively. |
| **SVG diagrams** | `file` node | Save SVG to vault, create file node pointing to it. Canvas renders SVG files inline. |
| **Generated images** | `file` node | Download image to vault attachment folder, create file node pointing to local path. |

**Placement algorithm:**
1. Get the action area bounding box from Spatial Awareness Engine
2. Find an unoccupied region adjacent to the action area (prefer right or below)
3. Check for overlap with all existing nodes using axis-aligned bounding box (AABB) collision
4. If overlap detected, shift position incrementally until clear
5. Optionally color-code generated nodes (using canvas color palette `"1"` through `"6"`) to visually distinguish AI-generated content from user content

**Progressive rendering during streaming:**
1. Create an empty text node at the computed position when streaming begins
2. As text chunks arrive from Claude, call `node.setText(accumulatedText)` to update
3. Optionally resize node height as content grows
4. On stream completion, finalize node dimensions and call `canvas.requestSave()`

### 7. Shared Services

**Taste Profile Manager:**
- Loads taste profile from a markdown file in the vault (configurable path in settings)
- Provides the profile text to the LLM Pipeline for inclusion in system prompts
- Watches for file changes to reload profile in real-time
- Supports per-user profiles (switchable in settings or via separate files)

**Generation State Manager:**
- Tracks whether a generation is currently in-flight
- Prevents overlapping generations (debounce ignores triggers while generating)
- Provides cancellation capability (abort controller for Claude stream)

**ID Generator:**
- Canvas node and edge IDs need only be unique strings within a canvas
- Use a 16-character random hex string (matching the pattern used by Obsidian internally)

## Patterns to Follow

### Pattern 1: Guarded Internal API Access
**What:** Always guard access to undocumented canvas internals with existence checks and try/catch
**When:** Any time you access `canvas.*` methods or properties

```typescript
function getCanvasInstance(app: App): any | null {
  try {
    const leaves = app.workspace.getLeavesOfType('canvas');
    if (leaves.length === 0) return null;
    const view = leaves[0].view as any;
    if (!view?.canvas) return null;
    return view.canvas;
  } catch {
    return null;
  }
}

function safeCreateTextNode(canvas: any, params: any): any | null {
  if (typeof canvas?.createTextNode !== 'function') {
    console.warn('Canvas API changed: createTextNode not found');
    return null;
  }
  try {
    return canvas.createTextNode(params);
  } catch (e) {
    console.error('Failed to create canvas node:', e);
    return null;
  }
}
```

### Pattern 2: Dual-Strategy Canvas Interaction
**What:** Implement both internal API and file-based approaches, with automatic fallback
**When:** All canvas read/write operations

```typescript
class CanvasAdapter {
  async addTextNode(content: string, position: Position): Promise<boolean> {
    // Try internal API first (supports progressive rendering)
    const canvas = getCanvasInstance(this.app);
    if (canvas && typeof canvas.createTextNode === 'function') {
      return this.addViaInternalAPI(canvas, content, position);
    }
    // Fallback to file modification
    return this.addViaFileModification(content, position);
  }
}
```

### Pattern 3: Structured LLM Output Parsing
**What:** Parse Claude's multi-medium response into discrete renderable blocks
**When:** Processing LLM Pipeline output

```typescript
interface GenerationBlock {
  type: 'text' | 'code' | 'mermaid' | 'image';
  content: string;
  language?: string;  // For code blocks
}

function parseGenerationResponse(response: string): GenerationBlock[] {
  // Parse [TEXT]...[/TEXT], [CODE:lang]...[/CODE], etc.
  // Returns ordered array of blocks for sequential rendering
}
```

### Pattern 4: Event-Driven Debounce Pipeline
**What:** Use Obsidian's built-in debounce for the idle detection pipeline
**When:** Canvas event handling

The debounce function from `obsidian` package resets on each new event. Combined with an "is generating" flag, this prevents cascade triggers.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Direct File Modification During Active Canvas Editing
**What:** Using `vault.modify()` on a `.canvas` file while the canvas view is open and has pending saves
**Why bad:** Obsidian's canvas has an internal `requestSave` debounce (~2 seconds). Calling `vault.modify()` during this window causes the modification to be silently overwritten by the canvas's pending save, resulting in lost data.
**Instead:** Use the internal canvas API (`canvas.createTextNode()`, `canvas.requestSave()`) when the canvas is open. Only use file modification when the canvas is not actively being edited, or as a fallback when internal API is unavailable.

### Anti-Pattern 2: Unbounded Re-entrancy
**What:** AI-generated nodes triggering the observer, which triggers more generation, ad infinitum
**Why bad:** Creates an infinite loop of generation that consumes API credits and fills the canvas
**Instead:** Maintain a set of "AI-generated node IDs" and filter them from the observer's trigger logic. Alternatively, set a flag during generation that suppresses the observer.

### Anti-Pattern 3: Blocking the Main Thread with API Calls
**What:** Making synchronous or long-running API calls on Obsidian's main thread
**Why bad:** Freezes the entire Obsidian UI, making it unresponsive
**Instead:** All API calls (Claude, Runware) must be async. Use streaming for Claude to provide progressive feedback. Show visual indicators (status bar, node loading state) during generation.

### Anti-Pattern 4: Storing API Keys in Plugin Settings JSON
**What:** Saving API keys directly to `data.json` (plugin settings file) without encryption
**Why bad:** `data.json` is plaintext in the vault. If the vault is synced or shared, keys are exposed.
**Instead:** For a small team internal tool, plaintext in settings is acceptable with a warning. For broader distribution, consider Obsidian's secure storage or environment variable patterns. Document the risk.

### Anti-Pattern 5: Modifying Existing User Nodes
**What:** Overwriting or editing content in nodes the user created
**Why bad:** Violates user trust and makes it impossible to distinguish original thought from AI output
**Instead:** Always create NEW nodes. This is already a stated v1 requirement but worth reinforcing architecturally.

## Scalability Considerations

| Concern | Small Canvas (< 50 nodes) | Medium Canvas (50-200 nodes) | Large Canvas (200+ nodes) |
|---------|---------------------------|------------------------------|---------------------------|
| **Spatial analysis** | Full canvas scan, trivial performance | Full scan still fine, < 50ms | Viewport-only analysis or spatial indexing needed |
| **Context window** | Send all node content to Claude | Summarize distant clusters, full content for nearby | Only send nearby cluster content, reference counts for distant |
| **Node placement** | Simple offset from action area | Overlap detection with nearby nodes | Spatial grid or quadtree for efficient overlap queries |
| **Canvas re-render** | Negligible impact | Obsidian handles well | Test: Obsidian's own rendering may slow; limit visible generated nodes |
| **Claude API tokens** | Well within limits | May approach token limits if nodes have long content | Must truncate/summarize; use prompt budgeting |

## Technology Decisions Embedded in Architecture

| Decision | Rationale |
|----------|-----------|
| **Anthropic TypeScript SDK (not requestUrl)** | Desktop-only plugin running in Electron has full Node.js access. The SDK provides native streaming support via SSE, which `requestUrl()` does not support. |
| **Runware JS SDK (WebSocket)** | Persistent WebSocket connection provides sub-second image generation. Lazy initialization avoids unnecessary connections. |
| **Monkey-patching for canvas events** | No official canvas event API exists. Community-proven pattern (used by Advanced Canvas, Canvas Presentation, Canvas MindMap plugins). |
| **Internal API + file fallback dual strategy** | Internal API enables progressive rendering (streaming text to nodes). File fallback provides resilience against API changes. |
| **Text nodes for markdown/code/Mermaid** | Obsidian renders markdown (including code fences and Mermaid diagrams) natively in canvas text nodes. No custom rendering needed. |
| **File nodes for images/SVG** | Canvas renders image files and SVGs inline when referenced as file nodes. Images saved to vault persist beyond URL expiry. |

## Suggested Build Order

Dependencies between components dictate the build sequence:

```
Phase 1: Foundation
  Plugin Shell + Settings UI + Canvas Observer (basic)
  Why first: Everything else depends on the plugin skeleton and
  the ability to detect canvas activity.

Phase 2: Spatial Intelligence
  Spatial Awareness Engine
  Why second: Needed before LLM integration to have meaningful
  context. Can be tested independently with mock canvas data.

Phase 3: Text Generation
  LLM Pipeline (text only) + Canvas Renderer (text nodes only)
  Why third: Core value proposition. Streaming text to canvas
  nodes is the minimum viable experience.

Phase 4: Multi-Medium Generation
  Code blocks, Mermaid diagrams (still text nodes, low effort)
  + Image Generator (Runware) + Canvas Renderer (file nodes)
  Why fourth: Extends the working text pipeline to other media.
  Image generation is independent and can be added incrementally.

Phase 5: Polish
  Taste profile system + progressive rendering refinement
  + placement algorithm tuning + error handling hardening
  Why last: Refinement layer on top of working core.
```

## File/Folder Structure (Recommended)

```
src/
  main.ts                          # Plugin Shell (entry point)
  settings.ts                      # PluginSettingTab + settings types
  types/
    canvas-internal.ts             # Type declarations for undocumented canvas API
    spatial.ts                     # SpatialContext, NodeCluster, etc.
    generation.ts                  # GenerationBlock, medium types
  observer/
    canvas-observer.ts             # Canvas event detection + debounce
    canvas-patcher.ts              # Monkey-patching for canvas events
  spatial/
    spatial-engine.ts              # Proximity analysis, clustering, focus area
    placement.ts                   # Non-overlapping node placement algorithm
  pipeline/
    llm-pipeline.ts                # Claude API orchestration + streaming
    prompt-builder.ts              # System/user prompt construction
    response-parser.ts             # Multi-medium block parsing
  generators/
    image-generator.ts             # Runware SDK wrapper
  renderer/
    canvas-renderer.ts             # Node creation + progressive rendering
    canvas-adapter.ts              # Dual-strategy (internal API + file fallback)
  services/
    taste-profile.ts               # Taste profile loading + watching
    state-manager.ts               # Generation state tracking
    id-generator.ts                # Canvas-compatible unique IDs
```

## Sources

- [Obsidian Plugin API TypeScript Reference](https://docs.obsidian.md/Reference/TypeScript+API/Plugin) - HIGH confidence
- [Obsidian API Type Definitions (GitHub)](https://github.com/obsidianmd/obsidian-api) - HIGH confidence
- [Canvas Type Definitions (canvas.d.ts)](https://github.com/obsidianmd/obsidian-api/blob/master/canvas.d.ts) - HIGH confidence
- [JSON Canvas Specification](https://jsoncanvas.org/) - HIGH confidence
- [DeepWiki: Canvas System](https://deepwiki.com/obsidianmd/obsidian-api/4.1-canvas-api) - HIGH confidence
- [DeepWiki: Plugin Development](https://deepwiki.com/obsidianmd/obsidian-api/3-plugin-development) - HIGH confidence
- [Obsidian Advanced Canvas Plugin](https://github.com/Developer-Mike/obsidian-advanced-canvas) - MEDIUM confidence (community source, demonstrates canvas event patterns)
- [Obsidian Canvas Event Patcher](https://github.com/neonpalms/obsidian-canvas-event-patcher) - MEDIUM confidence (community utility, monkey-patch approach)
- [Quorafind Canvas Presentation Plugin](https://github.com/Quorafind/Obsidian-Canvas-Presentation/blob/master/canvasPresentationIndex.ts) - MEDIUM confidence (community source, demonstrates internal API patterns)
- [Quorafind Link Nodes In Canvas](https://github.com/Quorafind/Obsidian-Link-Nodes-In-Canvas/blob/master/linkNodesInCanvasIndex.ts) - MEDIUM confidence (community source, demonstrates canvas.getData/setData/requestSave)
- [Forum: Canvas API Details](https://forum.obsidian.md/t/any-details-on-the-canvas-api/57120) - MEDIUM confidence
- [Forum: requestUrl Streaming Limitation](https://forum.obsidian.md/t/support-streaming-the-request-and-requesturl-response-body/87381) - HIGH confidence (confirmed limitation)
- [Forum: vault.modify vs requestSave Conflict](https://forum.obsidian.md/t/vault-process-and-vault-modify-dont-work-when-there-is-a-requestsave-debounce-event/107862) - HIGH confidence (confirmed bug/limitation)
- [Anthropic Streaming API Documentation](https://platform.claude.com/docs/en/build-with-claude/streaming) - HIGH confidence
- [Runware JavaScript SDK (GitHub)](https://github.com/Runware/sdk-js) - HIGH confidence
- [Obsidian debounce API](https://docs.obsidian.md/Reference/TypeScript+API/debounce) - HIGH confidence
