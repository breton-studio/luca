import { App, PluginSettingTab, Setting } from 'obsidian';
import type CanvasAIPlugin from './main';

export class CanvasAISettingTab extends PluginSettingTab {
  plugin: CanvasAIPlugin;

  constructor(app: App, plugin: CanvasAIPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // --- API Keys Section (D-05) ---
    new Setting(containerEl).setName('API Keys').setHeading();

    // Claude API key (D-07: plain text field)
    const claudeKeySetting = new Setting(containerEl)
      .setName('Claude API key')
      .setDesc('Your Anthropic API key for Claude Opus 4.6')
      .addText((text) => {
        text
          .setPlaceholder('sk-ant-...')
          .setValue(this.plugin.settings.claudeApiKey)
          .onChange(async (value) => {
            this.plugin.settings.claudeApiKey = value.trim();
            await this.plugin.saveSettings();
            this.validateClaudeKey(value.trim(), claudeKeySetting.descEl);
          });
        // Validate on initial display if value exists
        if (this.plugin.settings.claudeApiKey) {
          setTimeout(() => {
            this.validateClaudeKey(this.plugin.settings.claudeApiKey, claudeKeySetting.descEl);
          }, 0);
        }
      });

    // Runware API key (D-07: plain text field)
    const runwareKeySetting = new Setting(containerEl)
      .setName('Runware API key')
      .setDesc('Your Runware API key for image generation')
      .addText((text) => {
        text
          .setPlaceholder('rw-...')
          .setValue(this.plugin.settings.runwareApiKey)
          .onChange(async (value) => {
            this.plugin.settings.runwareApiKey = value.trim();
            await this.plugin.saveSettings();
            this.validateRunwareKey(value.trim(), runwareKeySetting.descEl);
          });
        if (this.plugin.settings.runwareApiKey) {
          setTimeout(() => {
            this.validateRunwareKey(this.plugin.settings.runwareApiKey, runwareKeySetting.descEl);
          }, 0);
        }
      });

    // --- Behavior Section (D-05) ---
    new Setting(containerEl).setName('Behavior').setHeading();

    // Debounce delay slider (D-08)
    new Setting(containerEl)
      .setName('Debounce delay')
      .setDesc('Seconds of idle before AI generates')
      .addSlider((slider) =>
        slider
          .setLimits(1, 10, 1)
          .setValue(this.plugin.settings.debounceDelay)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.debounceDelay = value;
            await this.plugin.saveSettings();
            // Notify generation controller of delay change
            this.plugin.updateDebounceDelay(value);
          })
      );

    // Debug mode toggle (D-14)
    new Setting(containerEl)
      .setName('Debug mode')
      .setDesc('Log all canvas events to developer console')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.debugMode)
          .onChange(async (value) => {
            this.plugin.settings.debugMode = value;
            await this.plugin.saveSettings();
          })
      );
  }

  // D-06: Format-only validation per user approval.
  // This intentionally checks only the key prefix format, NOT actual API connectivity.
  // Real API key validation (live test call) is deferred to Phase 3 per user decision.
  private validateClaudeKey(value: string, descEl: HTMLElement): void {
    descEl.empty();
    if (!value) {
      descEl.setText('Your Anthropic API key for Claude Opus 4.6');
      descEl.removeClass('canvas-ai-valid', 'canvas-ai-invalid');
      return;
    }
    if (value.startsWith('sk-ant-')) {
      descEl.setText('Format OK \u2014 will verify on first use');
      descEl.addClass('canvas-ai-valid');
      descEl.removeClass('canvas-ai-invalid');
    } else {
      descEl.setText('Invalid key format. Expected: sk-ant-...');
      descEl.addClass('canvas-ai-invalid');
      descEl.removeClass('canvas-ai-valid');
    }
  }

  // D-06: Format-only validation (same rationale as Claude key above).
  private validateRunwareKey(value: string, descEl: HTMLElement): void {
    descEl.empty();
    if (!value) {
      descEl.setText('Your Runware API key for image generation');
      descEl.removeClass('canvas-ai-valid', 'canvas-ai-invalid');
      return;
    }
    if (value.length > 0) {
      descEl.setText('Format OK \u2014 will verify on first use');
      descEl.addClass('canvas-ai-valid');
      descEl.removeClass('canvas-ai-invalid');
    }
  }
}
