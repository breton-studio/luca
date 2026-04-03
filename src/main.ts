import { Plugin, Notice, Menu, WorkspaceLeaf } from 'obsidian';
import type {} from 'obsidian-typings';
import { CanvasAISettings, DEFAULT_SETTINGS } from './types/settings';
import { CanvasAISettingTab } from './settings';

export default class CanvasAIPlugin extends Plugin {
  settings!: CanvasAISettings;
  private statusBarEl: HTMLElement | null = null;
  private currentState: 'idle' | 'thinking' | 'error' = 'idle';
  private lastTriggerTime: string | null = null;
  private apiKeyNoticeShown = false;

  async onload(): Promise<void> {
    await this.loadSettings();

    // Settings tab (FOUN-10)
    this.addSettingTab(new CanvasAISettingTab(this.app, this));

    // Status bar -- hidden by default, shown when enabled canvas is active
    this.statusBarEl = this.addStatusBarItem();
    this.statusBarEl.addClass('canvas-ai-status');
    this.statusBarEl.style.display = 'none';

    // Status bar click -> popover (D-02)
    this.registerDomEvent(this.statusBarEl, 'click', (evt: MouseEvent) => {
      this.showStatusPopover(evt);
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

    // First-run notice if no API key (D-15)
    if (!this.settings.claudeApiKey) {
      this.showApiKeyNotice();
    }

    // --- EXTENSION POINTS (filled by later plans) ---
    // Plan 02: Canvas adapter initialization
    // Plan 04: Canvas event patching (initCanvasPatching)
    // Plan 05: Debounce controller wiring
  }

  // --- Settings persistence ---

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  // --- Status bar management (FOUN-12) ---

  setState(state: 'idle' | 'thinking' | 'error'): void {
    this.currentState = state;
    this.updateStatusBar();
  }

  setLastTriggerTime(time: Date): void {
    this.lastTriggerTime = time.toLocaleTimeString();
  }

  private updateStatusBar(): void {
    if (!this.statusBarEl) return;

    const canvasPath = this.getActiveCanvasPath();
    if (!canvasPath) {
      this.statusBarEl.style.display = 'none';
      return;
    }

    // D-04: Hide status bar when canvas is disabled
    if (this.settings.disabledCanvases.includes(canvasPath)) {
      this.statusBarEl.style.display = 'none';
      return;
    }

    this.statusBarEl.style.display = '';

    // Remove all state classes
    this.statusBarEl.removeClass('canvas-ai-status--idle', 'canvas-ai-status--thinking', 'canvas-ai-status--error');

    // D-15: Show "no API key" if keys not configured
    if (!this.settings.claudeApiKey) {
      this.statusBarEl.setText('AI: no API key');
      this.statusBarEl.addClass('canvas-ai-status--error');
      return;
    }

    // D-01: Text badge states
    this.statusBarEl.setText(`AI: ${this.currentState}`);
    this.statusBarEl.addClass(`canvas-ai-status--${this.currentState}`);
  }

  // D-02: Status popover
  private showStatusPopover(evt: MouseEvent): void {
    const menu = new Menu();
    menu.addItem((item) =>
      item.setTitle(`State: ${this.currentState}`).setDisabled(true)
    );
    menu.addItem((item) =>
      item
        .setTitle(`Last trigger: ${this.lastTriggerTime ?? 'never'}`)
        .setDisabled(true)
    );
    menu.showAtMouseEvent(evt);
  }

  // D-15: First-run API key notice
  private showApiKeyNotice(): void {
    if (this.apiKeyNoticeShown) return;
    this.apiKeyNoticeShown = true;
    new Notice('Canvas AI: Set up your API keys in Settings \u2192 Canvas AI');
  }

  // --- Per-canvas enable/disable (D-09, D-10, D-11, D-12) ---

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
    this.updateStatusBar();
  }

  // --- Canvas view helpers ---

  getActiveCanvasPath(): string | null {
    const leaf = this.app.workspace.activeLeaf;
    if (!leaf || leaf.view.getViewType() !== 'canvas') return null;
    return (leaf.view as any).file?.path ?? null;
  }

  private onActiveLeafChange(_leaf: WorkspaceLeaf | null): void {
    this.updateStatusBar();
  }
}
