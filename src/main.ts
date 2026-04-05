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
import { buildSystemPrompt, buildUserMessage, buildIterationUserMessage } from './ai/prompt-builder';
import type { SystemPromptBlock } from './ai/prompt-builder';
import { streamIntoNode } from './ai/stream-handler';
import type { StreamResult } from './ai/stream-handler';
import { isBudgetExceeded, trackTokens, getOrResetUsage } from './ai/token-budget';
import { readTasteProfile, seedTasteProfile, formatTasteForPrompt, DEFAULT_TASTE_PROFILE } from './taste/taste-profile';
import { buildSpatialContext, computeIterationPlacement } from './spatial';
import type { PlacementCoordinate } from './spatial';
import { detectIterationContext } from './canvas/iteration-detector';
import type { IterationContext } from './canvas/iteration-detector';
import type { TypedNodeMeta } from './types/generation';
import { RunwareImageClient } from './image/runware-client';
import { ImageSaver } from './image/image-saver';
import {
  detectCompanionContentType,
  createHtmlCompanionContent,
  buildMermaidCompanionContent,
  buildSvgCompanionContent,
  computeCompanionPlacement,
  injectHtmlPreview,
} from './canvas/companion-node';

/** Node dimensions by medium type per UI-SPEC and MMED-09 */
const NODE_SIZES: Record<string, { width: number; height: number }> = {
  text: { width: 300, height: 200 },
  code: { width: 400, height: 250 },
  mermaid: { width: 400, height: 300 },
  image: { width: 512, height: 512 },
};

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
  /** Hash of canvas state at last generation — skip generation if nothing changed (e.g., click/select) */
  private lastCanvasHash = '';
  /** IDs of nodes created by AI — interactions with these don't trigger new generation */
  private aiNodeIds = new Set<string>();
  /** Runware client for image generation (Phase 4, D-08) */
  private runwareClient: RunwareImageClient | null = null;
  /** Image saver for persisting generated images to vault (Phase 4, D-07) */
  private imageSaver: ImageSaver | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();

    // Initialize CanvasAdapter for canvas read/write operations
    this.adapter = new CanvasAdapter(this.app);

    // Initialize Claude client if API key exists
    if (this.settings.claudeApiKey) {
      this.claudeClient = createClaudeClient(this.settings.claudeApiKey);
    }

    // Initialize image generation modules (lazy -- Runware connects on first use per Pitfall 7)
    if (this.settings.runwareApiKey) {
      this.runwareClient = new RunwareImageClient(this.settings.runwareApiKey);
    }
    this.imageSaver = new ImageSaver(this.app.vault, this.settings.imageSavePath);

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
      // Skip if any node is being actively edited (user still typing)
      const canvas = this.adapter.getActiveCanvas();
      if (canvas && this.isAnyNodeBeingEdited(canvas)) return;
      // Skip if the focused/selected node is AI-generated
      if (canvas?.nodes) {
        for (const node of canvas.nodes.values()) {
          if (node.isFocused && this.aiNodeIds.has(node.id)) return;
        }
      }
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
    this.runwareClient?.disconnect();
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

  /** Check if any canvas node is currently in edit mode (user has cursor active) */
  private isAnyNodeBeingEdited(canvas: any): boolean {
    if (!canvas?.nodes) return false;
    for (const node of canvas.nodes.values()) {
      if (node.isEditing) return true;
    }
    return false;
  }

  /** Compute a fingerprint of canvas state to detect actual content changes */
  private computeCanvasHash(nodes: { id: string; x: number; y: number; content: string }[]): string {
    return nodes.map(n => `${n.id}:${n.x},${n.y}:${n.content}`).sort().join('|');
  }

  /** Re-snapshot canvas hash after async mutations (image gen) to prevent re-trigger */
  private resnapCanvasHash(canvas: any): void {
    const nodes = this.adapter.getNodesFromCanvas(canvas);
    if (nodes.length > 0) this.lastCanvasHash = this.computeCanvasHash(nodes);
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

      // Skip generation if canvas content hasn't changed (e.g., click/select, not an edit)
      const canvasHash = this.computeCanvasHash(nodes);
      if (canvasHash === this.lastCanvasHash) return;

      const edges = this.adapter.getEdgesFromCanvas(canvas);

      // 4. Determine trigger node (use provided ID or fallback to first node)
      const effectiveTriggerNodeId = triggerNodeId ?? nodes[0]?.id;
      if (!effectiveTriggerNodeId) return;

      // Skip generation if trigger node is AI-generated or blank
      if (this.aiNodeIds.has(effectiveTriggerNodeId)) return;
      const triggerNode = nodes.find(n => n.id === effectiveTriggerNodeId);
      if (triggerNode && !triggerNode.content.trim()) return;

      // 4b. Detect iteration request: is this trigger an edit on a text node
      // with incoming edges from AI-created nodes? If so, the trigger is an
      // "iterate on the linked source" request rather than a fresh generation.
      // When `iteration` is null, the non-iteration flow runs unchanged.
      const iteration: IterationContext | null = detectIterationContext({
        triggerNodeId: effectiveTriggerNodeId,
        nodes,
        edges,
        aiNodeIds: this.aiNodeIds,
      });

      // 5. Build spatial context (Phase 2). The trigger text node remains the
      // "active node" in the narrative even in iteration mode — spatial
      // relationships belong in block 2 (dynamic). Iteration source content
      // enters via the user message (also dynamic), keeping block 1 cached.
      const spatialCtx = buildSpatialContext(nodes, edges, effectiveTriggerNodeId);

      // 6. Read taste profile (TAST-01, TAST-03)
      const tasteProfile = await readTasteProfile(
        this.app.vault.adapter,
        this.settings.tasteProfilePath
      );
      const tasteContent = formatTasteForPrompt(tasteProfile);

      // 7. Build system prompt (GENP-06, GENP-08)
      const systemPrompt = buildSystemPrompt(tasteContent, spatialCtx.narrative);

      // 7b. Choose user message + placements + type cap based on iteration mode
      let userMessage: string;
      let placements: PlacementCoordinate[];
      let preSeededTypes: Set<string> | undefined;

      if (iteration) {
        console.log(
          `[Canvas AI] iteration detected: primary=${iteration.primarySource.type}` +
            `${iteration.primarySource.lang ? '/' + iteration.primarySource.lang : ''}, ` +
            `additional=${iteration.additionalSources.length}, ` +
            `targetType=${iteration.targetType}`
        );
        userMessage = buildIterationUserMessage(iteration);
        const targetSize = NODE_SIZES[iteration.targetType] ?? NODE_SIZES.text;
        placements = [
          computeIterationPlacement(iteration.primarySource.node, targetSize, nodes),
        ];
        // Pre-seed seenTypes so Claude can only create the target type.
        // Defense-in-depth: the prompt also instructs single-medium output.
        const ALL_TYPES = ['code', 'text', 'mermaid', 'image'] as const;
        preSeededTypes = new Set(ALL_TYPES.filter(t => t !== iteration.targetType));
      } else {
        userMessage = buildUserMessage();
        placements = spatialCtx.placementSuggestions;
        preSeededTypes = undefined;
      }

      // 8. Set thinking state
      this.setLastTriggerTime(new Date());
      this.setState('thinking');

      if (signal.aborted) return;

      // 9. Stream response with sequential multi-node support (D-01, D-02, D-03)
      const result = await this.streamWithRetry(
        canvas, systemPrompt, userMessage, signal, placements, preSeededTypes
      );

      if (!result || signal.aborted) return;

      // 10. Track token usage (GENP-09, D-13)
      this.tokenUsage = trackTokens(this.tokenUsage, result.usage);
      await this.persistTokenUsage();

      // 11. Snapshot canvas state (including new AI nodes) to prevent re-trigger on click
      const postNodes = this.adapter.getNodesFromCanvas(canvas);
      if (postNodes.length > 0) this.lastCanvasHash = this.computeCanvasHash(postNodes);

      // 12. Done
      this.setState('idle');

    } catch (err) {
      if (signal.aborted) return; // Cancelled, not an error
      console.error('[Canvas AI] Generation failed:', err);
      this.setState('error');
      // Error notice handled in streamWithRetry
    }
  }

  /**
   * Stream a Claude response with retry logic and multi-medium routing.
   *
   * Phase 4 multi-medium pipeline (D-01 through D-12):
   * - Deferred node creation: nodes created on first onTextUpdate (correct type/size)
   * - One-per-type enforcement: Set<string> tracks seen types, duplicates skipped (D-02)
   * - Text/code: progressive streaming into canvas nodes
   * - Mermaid: buffered until </node> boundary, then flushed as complete diagram (D-10)
   * - Image: placeholder with "Generating image...", async Runware request on boundary (D-08)
   */
  private async streamWithRetry(
    canvas: any,
    systemPrompt: SystemPromptBlock[],
    userMessage: string,
    signal: AbortSignal,
    placements: PlacementCoordinate[],
    preSeededTypes?: Set<string>
  ): Promise<StreamResult | null> {
    let attempt = 0;

    while (attempt <= 3) {
      try {
        let activeNode: any = null;
        let activeNodeMeta: TypedNodeMeta | null = null;
        let placementIndex = 0;
        // Pre-seed with blocked types for iteration mode so Claude cannot emit
        // node types other than the iteration target. Defense-in-depth alongside
        // the prompt's explicit single-medium instruction.
        const seenTypes = new Set<string>(preSeededTypes);
        let mermaidBuffer = '';
        let isBufferingMermaid = false;
        // Track the latest flushed code content so the stream-completion
        // fallback can finalize the code node and create its companion
        // even if the stream ends without a </node> closing tag (e.g.
        // max_tokens hit mid-stream). Reset whenever a code node is
        // successfully closed via onNodeBoundary.
        let latestCodeText = '';
        let latestCodeLang: string | undefined = undefined;

        // Helper: create a node for the given type at the next placement
        const createNodeForType = (meta: TypedNodeMeta): any | null => {
          console.log(`[Canvas AI] createNodeForType: type=${meta.type}, lang=${meta.lang ?? 'none'}, seenTypes=[${[...seenTypes].join(',')}]`);
          if (seenTypes.has(meta.type)) {
            console.log(`[Canvas AI] SKIP duplicate type: ${meta.type}`);
            return null;
          }
          if (seenTypes.size >= 4) {
            console.log(`[Canvas AI] SKIP max 4 nodes reached`);
            return null;
          }

          const size = NODE_SIZES[meta.type] ?? NODE_SIZES.text;
          const placement = placements[placementIndex] ?? { x: 0, y: 0, ...size };
          // Override width/height from NODE_SIZES for correct medium sizing
          const position = { x: placement.x, y: placement.y, width: size.width, height: size.height };
          placementIndex++;

          const node = this.suppressEvents(() =>
            this.adapter.createTextNodeOnCanvas(canvas, position, this.settings.aiNodeColor)
          );
          if (!node) return null;

          if (node.id) this.aiNodeIds.add(node.id);
          this.adapter.addNodeCssClass(node, 'canvas-ai-node--streaming');
          seenTypes.add(meta.type);

          // Image placeholder: set text and add CSS class per D-06
          if (meta.type === 'image') {
            this.adapter.addNodeCssClass(node, 'canvas-ai-node--image-placeholder');
            this.suppressEvents(() => this.adapter.updateNodeText(node, 'Generating image...'));
          }

          return node;
        };

        const result = await streamIntoNode(
          this.claudeClient!,
          systemPrompt,
          userMessage,
          signal,
          {
            onFirstToken: () => {
              this.setState('streaming');
            },

            onTextUpdate: (text: string, meta: TypedNodeMeta) => {
              // Create node if none is active (first node or after boundary)
              if (!activeNode) {
                console.log(`[Canvas AI] onTextUpdate: creating node for type=${meta.type}, text preview="${text.substring(0, 50)}..."`);
                activeNode = createNodeForType(meta);
                activeNodeMeta = meta;
                if (!activeNode) return;
                // Remove pulsing for text/code (content arriving); keep for mermaid/image
                if (meta.type === 'text' || meta.type === 'code') {
                  this.adapter.removeNodeCssClass(activeNode, 'canvas-ai-node--streaming');
                }
                if (meta.type === 'mermaid') {
                  mermaidBuffer = '';
                  isBufferingMermaid = true;
                }
              }

              if (!activeNode) return;

              // Route by medium type per D-10, D-11, D-12
              console.log(`[Canvas AI] onTextUpdate routing: type=${activeNodeMeta?.type}, textLen=${text.length}`);
              if (activeNodeMeta?.type === 'mermaid') {
                // Buffer mermaid content -- don't flush to node yet (D-10, MMED-04)
                mermaidBuffer = text;
                isBufferingMermaid = true;
              } else if (activeNodeMeta?.type === 'code') {
                // Progressive streaming with fenced code block wrapper (D-12)
                const lang = activeNodeMeta.lang ?? '';
                const wrappedCode = '```' + lang + '\n' + text + '\n```';
                this.suppressEvents(() => this.adapter.updateNodeText(activeNode, wrappedCode));
                // Capture for the stream-completion fallback in case </node>
                // never arrives (truncation). Updated on every flush.
                latestCodeText = text;
                latestCodeLang = activeNodeMeta.lang;
              } else if (activeNodeMeta?.type === 'text') {
                // Progressive streaming (same as Phase 3)
                this.suppressEvents(() => this.adapter.updateNodeText(activeNode, text));
              }
              // type === 'image': no text updates -- placeholder stays as "Generating image..."
            },

            onNodeBoundary: (content: string, nodeIndex: number, meta: TypedNodeMeta) => {
              console.log(`[Canvas AI] onNodeBoundary: nodeIndex=${nodeIndex}, completedType=${activeNodeMeta?.type}, meta.type=${meta.type}, contentLen=${content.length}`);
              // Finalize the current node
              if (activeNode && activeNodeMeta) {
                this.adapter.removeNodeCssClass(activeNode, 'canvas-ai-node--streaming');

                if (activeNodeMeta.type === 'mermaid') {
                  // Flush complete mermaid block (D-10, MMED-04)
                  const mermaidBlock = '```mermaid\n' + (mermaidBuffer || content) + '\n```';
                  this.suppressEvents(() => this.adapter.updateNodeText(activeNode, mermaidBlock));
                  mermaidBuffer = '';
                  isBufferingMermaid = false;
                } else if (activeNodeMeta.type === 'code') {
                  // Final flush with complete code
                  const lang = activeNodeMeta.lang ?? '';
                  const wrappedCode = '```' + lang + '\n' + content + '\n```';
                  this.suppressEvents(() => this.adapter.updateNodeText(activeNode, wrappedCode));

                  // D-12, D-14: create companion render node AFTER code node is finalized.
                  // Pitfall 4: companion is placed relative to the CODE node (not the trigger),
                  // so it lives further right than any primary placement zone.
                  const finalizedCodeNode = activeNode;
                  const finalizedCodeLang = activeNodeMeta.lang;
                  this.createCompanionForCode(canvas, finalizedCodeNode, content, finalizedCodeLang);
                  // Code node closed cleanly — clear the truncation-fallback state.
                  latestCodeText = '';
                  latestCodeLang = undefined;
                } else if (activeNodeMeta.type === 'text') {
                  // Final flush with complete content
                  this.suppressEvents(() => this.adapter.updateNodeText(activeNode, content));
                } else if (activeNodeMeta.type === 'image') {
                  // Fire async Runware request (D-08 -- non-blocking)
                  console.log(`[Canvas AI] IMAGE: firing Runware generation, prompt="${content.substring(0, 80)}..."`);
                  this.fireImageGeneration(content, activeNode, canvas);
                }
              }

              // Reset activeNode -- next onTextUpdate will create the new node
              activeNode = null;
              activeNodeMeta = null;
            },

            onTimeout: () => {
              new Notice('Canvas AI: Generation timed out after 30 seconds. Retrying...');
            },
          }
        );

        // Handle stream completion -- finalize any remaining active node.
        // Capture the closure-let into locals. TypeScript's cross-closure flow
        // analysis narrows activeNodeMeta to `never` here because the last
        // reachable assignment inside onNodeBoundary is `= null`; the cast
        // restores the declared type so runtime reassignments (from
        // onTextUpdate) are considered.
        const finalNode = activeNode;
        const finalMeta = activeNodeMeta as TypedNodeMeta | null;
        if (finalNode && finalMeta) {
          this.adapter.removeNodeCssClass(finalNode, 'canvas-ai-node--streaming');

          if (finalMeta.type === 'mermaid' && isBufferingMermaid) {
            // Stream ended without closing tag -- flush partial with incomplete marker
            const mermaidBlock = '```mermaid\n' + mermaidBuffer + '\n%% (incomplete -- generation was interrupted)\n```';
            this.suppressEvents(() => this.adapter.updateNodeText(finalNode, mermaidBlock));
          } else if (finalMeta.type === 'code' && latestCodeText) {
            // Stream ended without </node> for a code node -- almost always
            // means max_tokens was hit mid-stream. The code text is already
            // visible in the node from the final onTextUpdate flush; what's
            // missing is the companion render node (normally created from
            // onNodeBoundary). Create it here from the latest flushed code
            // so HTML/mermaid/svg outputs still pair with a preview.
            console.warn(
              `[Canvas AI] code stream ended without </node> — creating companion from partial content (${latestCodeText.length} chars, lang=${latestCodeLang ?? 'none'}). Likely max_tokens truncation.`
            );
            this.createCompanionForCode(canvas, finalNode, latestCodeText, latestCodeLang);
            latestCodeText = '';
            latestCodeLang = undefined;
          }
        }

        this.suppressEvents(() => this.adapter.requestCanvasSave(canvas));
        return result;

      } catch (err) {
        if (signal.aborted) return null;
        const errorType = classifyApiError(err);
        const maxRetries = getMaxRetries(errorType);

        if (attempt >= maxRetries) {
          this.handleApiError(errorType, err);
          this.setState('error');
          setTimeout(() => {
            if (!signal.aborted) this.setState('idle');
          }, 5000);
          return null;
        }

        const delay = getRetryDelay(errorType, attempt, this.extractRetryAfter(err));
        if (delay === 0) {
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

  /**
   * Fire an asynchronous image generation request via Runware (D-08).
   * Non-blocking -- called from onNodeBoundary for image nodes.
   * Swaps the placeholder text node for a file node on success per UI-SPEC.
   */
  private async fireImageGeneration(prompt: string, placeholderNode: any, canvas: any): Promise<void> {
    console.log(`[Canvas AI] fireImageGeneration: runwareClient=${!!this.runwareClient}, apiKey=${!!this.settings.runwareApiKey}, prompt="${prompt.substring(0, 80)}..."`);
    // Check if Runware client is available
    if (!this.runwareClient || !this.settings.runwareApiKey) {
      console.log(`[Canvas AI] IMAGE ABORT: no Runware client or API key`);

      this.adapter.removeNodeCssClass(placeholderNode, 'canvas-ai-node--streaming');
      this.adapter.removeNodeCssClass(placeholderNode, 'canvas-ai-node--image-placeholder');
      this.suppressEvents(() => this.adapter.updateNodeText(placeholderNode, 'Image generation failed'));
      this.resnapCanvasHash(canvas);
      new Notice('Canvas AI: Image generation failed. Check your Runware API key in Settings.');
      return;
    }

    try {
      // 1. Call Runware SDK
      console.log(`[Canvas AI] IMAGE: calling Runware SDK...`);
      const images = await this.runwareClient.generateImage(prompt);
      console.log(`[Canvas AI] IMAGE: Runware returned, images=${JSON.stringify(images?.map(i => ({ hasBase64: !!i.imageBase64Data, base64Len: i.imageBase64Data?.length })))}`);
      if (!images || images.length === 0 || !images[0].imageBase64Data) {
        console.log(`[Canvas AI] IMAGE FAIL: no image data returned`);

        this.adapter.removeNodeCssClass(placeholderNode, 'canvas-ai-node--streaming');
        this.adapter.removeNodeCssClass(placeholderNode, 'canvas-ai-node--image-placeholder');
        this.suppressEvents(() => this.adapter.updateNodeText(placeholderNode, 'Image generation failed'));
        this.resnapCanvasHash(canvas);
        new Notice('Canvas AI: Image generation failed. Check your Runware API key in Settings.');
        return;
      }

      // 2. Save image to vault via ImageSaver
      console.log(`[Canvas AI] IMAGE: saving to vault...`);
      if (!this.imageSaver) {
        this.imageSaver = new ImageSaver(this.app.vault, this.settings.imageSavePath);
      }
      const filePath = await this.imageSaver.saveToVault(images[0].imageBase64Data);
      console.log(`[Canvas AI] IMAGE: saved to ${filePath}`);

      // 3. Swap placeholder text node for file node (UI-SPEC Placeholder-to-File-Node Swap Sequence)
      console.log(`[Canvas AI] IMAGE: swapping placeholder for file node at ${filePath}`);
      const pos = {
        x: placeholderNode.x,
        y: placeholderNode.y,
        width: placeholderNode.width,
        height: placeholderNode.height,
      };

      this.suppressEvents(() => {
        // Remove placeholder text node
        this.adapter.removeNodeFromCanvas(canvas, placeholderNode);
        // Remove placeholder ID from tracking
        if (placeholderNode.id) this.aiNodeIds.delete(placeholderNode.id);

        // Create file node at same position
        const fileNode = this.adapter.createFileNodeOnCanvas(canvas, pos, filePath, this.settings.aiNodeColor);
        if (fileNode?.id) {
          this.aiNodeIds.add(fileNode.id);
        }
      });

      this.adapter.requestCanvasSave(canvas);

      // Re-snapshot canvas hash so the file node swap isn't seen as a user change
      const postNodes = this.adapter.getNodesFromCanvas(canvas);
      if (postNodes.length > 0) this.lastCanvasHash = this.computeCanvasHash(postNodes);

    } catch (err) {
      console.error('[Canvas AI] Image generation failed:', err);
      this.adapter.removeNodeCssClass(placeholderNode, 'canvas-ai-node--streaming');
      this.adapter.removeNodeCssClass(placeholderNode, 'canvas-ai-node--image-placeholder');
      this.suppressEvents(() => this.adapter.updateNodeText(placeholderNode, 'Image generation failed'));
      this.resnapCanvasHash(canvas);

      // Determine error type for appropriate notice
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      if (errMsg.toLowerCase().includes('auth') || errMsg.toLowerCase().includes('key')) {
        new Notice('Canvas AI: Runware API key is invalid. Update it in Settings > Canvas AI.');
      } else if (errMsg.toLowerCase().includes('connect') || errMsg.toLowerCase().includes('network')) {
        new Notice('Canvas AI: Could not connect to Runware. Image generation unavailable.');
      }
      // Timeouts: no Notice per UI-SPEC error recovery table
    }
  }

  // ─── Companion Render Nodes (D-12, D-13, D-14) ────────────────────

  /**
   * Create a companion render node for a code node (D-12, D-13, D-14).
   *
   * Called from onNodeBoundary when meta.type === 'code' AFTER the code node
   * has been finalized. Detects the content type (HTML/Mermaid/SVG) and creates
   * a visually-paired companion node to the right of the code node with
   * mirror-matched dimensions.
   *
   * Non-blocking: failures are logged and swallowed so they don't break the stream.
   */
  private createCompanionForCode(
    canvas: any,
    codeNode: any,
    codeContent: string,
    lang: string | undefined
  ): void {
    if (!codeNode || !codeContent) return;

    const contentType = detectCompanionContentType(codeContent, lang);
    if (!contentType) return; // Language not supported for companion rendering

    try {
      const placement = computeCompanionPlacement({
        x: codeNode.x,
        y: codeNode.y,
        width: codeNode.width,
        height: codeNode.height,
        id: codeNode.id,
      });

      const companionNode = this.suppressEvents(() =>
        this.adapter.createTextNodeOnCanvas(
          canvas,
          placement,
          this.settings.aiNodeColor
        )
      );
      if (!companionNode) return;

      // Track companion as an AI node (do not trigger generation on interaction)
      if (companionNode.id) this.aiNodeIds.add(companionNode.id);

      // Mark companion linkage + content type for reload re-hydration
      // (see rehydrateCompanionNodes below — addresses plan 05-06 D8 caveat).
      companionNode.unknownData = companionNode.unknownData ?? {};
      if (codeNode.id) {
        companionNode.unknownData.companionOf = codeNode.id;
      }
      companionNode.unknownData.companionContentType = contentType;

      // Apply type-specific CSS class (UI-SPEC contract)
      const cssClass = `canvas-ai-companion--${contentType}`;
      this.adapter.addNodeCssClass(companionNode, cssClass);

      // Populate content by type
      if (contentType === 'html') {
        const htmlContent = createHtmlCompanionContent(codeContent, lang);
        if (htmlContent) {
          // Persist the full HTML so reload rehydration can reconstruct the
          // iframe without needing to re-parse the source code node. The
          // canvas .canvas JSON preserves unknownData verbatim.
          companionNode.unknownData.companionHtml = htmlContent;
          // Seed placeholder text so Obsidian's async markdown renderer
          // materializes the nested `.markdown-rendered` container inside
          // nodeEl. injectHtmlPreview will poll via rAF for that container
          // and then inject the iframe at the correct DOM level. Without
          // seeding, the container never exists and the iframe ends up
          // clipped by the canvas CSS (Phase 5 verification gap fix).
          this.suppressEvents(() => this.adapter.updateNodeText(companionNode, '\u00a0'));
          console.log(`[Canvas AI] HTML companion: seeding + injecting, content length=${htmlContent.length}`);
          injectHtmlPreview(companionNode, htmlContent);
        }
      } else if (contentType === 'mermaid') {
        const mermaidBlock = buildMermaidCompanionContent(codeContent);
        this.suppressEvents(() => this.adapter.updateNodeText(companionNode, mermaidBlock));
      } else if (contentType === 'svg') {
        const svgMarkup = buildSvgCompanionContent(codeContent);
        this.suppressEvents(() => this.adapter.updateNodeText(companionNode, svgMarkup));
      }

      this.suppressEvents(() => this.adapter.requestCanvasSave(canvas));
    } catch (err) {
      console.error('[Canvas AI] Companion node creation failed:', err);
    }
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

  private onActiveLeafChange(leaf: WorkspaceLeaf | null): void {
    this.refreshStatusBar();

    // Rehydrate HTML companion iframes when a canvas becomes active. Canvas
    // text nodes persist their `text` and `unknownData` to the .canvas JSON,
    // but the iframe is a runtime-only DOM mutation inside nodeEl that does
    // not survive a reload. Without rehydration, HTML companions appear as
    // empty boxes after the canvas reopens. (Resolves plan 05-06 D8 caveat.)
    if (leaf?.view && (leaf.view as any).getViewType?.() === 'canvas') {
      const canvas = (leaf.view as any).canvas;
      if (canvas) {
        // Defer one frame so Obsidian has finished mounting node DOM.
        // injectHtmlPreview has its own rAF polling on top of this.
        requestAnimationFrame(() => this.rehydrateCompanionNodes(canvas));
      }
    }
  }

  /**
   * Scan a canvas for AI companion nodes persisted from a prior session and
   * re-inject runtime DOM (HTML iframes) that was lost on reload. Also
   * rehydrates `aiNodeIds` so reloaded companions and their source code
   * nodes still block generation-on-click and participate in the iteration
   * feature.
   *
   * Idempotent: safe to call multiple times on the same canvas (e.g. when
   * the user switches tabs and comes back). injectHtmlPreview empties the
   * container before appending, so re-injection replaces rather than stacks.
   */
  private rehydrateCompanionNodes(canvas: any): void {
    if (!canvas?.nodes || typeof canvas.nodes.values !== 'function') return;

    const allNodes: any[] = Array.from(canvas.nodes.values());
    let rehydratedHtml = 0;
    let rehydratedAiMarkers = 0;

    for (const node of allNodes) {
      const unknownData = node.unknownData;
      if (!unknownData) continue;

      // Rehydrate aiNodeIds for any node that was an AI-created companion
      // or the source code node a companion points at. This keeps reloaded
      // sessions compatible with the iteration feature and Gate B.
      if (unknownData.companionOf) {
        if (node.id) {
          this.aiNodeIds.add(node.id);
          rehydratedAiMarkers++;
        }
        // Also mark the source code node (if still present) as AI-created.
        const sourceNode = canvas.nodes.get?.(unknownData.companionOf);
        if (sourceNode?.id) {
          this.aiNodeIds.add(sourceNode.id);
          rehydratedAiMarkers++;
        }
      }

      // HTML iframe re-injection: only for companions that stored their
      // HTML content in unknownData.companionHtml at creation time.
      if (
        unknownData.companionContentType === 'html' &&
        typeof unknownData.companionHtml === 'string' &&
        unknownData.companionHtml.length > 0
      ) {
        try {
          injectHtmlPreview(node, unknownData.companionHtml);
          rehydratedHtml++;
        } catch (err) {
          console.error('[Canvas AI] Companion rehydration failed for node', node.id, err);
        }
      }
    }

    if (rehydratedHtml > 0 || rehydratedAiMarkers > 0) {
      console.log(
        `[Canvas AI] canvas rehydrated: ${rehydratedHtml} HTML companion(s), ` +
          `${rehydratedAiMarkers} aiNodeIds marker(s)`
      );
    }
  }
}
