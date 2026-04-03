import { Plugin, Notice, Menu, WorkspaceLeaf } from 'obsidian';
import type {} from 'obsidian-typings';
import Anthropic from '@anthropic-ai/sdk';
import { CanvasAISettings, DEFAULT_SETTINGS, TokenUsageData, DEFAULT_TOKEN_USAGE } from './types/settings';
import { CanvasAISettingTab } from './settings';
import { StatusBarManager } from './ui/status-bar';
import type { StatusBarState } from './ui/status-bar';
import { initCanvasPatching } from './canvas/canvas-patcher';
import { GenerationController } from './canvas/generation-controller';
import { CanvasAdapter } from './canvas/canvas-adapter';
import { CANVAS_EVENT_TYPES } from './canvas/canvas-events';
import type { CanvasEvent } from './canvas/canvas-events';
import { createClaudeClient, classifyApiError, getRetryDelay, getMaxRetries } from './ai/claude-client';
import type { ApiErrorType } from './ai/claude-client';
import { buildSystemPrompt, buildUserMessage } from './ai/prompt-builder';
import type { SystemPromptBlock } from './ai/prompt-builder';
import { streamIntoNode } from './ai/stream-handler';
import type { StreamResult } from './ai/stream-handler';
import { isBudgetExceeded, trackTokens, getOrResetUsage } from './ai/token-budget';
import { readTasteProfile, seedTasteProfile, formatTasteForPrompt, DEFAULT_TASTE_PROFILE } from './taste/taste-profile';
import { buildSpatialContext } from './spatial';
import type { PlacementCoordinate } from './spatial';

export default class CanvasAIPlugin extends Plugin {
  settings!: CanvasAISettings;
  private statusBarEl: HTMLElement | null = null;
  private statusBar!: StatusBarManager;
  private apiKeyNoticeShown = false;
  private generationController: GenerationController | null = null;
  private claudeClient: Anthropic | null = null;
  private adapter!: CanvasAdapter;
  tokenUsage: TokenUsageData = { ...DEFAULT_TOKEN_USAGE };
  /** When true, canvas events from AI operations are suppressed to prevent feedback loops */
  _suppressCanvasEvents = false;

