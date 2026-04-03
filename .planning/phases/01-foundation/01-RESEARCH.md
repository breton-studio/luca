# Phase 1: Foundation - Research

**Researched:** 2026-04-02
**Domain:** Obsidian plugin development, canvas internal APIs, monkey-patching, settings UI, event debouncing
**Confidence:** HIGH

## Summary

Phase 1 builds the plugin shell: project scaffolding from the Obsidian sample plugin template, a Canvas Adapter Layer that wraps undocumented internal APIs behind a stable interface, monkey-patching of canvas methods to detect node create/edit/move/delete events, a configurable debounce timer with AbortController cancellation, a settings tab for API keys and behavior, per-canvas enable/disable via right-click context menu, and a text-based status bar indicator.

The technical risk is concentrated in canvas event interception. Canvas internals are undocumented and accessed through monkey-patching -- a well-established community pattern (used by Advanced Canvas, Canvas Style Menu, Better Canvas Lock, and others) but one that can break on Obsidian updates. The Canvas Adapter Layer mitigates this by isolating all internal API access behind a stable interface, with a file-based JSON fallback.

**Primary recommendation:** Scaffold from the official Obsidian sample plugin template. Use `monkey-around` to patch Canvas prototype methods (`addNode`, `removeNode`, `markMoved`, `requestSave`) accessed via `workspace.on('active-leaf-change')` to obtain the Canvas prototype at runtime. Wrap all canvas internals in a CanvasAdapter class. Use Obsidian's built-in `debounce()` for the idle timer. Persist per-canvas state in plugin `data.json` via `loadData()`/`saveData()`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Text badge style -- no emoji/icons. States: "AI: idle", "AI: thinking", "AI: error", "AI: off"
- **D-02:** Clicking the status bar opens a status popover showing current state + last trigger time
- **D-03:** No debounce countdown in status bar -- just flip directly from "idle" to "thinking" when debounce fires
- **D-04:** When canvas is disabled, hide the status bar item entirely (don't show "AI: off")
- **D-05:** Grouped sections with headings -- API Keys section, Behavior section (debounce, debug mode)
- **D-06:** API keys validated on save (auto-test when settings are saved, show inline success/fail)
- **D-07:** API key fields displayed as plain text (not masked)
- **D-08:** Debounce delay uses a slider input (1-10s range) with current value label displayed
- **D-09:** Per-canvas toggle -- each canvas can be independently enabled/disabled
- **D-10:** Toggle accessed via canvas right-click context menu ("Enable/Disable Canvas AI")
- **D-11:** Newly opened canvases default to enabled
- **D-12:** Per-canvas state needs to be tracked and persisted (implementation detail for planner)
- **D-13:** Silent during normal use -- events only trigger internal debounce, status bar shows "thinking" when debounce fires
- **D-14:** Debug mode togglable in settings -- when enabled, logs all detected canvas events to developer console
- **D-15:** Missing API key triggers status bar error ("AI: no API key") plus a one-time dismissable Obsidian notice guiding user to settings

### Claude's Discretion
- How to persist per-canvas enabled/disabled state (frontmatter, separate config, etc.)
- Status popover implementation approach (Obsidian Menu, custom DOM, etc.)
- Canvas right-click menu integration method (monkey-patch vs event listener)
- Exact slider widget implementation within Obsidian's Setting API

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOUN-01 | Plugin loads in Obsidian and registers lifecycle hooks (onload/onunload) | Official sample plugin template provides exact pattern; Plugin class extends Component with auto-cleanup |
| FOUN-02 | Canvas Adapter Layer wraps all undocumented canvas internal APIs behind a stable interface | obsidian-typings v5.17.0 provides full typed Canvas interface (CanvasViewCanvas, CanvasViewCanvasNode); adapter pattern isolates internal API calls |
| FOUN-03 | Canvas Adapter has file-based JSON fallback when internal APIs are unavailable | Canvas data is standard JSON (CanvasData with nodes[] and edges[]); vault.read()/vault.modify() provide file I/O |
| FOUN-04 | Plugin detects canvas node create events via monkey-patching | monkey-around patches Canvas.prototype.addNode / createTextNode / createFileNode / createLinkNode / createGroupNode |
| FOUN-05 | Plugin detects canvas node edit events via monkey-patching | Patch Canvas.prototype.requestSave (fires on any content change) and/or CanvasNode.prototype.setData |
| FOUN-06 | Plugin detects canvas node move events via monkey-patching | Patch Canvas.prototype.markMoved (fires when nodes are repositioned) |
| FOUN-07 | Plugin detects canvas node delete events via monkey-patching | Patch Canvas.prototype.removeNode (fires on node deletion) |
| FOUN-08 | Debounce timer triggers generation after ~3s of user idle (configurable) | Obsidian's built-in debounce() function; configurable 1-10s via Setting.addSlider() |
| FOUN-09 | In-flight generation requests are cancelled when new debounce fires (AbortController) | Standard AbortController pattern; store controller reference, abort on new trigger |
| FOUN-10 | Settings UI with fields for Claude API key, Runware API key, and debounce delay | PluginSettingTab with Setting.addText() for keys, Setting.addSlider() with setLimits(1,10,'any') for debounce |
| FOUN-11 | Enable/disable toggle accessible from command palette and status bar | Plugin.addCommand() for palette; status bar click handler + per-canvas context menu |
| FOUN-12 | Generation indicator in status bar shows thinking/idle/error state | addStatusBarItem() returns HTMLElement; setText() for state changes; registerDomEvent for click |
| FOUN-13 | Canvas Adapter handles requestSave race condition (uses internal API, not vault.modify) | Primary path uses Canvas internal API (addNode, etc.); requestSave has 2-second debounce; file I/O is fallback only |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

The following directives from CLAUDE.md are binding on all planning and implementation:

- **Build tool:** esbuild only. Do NOT use webpack/vite/rollup.
- **UI framework:** Vanilla DOM + Obsidian API only. No React/Svelte/Vue.
- **HTTP clients:** No axios/node-fetch. Use SDK-specific transport or Obsidian's requestUrl.
- **Mermaid:** Do NOT bundle mermaid npm package. Use Obsidian's built-in renderer.
- **Canvas events:** Use monkey-around, NOT obsidian-canvas-event-patcher (git submodule).
- **Language:** TypeScript with strict mode.
- **monkey-around pinning:** Pin exactly at 3.0.0 -- breaking changes in patch utilities can be catastrophic.
- **External packages:** `obsidian` and `electron` are external (not bundled). `@codemirror/*` and `@lezer/*` are external. Node.js builtins are external.
- **Bundled packages:** `@anthropic-ai/sdk` and `@runware/sdk-js` WILL be bundled (not external).
- **Entry point:** `src/main.ts` -> `main.js` (CommonJS format, ES2018 target).
- **Canvas manipulation:** Primary = internal API monkey-patching. Fallback = file-based JSON via vault.modify(). Never use vault.modify() when canvas is actively saving.

## Standard Stack

### Core (Phase 1 dependencies)

| Library | Version | Purpose | Why Standard | Verified |
|---------|---------|---------|--------------|----------|
| `obsidian` | 1.12.3 | Plugin API, workspace events, vault I/O, settings UI | Official API, non-negotiable | npm registry 2026-04-02 |
| TypeScript | ^5.5 (latest 5.9.3) | Language | Obsidian sample plugin uses TS; strict mode required | npm registry 2026-04-02 |
| esbuild | ^0.24 (latest 0.24.2) | Bundler | Official Obsidian sample plugin build tool | npm registry 2026-04-02 |
| `obsidian-typings` | 5.17.0 | Canvas internal API type definitions | Community-maintained types for CanvasView, CanvasViewCanvas, CanvasViewCanvasNode | npm registry 2026-04-02 |
| `monkey-around` | 3.0.0 (exact) | Monkey-patching Canvas prototype methods | De-duplicated, uninstallable patches; used by Advanced Canvas and major canvas plugins | npm registry 2026-04-02 |

### Version Note: obsidian-typings

**IMPORTANT:** CLAUDE.md specifies `^4.88.0` but the obsidian-typings project has moved to v5.x. The dist-tag mapping shows:
- `obsidian-public-1.12.4` -> v5.17.0
- The latest 4.x compatible version is 4.111.0 (for older Obsidian)

Since we target Obsidian ^1.12.3, use `obsidian-typings@5.17.0` (tagged `obsidian-public-1.12.4`). The v5 release is a major reorganization of the type definitions -- interfaces like `CanvasViewCanvas` and `CanvasViewCanvasNode` use new naming conventions. If the CLAUDE.md ^4.88.0 is treated as a hard lock, use 4.111.0 instead, but types may be less accurate for current Obsidian. **Recommendation: update CLAUDE.md to reflect 5.17.0.**

### Not Needed in Phase 1

| Library | Why Deferred |
|---------|-------------|
| `@anthropic-ai/sdk` | No API calls in Phase 1 -- just key storage and validation |
| `@runware/sdk-js` | No image generation in Phase 1 -- just key storage |
| `uuid` | No node creation in Phase 1 |
| `zod` | Optional; plain TypeScript interfaces suffice for Phase 1 settings |

### Installation

```bash
# Clone from official template
npx degit obsidianmd/obsidian-sample-plugin obsidian-canvas-ai
cd obsidian-canvas-ai

# Install core dependencies
npm install monkey-around@3.0.0

# Install dev dependencies
npm install --save-dev obsidian-typings@5.17.0

# Verify build
npm run build
```

## Architecture Patterns

### Recommended Project Structure

```
src/
  main.ts                    # Plugin entry point (onload/onunload)
  settings.ts                # PluginSettingTab implementation
  canvas/
    canvas-adapter.ts        # Canvas Adapter Layer (stable interface)
    canvas-patcher.ts        # monkey-around patches for canvas events
    canvas-events.ts         # Event type definitions and emitter
  ui/
    status-bar.ts            # Status bar indicator + popover
  types/
    settings.ts              # Settings interface and defaults
    canvas.ts                # Re-exports from obsidian-typings for convenience
```

### Pattern 1: Canvas Prototype Access via Active Leaf Change

**What:** Obtain the Canvas constructor prototype by watching for canvas leaves to become active, then apply monkey-patches to the prototype (once) so they apply to all canvas instances.

**When to use:** During plugin initialization, to set up all canvas event interception.

```typescript
// Source: Pattern derived from obsidian-canvas-event-patcher and Advanced Canvas
import { around } from 'monkey-around';
import type { CanvasView } from 'obsidian-typings';

function patchCanvasPrototype(plugin: Plugin): void {
  let patched = false;

  plugin.registerEvent(
    plugin.app.workspace.on('active-leaf-change', (leaf) => {
      if (patched) return;
      if (!leaf || leaf.view.getViewType() !== 'canvas') return;

      const canvasView = leaf.view as CanvasView;
      const canvas = canvasView.canvas;
      const canvasProto = Object.getPrototypeOf(canvas);

      // Patch addNode for create events
      const uninstallAddNode = around(canvasProto, {
        addNode(oldMethod) {
          return function (this: any, ...args: any[]) {
            const result = oldMethod.apply(this, args);
            plugin.app.workspace.trigger('canvas-ai:node-created', result);
            return result;
          };
        },
      });

      // Patch removeNode for delete events
      const uninstallRemoveNode = around(canvasProto, {
        removeNode(oldMethod) {
          return function (this: any, ...args: any[]) {
            plugin.app.workspace.trigger('canvas-ai:node-removed', args[0]);
            return oldMethod.apply(this, args);
          };
        },
      });

      // Patch markMoved for move events
      const uninstallMarkMoved = around(canvasProto, {
        markMoved(oldMethod) {
          return function (this: any, ...args: any[]) {
            plugin.app.workspace.trigger('canvas-ai:node-moved', args[0]);
            return oldMethod.apply(this, args);
          };
        },
      });

      // Patch requestSave to detect edits
      const uninstallRequestSave = around(canvasProto, {
        requestSave(oldMethod) {
          return function (this: any, ...args: any[]) {
            plugin.app.workspace.trigger('canvas-ai:canvas-changed', this);
            return oldMethod.apply(this, args);
          };
        },
      });

      // Register uninstallers for cleanup
      plugin.register(uninstallAddNode);
      plugin.register(uninstallRemoveNode);
      plugin.register(uninstallMarkMoved);
      plugin.register(uninstallRequestSave);

      patched = true;
    })
  );
}
```

### Pattern 2: Canvas Adapter Layer

**What:** A class that wraps all undocumented canvas access behind stable method signatures, with file-based fallback.

**When to use:** Every time the plugin needs to read canvas state or manipulate canvas data.

```typescript
// Source: Architecture pattern derived from CLAUDE.md technical decisions
import type { CanvasView, CanvasViewCanvas, CanvasViewCanvasNode } from 'obsidian-typings';
import type { App, TFile, ItemView, WorkspaceLeaf } from 'obsidian';
import type { CanvasData, AllCanvasNodeData } from 'obsidian/canvas';

export class CanvasAdapter {
  constructor(private app: App) {}

  /** Get the active canvas view, or null */
  getActiveCanvas(): CanvasViewCanvas | null {
    const view = this.app.workspace.getActiveViewOfType(
      // ItemView is the base; cast after type check
      require('obsidian').ItemView
    );
    if (!view || view.getViewType() !== 'canvas') return null;
    return (view as unknown as CanvasView).canvas;
  }

  /** Get all nodes from active canvas via internal API */
  getNodes(canvas: CanvasViewCanvas): CanvasViewCanvasNode[] {
    return Array.from(canvas.nodes.values());
  }

  /** Get canvas file path for per-canvas state tracking */
  getCanvasFilePath(canvas: CanvasViewCanvas): string | null {
    return canvas.view?.file?.path ?? null;
  }

  /** Fallback: read canvas data from file */
  async readCanvasFile(file: TFile): Promise<CanvasData | null> {
    try {
      const content = await this.app.vault.read(file);
      return JSON.parse(content) as CanvasData;
    } catch {
      return null;
    }
  }
}
```

### Pattern 3: Debounce with AbortController

**What:** Use Obsidian's built-in debounce() to create an idle timer that fires after configurable delay, cancelling any in-flight work.

**When to use:** Every canvas event funnels through this debounce before triggering generation.

```typescript
// Source: Obsidian API debounce + standard AbortController
import { debounce } from 'obsidian';

class GenerationController {
  private abortController: AbortController | null = null;
  private debouncedTrigger: ReturnType<typeof debounce>;

  constructor(
    private delayMs: number,
    private onTrigger: (signal: AbortSignal) => void
  ) {
    this.debouncedTrigger = debounce(
      () => this.fire(),
      delayMs,
      true // resetTimer: restart timer on each call
    );
  }

  /** Called on every canvas event */
  handleCanvasEvent(): void {
    this.debouncedTrigger();
  }

  private fire(): void {
    // Cancel any in-flight request
    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();
    this.onTrigger(this.abortController.signal);
  }

  /** Update delay when settings change */
  updateDelay(newDelayMs: number): void {
    this.delayMs = newDelayMs;
    this.debouncedTrigger = debounce(
      () => this.fire(),
      newDelayMs,
      true
    );
  }

  destroy(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }
}
```

### Pattern 4: Settings Tab with Grouped Sections and Slider

**What:** PluginSettingTab with grouped headings, text inputs for API keys with validation, and a slider for debounce delay.

```typescript
// Source: Obsidian API Setting class (docs.obsidian.md)
import { PluginSettingTab, Setting, Notice } from 'obsidian';

class CanvasAISettingTab extends PluginSettingTab {
  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // --- API Keys Section ---
    new Setting(containerEl).setName('API Keys').setHeading();

    new Setting(containerEl)
      .setName('Claude API key')
      .setDesc('Your Anthropic API key for Claude Opus 4.6')
      .addText((text) =>
        text
          .setPlaceholder('sk-ant-...')
          .setValue(this.plugin.settings.claudeApiKey)
          .onChange(async (value) => {
            this.plugin.settings.claudeApiKey = value;
            await this.plugin.saveSettings();
          })
      );

    // --- Behavior Section ---
    new Setting(containerEl).setName('Behavior').setHeading();

    new Setting(containerEl)
      .setName('Debounce delay')
      .setDesc('Seconds of idle before AI generates')
      .addSlider((slider) =>
        slider
          .setLimits(1, 10, 1)     // min, max, step
          .setValue(this.plugin.settings.debounceDelay)
          .setDynamicTooltip()      // Shows current value
          .onChange(async (value) => {
            this.plugin.settings.debounceDelay = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Debug mode')
      .setDesc('Log canvas events to developer console')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.debugMode)
          .onChange(async (value) => {
            this.plugin.settings.debugMode = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
```

### Pattern 5: Per-Canvas Toggle via Right-Click Context Menu

**What:** Add "Enable/Disable Canvas AI" to the canvas right-click context menu using the undocumented but widely-used `canvas:node-menu` workspace event family.

**When to use:** For per-canvas enable/disable control per D-09/D-10.

```typescript
// Source: Obsidian Forum discussion on canvas context menus
// The canvas background right-click triggers a popup menu.
// We need to monkey-patch Canvas.prototype.onContextMenu or
// use the selection context menu event.

// For background (empty area) right-click:
// Patch canvas.showCreationMenu or canvas.onContextMenu
const uninstallContextMenu = around(canvasProto, {
  onContextMenu(oldMethod) {
    return function (this: any, evt: MouseEvent) {
      const result = oldMethod.apply(this, [evt]);
      // The menu is shown by Obsidian; we inject our item
      // Alternative: workspace.trigger approach below
      return result;
    };
  },
});

// For node right-click (simpler, uses documented-ish workspace events):
plugin.registerEvent(
  plugin.app.workspace.on('canvas:node-menu' as any, (menu: Menu, node: any) => {
    const canvas = node.canvas;
    const filePath = canvas?.view?.file?.path;
    if (!filePath) return;

    const isEnabled = plugin.isCanvasEnabled(filePath);
    menu.addSeparator();
    menu.addItem((item) =>
      item
        .setTitle(isEnabled ? 'Disable Canvas AI' : 'Enable Canvas AI')
        .setSection('canvas-ai')
        .onClick(() => {
          plugin.toggleCanvas(filePath);
        })
    );
  })
);
```

### Pattern 6: Status Bar with Click Popover

**What:** Text status bar indicator with click handler that shows a lightweight popover.

```typescript
// Source: Obsidian API addStatusBarItem + registerDomEvent
const statusBarEl = this.addStatusBarItem();
statusBarEl.setText('AI: idle');
statusBarEl.addClass('canvas-ai-status');

this.registerDomEvent(statusBarEl, 'click', (evt) => {
  const menu = new Menu();
  menu.addItem((item) =>
    item
      .setTitle(`State: ${this.currentState}`)
      .setDisabled(true)  // Display only
  );
  menu.addItem((item) =>
    item
      .setTitle(`Last trigger: ${this.lastTriggerTime ?? 'never'}`)
      .setDisabled(true)
  );
  menu.showAtMouseEvent(evt);
});
```

### Anti-Patterns to Avoid

- **Patching every canvas instance separately:** Patch the prototype ONCE, not each canvas view. The `around()` function on the prototype applies to all instances.
- **Using vault.modify() when canvas is actively saving:** The canvas has a 2-second `requestSave` debounce. Writing via `vault.modify()` during this window causes data loss. Always use internal API for live canvas manipulation.
- **Bundling obsidian/electron:** These are external -- provided by Obsidian at runtime. Bundling them causes cryptic errors.
- **Using `this.app.workspace.getLeavesOfType('canvas')` in a loop:** This is O(n) on leaves. Cache the active canvas reference and listen for `active-leaf-change` instead.
- **Persisting state in canvas file JSON:** Canvas files are owned by Obsidian's canvas plugin. Adding custom keys risks data corruption or being stripped on save. Use plugin `data.json` instead.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Monkey-patching with cleanup | Custom prototype override | `monkey-around` `around()` | Handles uninstall ordering, deduplication, chaining. Manual prototype patching breaks when multiple plugins patch the same method. |
| Debounce timer | Custom setTimeout wrapper | Obsidian's `debounce()` | Already handles timer reset, returns typed Debouncer, integrates with Obsidian's event system |
| Canvas type definitions | `@ts-ignore` everywhere | `obsidian-typings` | 300+ typed methods/properties for Canvas internals. Manual typing is error-prone and massive effort. |
| Settings persistence | Custom file I/O | `Plugin.loadData()` / `saveData()` | Handles serialization, file locking, Obsidian Sync compatibility |
| Status bar items | Custom DOM injection | `Plugin.addStatusBarItem()` | Auto-cleanup on unload, proper positioning, theme compatibility |
| Context menus | Custom right-click handler | `Menu` class + workspace events | Proper styling, keyboard navigation, section grouping, mobile support |

**Key insight:** Obsidian's Plugin API handles lifecycle cleanup automatically. Every `registerEvent`, `registerDomEvent`, `addStatusBarItem`, and `monkey-around` uninstaller registered via `plugin.register()` is automatically cleaned up in `onunload()`. Fighting this pattern leads to memory leaks and ghost UI.

## Common Pitfalls

### Pitfall 1: Canvas Prototype Not Available at Plugin Load
**What goes wrong:** Plugin tries to patch Canvas.prototype in `onload()` but no canvas is open yet, so the prototype is inaccessible.
**Why it happens:** Canvas views are created lazily when the user opens a `.canvas` file. The Canvas constructor prototype doesn't exist in memory until at least one canvas view is instantiated.
**How to avoid:** Wait for `active-leaf-change` event, check if the leaf is a canvas view, then patch the prototype from the live instance. Use a `patched` flag to ensure patches are applied only once.
**Warning signs:** `Cannot read properties of undefined` errors during startup.

### Pitfall 2: requestSave Race Condition
**What goes wrong:** Plugin writes canvas data via `vault.modify()` while the canvas view's own `requestSave` debounce is pending (2-second window). The canvas overwrites the plugin's changes.
**Why it happens:** Canvas uses an internal debounced save. If `vault.modify()` writes first, the canvas's debounced save fires 2 seconds later with stale data, overwriting the plugin's changes.
**How to avoid:** Use internal Canvas API (`canvas.addNode()`, `canvas.createTextNode()`) for all live manipulation. Reserve `vault.modify()` for batch operations when no canvas view is active.
**Warning signs:** Nodes appear briefly then disappear, or data reverts after a few seconds.

### Pitfall 3: Monkey-Patch Leaks on Plugin Disable/Enable Cycle
**What goes wrong:** Plugin is disabled and re-enabled, causing double-patched methods that fire handlers twice.
**Why it happens:** `around()` uninstallers weren't registered with `plugin.register()` for automatic cleanup.
**How to avoid:** Always call `plugin.register(uninstaller)` for every `around()` return value. This ensures `onunload()` removes all patches. Also use the `patched` flag pattern and reset it in `onunload()`.
**Warning signs:** Events fire twice after plugin toggle, exponentially increasing with each toggle cycle.

### Pitfall 4: Node Edit Detection is Indirect
**What goes wrong:** Plugin patches `addNode` and `removeNode` but misses text edits because there's no direct "node text changed" method on the Canvas prototype.
**Why it happens:** Node text editing happens through an embedded CodeMirror editor. The Canvas object learns about changes when `requestSave` is called (which marks the canvas dirty) or when `markDirty` is called on specific items.
**How to avoid:** Patch `requestSave` on Canvas.prototype as the catch-all edit detector. This fires whenever any canvas content changes (node text, edge labels, node position, etc.). Filter by checking what's in the `dirty` Set to distinguish edit types.
**Warning signs:** Node creation and deletion events work but text edits are never detected.

### Pitfall 5: obsidian-typings Version Mismatch
**What goes wrong:** Types don't match actual runtime methods, leading to runtime errors despite TypeScript compilation succeeding.
**Why it happens:** obsidian-typings tracks specific Obsidian versions. Using types for the wrong version gives misleading type information.
**How to avoid:** Match obsidian-typings version to your target Obsidian version using their dist-tag system. For Obsidian 1.12.x, use `obsidian-typings@obsidian-public-1.12.4` (resolves to 5.17.0).
**Warning signs:** Method exists in types but throws "is not a function" at runtime, or vice versa.

### Pitfall 6: API Key Validation Timing
**What goes wrong:** Plugin validates API keys by making a real API call during settings save, but the SDK isn't imported or initialized in Phase 1.
**Why it happens:** Phase 1 stores keys but doesn't set up the Anthropic/Runware SDKs.
**How to avoid:** In Phase 1, validate API key FORMAT only (non-empty, correct prefix pattern like `sk-ant-` for Anthropic). Defer real API validation to Phase 3 when SDK integration is built. Show format validation inline. Mark as "will verify on first use."
**Warning signs:** Importing `@anthropic-ai/sdk` in Phase 1 pulls in unnecessary bundle weight and complexity.

### Pitfall 7: Per-Canvas State Lost on Obsidian Restart
**What goes wrong:** Per-canvas enabled/disabled preferences disappear after closing and reopening Obsidian.
**Why it happens:** State was stored in memory (a Map) but never persisted to disk.
**How to avoid:** Store per-canvas state in plugin `data.json` via `saveData()`. Key by canvas file path. Load on startup via `loadData()`.
**Warning signs:** User disables AI on a canvas, restarts Obsidian, and AI is active again.

## Code Examples

### Plugin Entry Point (main.ts skeleton)

```typescript
// Source: Obsidian sample plugin template + project requirements
import { Plugin, Notice } from 'obsidian';
import type {} from 'obsidian-typings';

interface CanvasAISettings {
  claudeApiKey: string;
  runwareApiKey: string;
  debounceDelay: number;  // seconds
  debugMode: boolean;
  disabledCanvases: string[];  // file paths of disabled canvases
}

const DEFAULT_SETTINGS: CanvasAISettings = {
  claudeApiKey: '',
  runwareApiKey: '',
  debounceDelay: 3,
  debugMode: false,
  disabledCanvases: [],
};

export default class CanvasAIPlugin extends Plugin {
  settings: CanvasAISettings;
  private statusBarEl: HTMLElement | null = null;
  private currentState: 'idle' | 'thinking' | 'error' | 'off' = 'idle';

  async onload(): Promise<void> {
    await this.loadSettings();

    // Settings tab
    this.addSettingTab(new CanvasAISettingTab(this.app, this));

    // Status bar (only shown when a canvas is active and enabled)
    this.statusBarEl = this.addStatusBarItem();
    this.updateStatusBar();

    // Commands
    this.addCommand({
      id: 'toggle-canvas-ai',
      name: 'Toggle Canvas AI for current canvas',
      checkCallback: (checking) => {
        const canvas = this.getActiveCanvas();
        if (!canvas) return false;
        if (!checking) this.toggleCurrentCanvas();
        return true;
      },
    });

    // Canvas event patching
    this.initCanvasPatching();

    // Watch for active leaf changes to show/hide status bar
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', () => {
        this.updateStatusBar();
      })
    );
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private updateStatusBar(): void {
    if (!this.statusBarEl) return;
    const canvas = this.getActiveCanvas();
    if (!canvas) {
      this.statusBarEl.style.display = 'none';
      return;
    }
    const filePath = this.getCanvasFilePath(canvas);
    if (filePath && this.settings.disabledCanvases.includes(filePath)) {
      // D-04: Hide status bar when canvas is disabled
      this.statusBarEl.style.display = 'none';
      return;
    }
    this.statusBarEl.style.display = '';
    if (!this.settings.claudeApiKey) {
      this.statusBarEl.setText('AI: no API key');
    } else {
      this.statusBarEl.setText(`AI: ${this.currentState}`);
    }
  }
}
```

### manifest.json

```json
{
  "id": "canvas-ai",
  "name": "Canvas AI",
  "version": "0.1.0",
  "minAppVersion": "1.12.0",
  "description": "AI-powered spatial thinking partner for Obsidian Canvas",
  "author": "Canvas AI Team",
  "isDesktopOnly": true
}
```

### esbuild.config.mjs

```javascript
// Source: Official Obsidian sample plugin esbuild config
import esbuild from 'esbuild';
import process from 'process';
import builtins from 'builtin-modules';

const banner = `/* THIS IS A GENERATED FILE. DO NOT EDIT. */`;
const prod = process.argv[2] === 'production';

const context = await esbuild.context({
  banner: { js: banner },
  entryPoints: ['src/main.ts'],
  bundle: true,
  external: [
    'obsidian',
    'electron',
    '@codemirror/autocomplete', '@codemirror/collab', '@codemirror/commands',
    '@codemirror/language', '@codemirror/lint', '@codemirror/search',
    '@codemirror/state', '@codemirror/view',
    '@lezer/common', '@lezer/highlight', '@lezer/lr',
    ...builtins,
  ],
  format: 'cjs',
  target: 'es2018',
  logLevel: 'info',
  sourcemap: prod ? false : 'inline',
  treeShaking: true,
  outfile: 'main.js',
  minify: prod,
});

if (prod) {
  await context.rebuild();
  process.exit(0);
} else {
  await context.watch();
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| obsidian-typings v4.x (separate `Canvas` interface) | obsidian-typings v5.x (`CanvasViewCanvas`, `CanvasViewCanvasNode`) | v5.0.0 (2025) | Interface names changed; v4 still works but may have inaccurate types for Obsidian 1.12+ |
| git submodule canvas-event-patcher | monkey-around directly | Ongoing | Simpler dependency management, same underlying technique |
| `uuid` v9.x for node IDs | `uuid` v13.x available (not needed in Phase 1) | 2024-2025 | Major API changes in v10+; if using in future phases, evaluate migration |
| `zod` v3.x | `zod` v4.x available (not needed in Phase 1) | 2025-2026 | Major version bump; evaluate when adding validation in Phase 3 |

**Deprecated/outdated:**
- `obsidian-canvas-event-patcher`: Still functional but uses git submodule pattern. Use `monkey-around` directly instead (CLAUDE.md directive).
- Obsidian `requestUrl()` for streaming: Does not support streaming responses. Use Node.js `fetch` directly in Electron for SSE (Phase 3 concern, not Phase 1).

## Open Questions

1. **Canvas background right-click menu integration**
   - What we know: `canvas:node-menu` workspace event works for node right-click. There's no documented `canvas:background-menu` event.
   - What's unclear: How to add items to the canvas background (empty area) right-click menu without patching `onContextMenu`.
   - Recommendation: Start with `canvas:node-menu` for the per-canvas toggle (D-10). If background menu is needed, monkey-patch `Canvas.prototype.onContextMenu`. The `canvas:selection-menu` event may also be useful. Test at implementation time.

2. **requestSave as universal edit detector**
   - What we know: `requestSave` fires when canvas data needs persisting. It's the most reliable "something changed" signal.
   - What's unclear: Whether `requestSave` fires too frequently (e.g., on viewport changes, not just content changes). The `dirty` Set may help distinguish.
   - Recommendation: Use `requestSave` as the primary edit detector. In the handler, check `canvas.dirty.size > 0` to confirm actual content changes. If too noisy, filter by comparing previous canvas data snapshot.

3. **obsidian-typings v5 migration from CLAUDE.md v4 spec**
   - What we know: CLAUDE.md specifies ^4.88.0 but current Obsidian 1.12.x is best served by v5.17.0.
   - What's unclear: Whether the user considers CLAUDE.md version specs as hard locks or recommendations.
   - Recommendation: Use v5.17.0 for best type accuracy. If v4 is required, use 4.111.0. Flag for user decision.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build tooling, esbuild | Yes | v24.14.1 (exceeds ^20 LTS requirement) | -- |
| npm | Package management | Yes | 11.11.0 | -- |
| git | Version control | Yes | 2.50.1 | -- |
| esbuild | Build (will install via npm) | Available via npm | 0.24.2 (in ^0.24 range) | -- |
| Obsidian desktop app | Runtime environment | Not verified (user's machine) | Target ^1.12.0 | -- |

**Missing dependencies with no fallback:** None

**Missing dependencies with fallback:** None. Obsidian desktop app availability assumed since this is a plugin project.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected -- greenfield project |
| Config file | None -- see Wave 0 |
| Quick run command | `npx jest --passWithNoTests` (after setup) |
| Full suite command | `npx jest` (after setup) |

**Note:** Obsidian plugins are notoriously difficult to unit test because the Obsidian API is not available outside the Electron runtime. The standard community approach is:

1. **Unit tests:** Test pure logic (debounce controller, settings serialization, canvas data parsing) with Jest/Vitest by mocking the Obsidian API.
2. **Integration tests:** Manual testing inside Obsidian. No automated framework exists for Obsidian plugin integration testing.
3. **Type checking:** `tsc --noEmit` catches type errors without running code.

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FOUN-01 | Plugin loads, registers hooks | manual | Manual: load plugin in Obsidian, check console | N/A |
| FOUN-02 | Canvas Adapter wraps internal APIs | unit | `npx jest tests/canvas-adapter.test.ts -x` | Wave 0 |
| FOUN-03 | File-based JSON fallback | unit | `npx jest tests/canvas-adapter.test.ts -x` | Wave 0 |
| FOUN-04 | Detect node create | manual + unit | Unit: mock around() callback fires; Manual: console.log in debug mode | Wave 0 |
| FOUN-05 | Detect node edit | manual + unit | Unit: mock requestSave callback fires; Manual: console.log in debug mode | Wave 0 |
| FOUN-06 | Detect node move | manual + unit | Unit: mock markMoved callback fires; Manual: console.log in debug mode | Wave 0 |
| FOUN-07 | Detect node delete | manual + unit | Unit: mock removeNode callback fires; Manual: console.log in debug mode | Wave 0 |
| FOUN-08 | Debounce timer | unit | `npx jest tests/generation-controller.test.ts -x` | Wave 0 |
| FOUN-09 | AbortController cancellation | unit | `npx jest tests/generation-controller.test.ts -x` | Wave 0 |
| FOUN-10 | Settings UI | manual | Manual: open settings tab, verify fields | N/A |
| FOUN-11 | Enable/disable toggle | manual | Manual: command palette + status bar | N/A |
| FOUN-12 | Status bar states | manual + unit | Unit: test state machine; Manual: visual verification | Wave 0 |
| FOUN-13 | requestSave race condition | unit | `npx jest tests/canvas-adapter.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx jest --passWithNoTests && npx tsc --noEmit`
- **Per wave merge:** `npx jest && npx tsc --noEmit`
- **Phase gate:** Full suite green + manual verification in Obsidian

### Wave 0 Gaps
- [ ] `jest.config.ts` -- Jest configuration with TypeScript support
- [ ] `tests/canvas-adapter.test.ts` -- Canvas Adapter unit tests (FOUN-02, FOUN-03, FOUN-13)
- [ ] `tests/generation-controller.test.ts` -- Debounce + AbortController tests (FOUN-08, FOUN-09)
- [ ] `tests/status-bar.test.ts` -- Status bar state machine tests (FOUN-12)
- [ ] `tests/mocks/obsidian.ts` -- Mock Obsidian API for unit testing
- [ ] Framework install: `npm install --save-dev jest ts-jest @types/jest`

## Discretion Recommendations

These are areas where CONTEXT.md grants Claude's discretion. Research findings inform these recommendations:

### Per-Canvas State Persistence
**Recommendation:** Use plugin `data.json` via `loadData()`/`saveData()`. Store an array of disabled canvas file paths in `settings.disabledCanvases: string[]`.

**Why:** This is the standard Obsidian pattern. It syncs via Obsidian Sync, survives restarts, and requires zero additional infrastructure. Alternatives like frontmatter injection modify the canvas file (risky) or separate config files (non-standard). The `data.json` approach is what every settings-bearing Obsidian plugin uses.

### Status Popover Implementation
**Recommendation:** Use Obsidian's `Menu` class (the same class used for context menus).

**Why:** Menu is a built-in Obsidian component that handles positioning, theming, keyboard navigation, and click-outside-to-close. It can display disabled (read-only) items. Custom DOM popovers require manual positioning, z-index management, click-outside handling, and theme compatibility -- all of which Menu handles for free. The popover content is simple (state + last trigger time), which fits Menu's item model perfectly.

### Canvas Right-Click Menu Integration
**Recommendation:** Use `workspace.on('canvas:node-menu')` event (not monkey-patching).

**Why:** The `canvas:node-menu` workspace event is used by multiple shipping plugins (Canvas Style Menu, Enhanced Canvas) and is the closest thing to an "official" pattern for extending canvas context menus. It provides the Menu instance directly, allowing `menu.addItem()` without manual DOM manipulation. For the canvas background (empty area) right-click, monkey-patch `Canvas.prototype.onContextMenu` only if needed -- start with node menu first since users will be right-clicking nodes most often.

### Slider Widget Implementation
**Recommendation:** Use `Setting.addSlider()` with `slider.setLimits(1, 10, 1).setDynamicTooltip()`.

**Why:** `SliderComponent` is a first-class Obsidian API component. `setLimits(min, max, step)` configures the range. `setDynamicTooltip()` shows the current value as a floating tooltip while dragging. Step of 1 gives integer seconds. This matches D-08 exactly with zero custom UI work.

## Sources

### Primary (HIGH confidence)
- [Obsidian API type definitions (obsidian.d.ts)](https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts) -- Setting class, Plugin class, Menu class, debounce, SliderComponent, Command interface
- [Obsidian Canvas type definitions (canvas.d.ts)](https://github.com/obsidianmd/obsidian-api/blob/master/canvas.d.ts) -- CanvasData, CanvasNodeData, CanvasTextData, CanvasEdgeData data format
- [obsidian-typings v5.17.0 (npm package)](https://github.com/Fevol/obsidian-typings) -- CanvasViewCanvas (50+ methods), CanvasViewCanvasNode (20+ methods), CanvasView interface; verified via npm pack inspection
- [monkey-around v3.0.0 (README)](https://github.com/pjeby/monkey-around) -- around() signature, uninstaller pattern, dedupe() API, serialize()
- [Obsidian sample plugin template](https://github.com/obsidianmd/obsidian-sample-plugin) -- esbuild.config.mjs, tsconfig.json, package.json, project structure
- npm registry version checks (2026-04-02) -- all package versions verified against live registry

### Secondary (MEDIUM confidence)
- [obsidian-canvas-event-patcher](https://github.com/neonpalms/obsidian-canvas-event-patcher) -- Canvas prototype methods to patch: addNode, removeNode, markMoved, requestSave, createTextNode, createFileNode, createLinkNode, createGroupNode
- [Advanced Canvas plugin](https://github.com/Developer-Mike/obsidian-advanced-canvas) -- Canvas access patterns: getCanvases(), getCurrentCanvasView(), patcher architecture
- [Obsidian Forum: canvas context menus](https://forum.obsidian.md/t/creating-an-event-for-menus-on-canvas-items/85646) -- canvas:node-menu, canvas:edge-menu workspace events
- [Obsidian Forum: canvas API details](https://forum.obsidian.md/t/any-details-on-the-canvas-api/57120) -- Canvas prototype access via workspace.getLeavesOfType('canvas')
- [Obsidian Forum: vault.modify + requestSave conflict](https://forum.obsidian.md/t/vault-process-and-vault-modify-dont-work-when-there-is-a-requestsave-debounce-event/107862) -- 2-second debounce window, file write conflict

### Tertiary (LOW confidence)
- Canvas background right-click menu integration approach -- not verified which workspace event covers empty-area right-click; may require monkey-patching onContextMenu

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all packages verified against npm registry, versions confirmed, CLAUDE.md provides definitive stack choices
- Architecture: HIGH -- patterns derived from multiple shipping plugins (Advanced Canvas, Canvas Style Menu, Canvas Event Patcher) using identical techniques
- Pitfalls: HIGH -- documented from forum posts, plugin source code, and known Obsidian internals behavior (requestSave debounce, prototype access timing)
- Canvas event detection: MEDIUM -- specific method to detect text edits (requestSave vs markDirty) needs runtime verification
- Canvas background context menu: LOW -- only node-menu event is community-verified; background menu approach is speculative

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (30 days -- stable domain, Obsidian updates quarterly)
