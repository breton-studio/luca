import { Plugin, Notice, Menu, WorkspaceLeaf } from 'obsidian';
import type {} from 'obsidian-typings';
import { CanvasAISettings, DEFAULT_SETTINGS } from './types/settings';
import { CanvasAISettingTab } from './settings';
import { StatusBarManager } from './ui/status-bar';

export default class CanvasAIPlugin extends Plugin {
  settings!: CanvasAISettings;
  private statusBarEl: HTMLElement | null = null;
  private statusBar!: StatusBarManager;
  private apiKeyNoticeShown = false;

  async onload(): Promise<void> {
    await this.loadSettings();

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
    this.refreshStatusBar();
  }

  // --- Canvas view helpers ---

  getActiveCanvasPath(): string | null {
    const leaf = this.app.workspace.activeLeaf;
    if (!leaf || leaf.view.getViewType() !== 'canvas') return null;
    return (leaf.view as any).file?.path ?? null;
  }

  private onActiveLeafChange(_leaf: WorkspaceLeaf | null): void {
    this.refreshStatusBar();
  }
}
