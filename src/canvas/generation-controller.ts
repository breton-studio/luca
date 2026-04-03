import { debounce, Debouncer } from 'obsidian';

/**
 * GenerationController (FOUN-08, FOUN-09).
 *
 * Manages the debounce timer between canvas events and generation.
 * Every canvas event calls handleCanvasEvent(). After the configured
 * idle delay with no new events, onTrigger fires.
 *
 * FOUN-09: Each fire aborts any in-flight request via AbortController
 * before creating a new signal for the new generation cycle.
 *
 * In Phase 1, the onTrigger callback just flips status to "thinking"
 * then back to "idle". Phase 3 will replace this with actual Claude calls.
 */
export class GenerationController {
  private abortController: AbortController | null = null;
  private debouncedFire: Debouncer<[], void>;
  private delayMs: number;
  private lastNodeId: string | undefined;

  /**
   * @param delaySeconds - Debounce delay in seconds (from settings, 1-10)
   * @param onTrigger - Callback when debounce fires. Receives AbortSignal for cancellation
   *                    and the trigger node ID (if available) for spatial context.
   */
  constructor(
    delaySeconds: number,
    private onTrigger: (signal: AbortSignal, triggerNodeId?: string) => void | Promise<void>
  ) {
    this.delayMs = delaySeconds * 1000;
    this.debouncedFire = debounce(
      () => this.fire(),
      this.delayMs,
      true // resetTimer: restart the timer on each call
    );
  }

  /**
   * Called on every canvas event (create, edit, move, delete).
   * Restarts the debounce timer. If the timer was already running,
   * it resets to the full delay. Tracks the last node ID for spatial context.
   *
   * @param nodeId - Optional node ID from the canvas event
   */
  handleCanvasEvent(nodeId?: string): void {
    if (nodeId) this.lastNodeId = nodeId;
    this.debouncedFire();
  }

  /**
   * Internal: Called when the debounce timer fires (user went idle).
   *
   * 1. Abort any in-flight generation (FOUN-09)
   * 2. Create a fresh AbortController
   * 3. Call the onTrigger callback with the new signal
   */
  private fire(): void {
    // FOUN-09: Cancel any in-flight generation
    if (this.abortController) {
      this.abortController.abort();
    }

    // Create fresh abort controller for this generation cycle
    this.abortController = new AbortController();

    // Consume the last node ID for this generation cycle
    const nodeId = this.lastNodeId;
    this.lastNodeId = undefined;

    // Fire the generation callback with signal and trigger node ID
    try {
      this.onTrigger(this.abortController.signal, nodeId);
    } catch (err) {
      console.error('[Canvas AI] Generation trigger error:', err);
    }
  }

  /**
   * Update debounce delay when settings change.
   * Recreates the debouncer with the new delay.
   */
  updateDelay(delaySeconds: number): void {
    this.delayMs = delaySeconds * 1000;
    this.debouncedFire = debounce(
      () => this.fire(),
      this.delayMs,
      true
    );
  }

  /**
   * Cancel any pending debounce and in-flight generation.
   * Called on plugin unload.
   */
  destroy(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    // Note: Obsidian's debounce doesn't expose a cancel method,
    // but since the plugin is unloading, the callback reference
    // will be garbage collected.
  }
}