  async onload(): Promise<void> {
    await this.loadSettings();

    // Initialize CanvasAdapter for canvas read/write operations
    this.adapter = new CanvasAdapter(this.app);

    // Initialize Claude client if API key exists
    if (this.settings.claudeApiKey) {
      this.claudeClient = createClaudeClient(this.settings.claudeApiKey);
    }

    // Seed taste profile on first run (TAST-01)
    seedTasteProfile(this.app.vault.adapter, this.settings.tasteProfilePath).catch(console.error);

    // Settings tab (FOUN-10)
    this.addSettingTab(new CanvasAISettingTab(this.app, this));

    // Status bar -- hidden by default, shown when enabled canvas is active
    this.statusBarEl = this.addStatusBarItem();
    this.statusBar = new StatusBarManager(this.statusBarEl);

    // Status bar click -> popover (D-02)
    this.registerDomEvent(this.statusBarEl, 'click', (evt: MouseEvent) => {
      this.statusBar.showPopover(evt);
    });

    // Command palette toggle (FOUN-11)
    this.addCommand({
      id: 'toggle-canvas-ai',
      name: 'Toggle Canvas AI for current canvas',
      checkCallback: (checking: boolean) => {
        const canvasPath = this.getActiveCanvasPath();
        if (!canvasPath) return false;
        if (!checking) {
          this.toggleCanvas(canvasPath);
        }
        return true;
      },
    });

    // Watch for active leaf changes to show/hide status bar
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', (leaf: WorkspaceLeaf | null) => {
        this.onActiveLeafChange(leaf);
      })
    );

    // Canvas context menu -- per-canvas enable/disable toggle (D-10)
    this.registerEvent(
      this.app.workspace.on('canvas:node-menu' as any, (menu: Menu, node: any) => {
        const canvasPath = node?.canvas?.view?.file?.path;
        if (!canvasPath) return;
        const isEnabled = this.isCanvasEnabled(canvasPath);
        menu.addSeparator();
        menu.addItem((item: any) =>
          item
            .setTitle(isEnabled ? 'Disable Canvas AI' : 'Enable Canvas AI')
            .setSection('canvas-ai')
            .onClick(async () => {
              await this.toggleCanvas(canvasPath);
            })
        );
      })
    );

    // First-run notice if no API key (D-15)
    if (!this.settings.claudeApiKey) {
      this.showApiKeyNotice();
    }

    // Canvas event patching (FOUN-04, FOUN-05, FOUN-06, FOUN-07)
    initCanvasPatching(this);

    // Debounce controller (FOUN-08, FOUN-09) -- wired to real generation pipeline
    this.generationController = new GenerationController(
      this.settings.debounceDelay,
      async (signal: AbortSignal, triggerNodeId?: string) => {
        await this.handleGeneration(signal, triggerNodeId);
      }
    );

    // Listen for canvas events and route to debounce controller
    const canvasEventHandler = (event: CanvasEvent) => {
      // Only process events from enabled canvases
      if (!this.isCanvasEnabled(event.canvasPath)) return;
      // Only process if API key is configured
      if (!this.settings.claudeApiKey) return;
      if (this._suppressCanvasEvents) return;
      this.generationController?.handleCanvasEvent(event.nodeId);
    };

    // Custom canvas events use non-standard event names; cast to bypass Obsidian's typed overloads
    const ws = this.app.workspace as any;
    this.registerEvent(ws.on(CANVAS_EVENT_TYPES.NODE_CREATED, canvasEventHandler));
    this.registerEvent(ws.on(CANVAS_EVENT_TYPES.NODE_REMOVED, canvasEventHandler));
    this.registerEvent(ws.on(CANVAS_EVENT_TYPES.NODE_MOVED, canvasEventHandler));
    this.registerEvent(ws.on(CANVAS_EVENT_TYPES.CANVAS_CHANGED, canvasEventHandler));
  }

  onunload(): void {
    this.generationController?.destroy();
  }

  /**
   * Update the debounce delay on the generation controller.
   * Called from settings tab when the slider value changes.
   */
  updateDebounceDelay(delaySeconds: number): void {
    this.generationController?.updateDelay(delaySeconds);
  }

  // ─── Event suppression for AI operations ──────────────────────────

  /** Execute a canvas-mutating operation with event suppression to prevent feedback loops */
  private suppressEvents<T>(fn: () => T): T {
    this._suppressCanvasEvents = true;
    try { return fn(); }
    finally { this._suppressCanvasEvents = false; }
  }

  // ─── Generation Pipeline (GENP-01 through GENP-12) ───────────────

  /**
   * Main generation handler wired into GenerationController's onTrigger.
   * Orchestrates: budget check -> spatial context -> taste profile ->
   * Claude streaming -> node creation -> token tracking.
   */
  private async handleGeneration(signal: AbortSignal, triggerNodeId?: string): Promise<void> {
    try {
      // 1. Budget check (D-11, D-12, GENP-09, GENP-10)
      if (isBudgetExceeded(this.tokenUsage, this.settings.dailyTokenBudget)) {
        this.setState('budget');
        new Notice(
          'Daily token budget reached\n\nCanvas AI has paused generation. Override in Settings > Canvas AI > Token Budget.',
          0
        );
        return;
      }

      // 2. Ensure Claude client exists
      if (!this.claudeClient) {
        if (!this.settings.claudeApiKey) return;
        this.claudeClient = createClaudeClient(this.settings.claudeApiKey);
      }

      // 3. Get canvas state
      const canvas = this.adapter.getActiveCanvas();
      if (!canvas) return;

      const nodes = this.adapter.getNodesFromCanvas(canvas);
      if (nodes.length === 0) return; // Empty canvas, nothing to generate from

      const edges = this.adapter.getEdgesFromCanvas(canvas);

      // 4. Determine trigger node (use provided ID or fallback to first node)
      const effectiveTriggerNodeId = triggerNodeId ?? nodes[0]?.id;
      if (!effectiveTriggerNodeId) return;

      // 5. Build spatial context (Phase 2)
      const spatialCtx = buildSpatialContext(nodes, edges, effectiveTriggerNodeId);

      // 6. Read taste profile (TAST-01, TAST-03)
      const tasteProfile = await readTasteProfile(
        this.app.vault.adapter,
        this.settings.tasteProfilePath
      );
      const tasteContent = formatTasteForPrompt(tasteProfile);

      // 7. Build system prompt (GENP-06, GENP-08)
      const systemPrompt = buildSystemPrompt(tasteContent, spatialCtx.narrative);
      const userMessage = buildUserMessage();

      // 8. Set thinking state
      this.setLastTriggerTime(new Date());
      this.setState('thinking');

      if (signal.aborted) return;

      // 9. Stream response with sequential multi-node support (D-01, D-02, D-03)
      const result = await this.streamWithRetry(
        canvas, systemPrompt, userMessage, signal, spatialCtx.placementSuggestions
      );

      if (!result || signal.aborted) return;

      // 10. Track token usage (GENP-09, D-13)
      this.tokenUsage = trackTokens(this.tokenUsage, result.usage);
      await this.persistTokenUsage();

      // 11. Done
      this.setState('idle');

    } catch (err) {
      if (signal.aborted) return; // Cancelled, not an error
      console.error('[Canvas AI] Generation failed:', err);
      this.setState('error');
      // Error notice handled in streamWithRetry
    }
  }

  /**
   * Stream a Claude response with retry logic and sequential multi-node support.
   *
   * Key design for D-03 compliance: uses the onNodeBoundary callback from the
   * stream handler. When </node> is detected mid-stream, the callback fires and
   * we finalize the current node (remove pulsing, save) and create the next node
   * (with pulsing). Subsequent onTextUpdate calls from the stream handler contain
   * the new node's content, which we redirect to the newly created canvas node.
   */
  private async streamWithRetry(
    canvas: any,
    systemPrompt: SystemPromptBlock[],
    userMessage: string,
    signal: AbortSignal,
    placements: PlacementCoordinate[]
  ): Promise<StreamResult | null> {
    let attempt = 0;

    while (attempt <= 3) {
      try {
        // Pre-allocate the first node (D-01, GENP-05, MMED-09)
        const firstPlacement = placements[0] ?? { x: 0, y: 0, width: 300, height: 200 };
        let currentNode = this.suppressEvents(() =>
          this.adapter.createTextNodeOnCanvas(canvas, firstPlacement, this.settings.aiNodeColor)
        );

        if (!currentNode) {
          new Notice('Canvas AI: Failed to create canvas node.');
          return null;
        }

        // Add pulsing animation (D-04)
        this.adapter.addNodeCssClass(currentNode, 'canvas-ai-node--streaming');

        // Track the active node for onTextUpdate redirection (D-03).
        // This mutable reference is captured by the callbacks below.
        // When onNodeBoundary fires, we update it so subsequent
        // onTextUpdate calls write to the NEW node.
        let activeNode = currentNode;

        // Stream with sequential multi-node support via onNodeBoundary (D-03)
        const result = await streamIntoNode(
          this.claudeClient!,
          systemPrompt,
          userMessage,
          signal,
          {
            onFirstToken: () => {
              // First token arrived -- stop pulsing on first node, set streaming state
              this.adapter.removeNodeCssClass(activeNode, 'canvas-ai-node--streaming');
              this.setState('streaming');
            },

            onTextUpdate: (text: string) => {
              // text = current node's visible content only (tags stripped by stream handler)
              // activeNode is updated by onNodeBoundary, so this always writes to the correct node
              this.suppressEvents(() => this.adapter.updateNodeText(activeNode, text));
            },

            onNodeBoundary: (completedNodeContent: string, nodeIndex: number) => {
              // A </node> boundary was detected mid-stream (D-03).
              // 1. Finalize the current node with its complete content
              this.suppressEvents(() => {
                this.adapter.updateNodeText(activeNode, completedNodeContent);
                this.adapter.removeNodeCssClass(activeNode, 'canvas-ai-node--streaming');
                this.adapter.requestCanvasSave(canvas);
              });

              // 2. Create the next node if we haven't hit the 3-node cap (D-02)
              const nextIndex = nodeIndex + 1;
              if (nextIndex < 3 && !signal.aborted) {
                const nextPlacement = placements[nextIndex] ?? {
                  x: firstPlacement.x + (nextIndex * 340),
                  y: firstPlacement.y,
                  width: 300,
                  height: 200,
                };
                const nextNode = this.suppressEvents(() =>
                  this.adapter.createTextNodeOnCanvas(canvas, nextPlacement, this.settings.aiNodeColor)
                );
                if (nextNode) {
                  // Add pulsing to the new node
                  this.adapter.addNodeCssClass(nextNode, 'canvas-ai-node--streaming');
                  // Redirect subsequent onTextUpdate calls to the new node
                  activeNode = nextNode;
                }
              }
            },

            onTimeout: () => {
              new Notice('Canvas AI: Generation timed out after 30 seconds. Retrying...');
            },
          }
        );

        // Finalize the last active node
        this.adapter.removeNodeCssClass(activeNode, 'canvas-ai-node--streaming');

        // Ensure the last node has its correct final content from parseNodeContent.
        // The final </node> may or may not have been processed by onNodeBoundary
        // depending on trailing content.
        const finalContents = result.nodeContents;
        if (finalContents.length > 0) {
          const lastContent = finalContents[finalContents.length - 1];
          this.suppressEvents(() => this.adapter.updateNodeText(activeNode, lastContent));
        }

        this.suppressEvents(() => this.adapter.requestCanvasSave(canvas));

        return result;

      } catch (err) {
        if (signal.aborted) return null;
        const errorType = classifyApiError(err);
        const maxRetries = getMaxRetries(errorType);

        if (attempt >= maxRetries) {
          // Max retries exhausted -- show error and give up
          this.handleApiError(errorType, err);
          this.setState('error');
          // Auto-recover to idle after 5 seconds
          setTimeout(() => {
            if (!signal.aborted) this.setState('idle');
          }, 5000);
          return null;
        }

        const delay = getRetryDelay(errorType, attempt, this.extractRetryAfter(err));
        if (delay === 0) {
          // No retry (auth errors)
          this.handleApiError(errorType, err);
          this.setState('error');
          return null;
        }

        this.setState('error');
        await new Promise((resolve) => setTimeout(resolve, delay));
        attempt++;
      }
    }

    return null;
  }

  // ─── Error Handling ───────────────────────────────────────────────

  /**
   * Show appropriate notice for API errors by type (GENP-12).
   */
  private handleApiError(errorType: ApiErrorType, err: unknown): void {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    switch (errorType) {
      case 'auth':
        new Notice('Canvas AI: Invalid API key. Check Settings > Canvas AI.');
        break;
      case 'rate_limit':
        new Notice('Canvas AI: Rate limited. Will retry automatically.');
        break;
      case 'server':
      case 'network':
        new Notice(`Canvas AI: Generation failed. ${errorMessage}. Will retry automatically.`);
        break;
      default:
        new Notice(`Canvas AI: Generation failed. ${errorMessage}.`);
    }
  }

  /**
   * Extract Retry-After header from API error response.
   */
  private extractRetryAfter(err: unknown): string | undefined {
    try {
      return (err as any)?.headers?.['retry-after'] ?? undefined;
    } catch {
      return undefined;
    }
  }

  // ─── Token Usage Persistence ──────────────────────────────────────

  /**
   * Persist token usage data alongside settings.
   */
  private async persistTokenUsage(): Promise<void> {
    const data = await this.loadData() ?? {};
    data.tokenUsage = this.tokenUsage;
    await this.saveData({ ...this.settings, ...data });
  }

  // ─── Plugin Methods for Settings Tab (Plan 03) ────────────────────

  /**
   * Set or clear the budget override flag.
   * Called from settings tab when the "Override budget" toggle changes.
   */
  async setBudgetOverride(override: boolean): Promise<void> {
    this.tokenUsage.budgetOverride = override;
    await this.persistTokenUsage();
    if (override) this.setState('idle'); // Clear budget state
  }

  /**
   * Open the taste profile in the editor (TAST-02).
   */
  async openTasteProfile(): Promise<void> {
    const path = this.settings.tasteProfilePath;
    // Seed if not exists
    await seedTasteProfile(this.app.vault.adapter, path);
    // Try to open the file in the editor
    try {
      const file = this.app.vault.getAbstractFileByPath(path);
      if (file) {
        await this.app.workspace.openLinkText(path, '', false);
      } else {
        new Notice(`Taste profile at ${path}. Edit this file directly.`);
      }
    } catch {
      new Notice(`Taste profile at ${path}. Edit this file directly.`);
    }
  }

  /**
   * Reset the taste profile to the default content (TAST-03).
   */
  async resetTasteProfile(): Promise<void> {
    const path = this.settings.tasteProfilePath;
    // Write default content
    await this.app.vault.adapter.write(path, DEFAULT_TASTE_PROFILE);
    // Show confirmation notice (per UI-SPEC destructive actions)
    new Notice('Taste profile reset to default.', 10000);
  }

  // ─── Settings persistence ─────────────────────────────────────────

  async loadSettings(): Promise<void> {
    const data = await this.loadData() ?? {};
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
    this.tokenUsage = getOrResetUsage(data.tokenUsage ?? DEFAULT_TOKEN_USAGE);
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  // ─── Status bar management (FOUN-12) ──────────────────────────────

  setState(state: StatusBarState): void {
    this.statusBar.setState(state);
    this.refreshStatusBar();
  }

  setLastTriggerTime(time: Date): void {
    this.statusBar.setLastTriggerTime(time);
  }

  private refreshStatusBar(): void {
    const canvasPath = this.getActiveCanvasPath();
    const isEnabled = canvasPath ? this.isCanvasEnabled(canvasPath) : false;
    const hasApiKey = !!this.settings.claudeApiKey;
    this.statusBar.update(canvasPath, isEnabled, hasApiKey);
  }

  // D-15: First-run API key notice
  private showApiKeyNotice(): void {
    if (this.apiKeyNoticeShown) return;
    this.apiKeyNoticeShown = true;
    new Notice('Canvas AI: Set up your API keys in Settings \u2192 Canvas AI');
  }

  // ─── Per-canvas enable/disable (D-09, D-10, D-11, D-12) ──────────

  isCanvasEnabled(canvasPath: string): boolean {
    // D-11: Newly opened canvases default to enabled
    return !this.settings.disabledCanvases.includes(canvasPath);
  }

  async toggleCanvas(canvasPath: string): Promise<void> {
    const idx = this.settings.disabledCanvases.indexOf(canvasPath);
    if (idx >= 0) {
      this.settings.disabledCanvases.splice(idx, 1);
    } else {
      this.settings.disabledCanvases.push(canvasPath);
    }
    await this.saveSettings();
    this.refreshStatusBar();
  }

  // ─── Canvas view helpers ──────────────────────────────────────────

  getActiveCanvasPath(): string | null {
    const leaf = this.app.workspace.activeLeaf;
    if (!leaf || leaf.view.getViewType() !== 'canvas') return null;
    return (leaf.view as any).file?.path ?? null;
  }

  private onActiveLeafChange(_leaf: WorkspaceLeaf | null): void {
    this.refreshStatusBar();
  }
}
