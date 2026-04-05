import { App, PluginSettingTab, Setting, Modal } from 'obsidian';
import type CanvasAIPlugin from './main';
import { TokenUsageData, DEFAULT_TOKEN_USAGE } from './types/settings';

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

    // --- Token Budget Section (D-11) ---
    new Setting(containerEl).setName('Token Budget').setHeading();

    // Daily token limit slider: range 100K-2M, step 100K, default 500K
    new Setting(containerEl)
      .setName('Daily token limit')
      .setDesc('Maximum tokens per day (input + output). Generation pauses when exceeded.')
      .addSlider((slider) =>
        slider
          .setLimits(100000, 2000000, 100000)
          .setValue(this.plugin.settings.dailyTokenBudget)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.dailyTokenBudget = value;
            await this.plugin.saveSettings();
          })
      );

    // Today's usage: read-only text display
    new Setting(containerEl)
      .setName("Today's usage")
      .setDesc(this.formatTokenUsage());

    // Override budget toggle
    new Setting(containerEl)
      .setName('Override budget')
      .setDesc('Allow generation for the rest of today even though the budget is exceeded')
      .addToggle((toggle) =>
        toggle
          .setValue(this.getTokenUsage().budgetOverride)
          .onChange(async (value) => {
            await (this.plugin as any).setBudgetOverride(value);
          })
      );

    // --- AI Node Appearance Section (D-05, D-06) ---
    new Setting(containerEl).setName('AI Node Appearance').setHeading();

    // Node color dropdown: options "1"-"6"
    new Setting(containerEl)
      .setName('Node color')
      .setDesc('Canvas color preset for AI-generated nodes')
      .addDropdown((dropdown) =>
        dropdown
          .addOptions({
            '1': 'Color 1 (Red)',
            '2': 'Color 2 (Orange)',
            '3': 'Color 3 (Yellow)',
            '4': 'Color 4 (Green)',
            '5': 'Color 5 (Cyan)',
            '6': 'Color 6 (Purple)',
          })
          .setValue(this.plugin.settings.aiNodeColor.length <= 1 ? this.plugin.settings.aiNodeColor : '6')
          .onChange(async (value) => {
            this.plugin.settings.aiNodeColor = value;
            await this.plugin.saveSettings();
          })
      );

    // --- Taste Profile Section (D-08, D-09, D-10) ---
    new Setting(containerEl).setName('Taste Profile').setHeading();

    // Profile location: read-only
    new Setting(containerEl)
      .setName('Profile location')
      .setDesc(this.plugin.settings.tasteProfilePath);

    // Edit profile button
    new Setting(containerEl)
      .setName('Edit taste profile')
      .setDesc('Open the taste profile file in the editor')
      .addButton((button) =>
        button.setButtonText('Edit profile').onClick(async () => {
          await (this.plugin as any).openTasteProfile();
        })
      );

    // Reset to default button (TAST-05, D-07) — confirmation modal gates the destructive action
    new Setting(containerEl)
      .setName('Reset taste profile')
      .setDesc('Reset to the default taste profile')
      .addButton((button) =>
        button
          .setButtonText('Reset to default')
          .setWarning()
          .onClick(() => {
            new ResetTasteProfileConfirmModal(this.app, async () => {
              await (this.plugin as any).resetTasteProfile();
            }).open();
          })
      );

    // --- Image Generation Section (Phase 4, D-07) ---
    containerEl.createEl('h3', { text: 'Image Generation' });

    new Setting(containerEl)
      .setName('Image save location')
      .setDesc('Vault folder where generated images are saved')
      .addText((text) =>
        text
          .setPlaceholder('canvas-ai-images')
          .setValue(this.plugin.settings.imageSavePath)
          .onChange(async (value) => {
            this.plugin.settings.imageSavePath = value || 'canvas-ai-images';
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

  private formatTokenUsage(): string {
    const usage = this.getTokenUsage();
    const limit = this.plugin.settings.dailyTokenBudget;
    const total = usage.inputTokens + usage.outputTokens;
    return `${total.toLocaleString()} / ${limit.toLocaleString()} tokens`;
  }

  private getTokenUsage(): TokenUsageData {
    // Read from plugin's token usage (will be wired in Plan 04)
    return (this.plugin as any).tokenUsage ?? DEFAULT_TOKEN_USAGE;
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

/**
 * Confirmation dialog shown before resetting the taste profile (TAST-05, D-07, UI-SPEC Destructive Actions).
 *
 * Copy matches 05-UI-SPEC.md lines 198-201 verbatim. See that file for the canonical strings
 * (title, body, confirm, dismiss). Do not reword without updating UI-SPEC first.
 */
class ResetTasteProfileConfirmModal extends Modal {
  private readonly onConfirmCallback: () => void | Promise<void>;

  constructor(app: App, onConfirm: () => void | Promise<void>) {
    super(app);
    this.onConfirmCallback = onConfirm;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: 'Reset taste profile' });
    contentEl.createEl('p', {
      text: 'This will replace your current taste profile with the default. Your existing preferences will be lost. Continue?',
    });

    new Setting(contentEl)
      .addButton((btn) =>
        btn.setButtonText('Keep my profile').onClick(() => {
          this.close();
        })
      )
      .addButton((btn) =>
        btn
          .setButtonText('Reset')
          .setWarning()
          .onClick(async () => {
            try {
              await this.onConfirmCallback();
            } finally {
              this.close();
            }
          })
      );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
