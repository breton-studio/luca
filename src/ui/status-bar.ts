import { Menu } from 'obsidian';

export type StatusBarState = 'idle' | 'thinking' | 'streaming' | 'budget' | 'error';

/**
 * StatusBarManager (FOUN-12).
 *
 * Manages the status bar text indicator showing AI state.
 * Follows UI-SPEC state transition rules:
 * - "AI: idle" (muted) when enabled canvas is active and idle
 * - "AI: thinking" (normal) when debounce fires
 * - "AI: error" (error) on error
 * - "AI: no API key" (error) when Claude API key is empty
 * - Hidden when canvas is disabled (D-04) or no canvas is active
 *
 * Click opens popover with state + last trigger time (D-02).
 */
export class StatusBarManager {
  private state: StatusBarState = 'idle';
  private lastTriggerTime: string | null = null;
  private visible = false;

  constructor(private el: HTMLElement) {
    this.el.addClass('canvas-ai-status');
    this.hide();
  }

  /**
   * Update the status bar for the current context.
   * Called on: active leaf change, canvas toggle, settings change.
   *
   * @param canvasPath - Active canvas file path, or null if no canvas
   * @param isEnabled - Whether canvas AI is enabled for this canvas
   * @param hasApiKey - Whether Claude API key is configured
   */
  update(canvasPath: string | null, isEnabled: boolean, hasApiKey: boolean): void {
    // No canvas active -> hide
    if (!canvasPath) {
      this.hide();
      return;
    }

    // D-04: Canvas disabled -> hide entirely
    if (!isEnabled) {
      this.hide();
      return;
    }

    // Show with appropriate state
    this.show();

    if (!hasApiKey) {
      // D-15: No API key -> error state with specific text
      this.renderState('AI: no API key', 'error');
      return;
    }

    // D-01: Normal state display
    this.renderState(`AI: ${this.state}`, this.state);
  }

  /**
   * Set the AI state (D-01, D-03).
   * Does NOT automatically re-render -- call update() after to apply.
   */
  setState(state: StatusBarState): void {
    this.state = state;
  }

  getState(): StatusBarState {
    return this.state;
  }

  /**
   * Record trigger time for popover display.
   */
  setLastTriggerTime(time: Date): void {
    this.lastTriggerTime = time.toLocaleTimeString();
  }

  /**
   * Show the status popover (D-02).
   * Called on click. Displays state + last trigger time as read-only menu items.
   */
  showPopover(evt: MouseEvent): void {
    const menu = new Menu();
    menu.addItem((item) =>
      item.setTitle(`State: ${this.state}`).setDisabled(true)
    );
    menu.addItem((item) =>
      item
        .setTitle(`Last trigger: ${this.lastTriggerTime ?? 'never'}`)
        .setDisabled(true)
    );
    if (this.state === 'budget') {
      menu.addItem((item) =>
        item.setTitle('Budget: exceeded').setDisabled(true)
      );
    }
    menu.showAtMouseEvent(evt);
  }

  private show(): void {
    this.el.style.display = '';
    this.visible = true;
  }

  private hide(): void {
    this.el.style.display = 'none';
    this.visible = false;
  }

  private renderState(text: string, cssState: StatusBarState): void {
    this.el.setText(text);
    this.el.removeClass(
      'canvas-ai-status--idle',
      'canvas-ai-status--thinking',
      'canvas-ai-status--streaming',
      'canvas-ai-status--budget',
      'canvas-ai-status--error'
    );
    this.el.addClass(`canvas-ai-status--${cssState}`);
  }

  isVisible(): boolean {
    return this.visible;
  }
}
