---
phase: 05-taste-profile-and-polish
plan: 03
type: execute
wave: 1
depends_on: []
files_modified:
  - src/settings.ts
autonomous: true
requirements:
  - TAST-05
must_haves:
  truths:
    - "Clicking 'Edit profile' opens the taste profile markdown file in an Obsidian editor tab (D-07)"
    - "Clicking 'Reset to default' prompts a confirmation modal before overwriting, with the exact copy from UI-SPEC"
    - "Cancelling the reset modal leaves the taste profile untouched"
    - "Confirming the reset modal overwrites the taste profile with DEFAULT_TASTE_PROFILE"
  artifacts:
    - path: src/settings.ts
      provides: "Confirmation modal wiring on Reset to default button; existing Edit profile button verified wired to openTasteProfile()"
      contains: "Reset taste profile"
  key_links:
    - from: "src/settings.ts::Reset to default button onClick"
      to: "Obsidian Modal class (confirmation dialog)"
      via: "new Modal(app) instance with confirm/dismiss buttons matching UI-SPEC copy"
      pattern: "class .*ResetConfirmModal extends Modal"
    - from: "ResetConfirmModal confirm button"
      to: "plugin.resetTasteProfile()"
      via: "callback invoked only on confirm, not on dismiss"
      pattern: "resetTasteProfile"
---

<objective>
Wire the Settings UI taste profile controls (TAST-05, D-07) with a proper confirmation dialog on destructive reset, per the UI-SPEC copywriting contract.

Per the existing code review: the "Edit profile" button is already wired to `openTasteProfile()` (src/settings.ts line 162-169 → src/main.ts line 646). The "Reset to default" button is already wired to `resetTasteProfile()` (src/settings.ts line 172-182) but WITHOUT a confirmation modal — per UI-SPEC lines 206-213, a confirmation is required for this destructive action.

This plan adds an Obsidian `Modal` confirmation dialog with the exact copy from 05-UI-SPEC.md lines 197-206, and verifies the existing Edit profile wiring.

TAST-05 acceptance: "Taste profile editable through the settings UI or by editing the file directly." The Edit profile button opens the file in an editor — user edits live Obsidian editor, not an inline form (D-07).

Purpose: Prevent accidental loss of carefully-crafted user taste profiles by gating the reset action behind an explicit confirmation.
Output: Updated `src/settings.ts` with a new `ResetTasteProfileConfirmModal` class and confirmation-gated button handler.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/REQUIREMENTS.md
@.planning/phases/05-taste-profile-and-polish/05-CONTEXT.md
@.planning/phases/05-taste-profile-and-polish/05-UI-SPEC.md
@src/settings.ts
@src/main.ts

<interfaces>
From src/main.ts:
```typescript
async openTasteProfile(): Promise<void>;  // line 646
async resetTasteProfile(): Promise<void>; // line 666 — writes DEFAULT_TASTE_PROFILE to vault path
```

Both methods already exist and are wired. This plan only adds a confirmation modal in front of resetTasteProfile().

Obsidian Modal API (from obsidian package):
```typescript
import { Modal, App, Setting } from 'obsidian';

class MyModal extends Modal {
  constructor(app: App) { super(app); }
  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: 'Title' });
    contentEl.createEl('p', { text: 'Body text' });
    new Setting(contentEl)
      .addButton(btn => btn.setButtonText('Cancel').onClick(() => this.close()))
      .addButton(btn => btn.setButtonText('Confirm').setWarning().onClick(() => {
        this.onConfirm();
        this.close();
      }));
  }
  onClose(): void { this.contentEl.empty(); }
}
```

UI-SPEC copy (canonical — 05-UI-SPEC.md lines 196-213):
| Reset confirmation dialog title | `Reset taste profile` |
| Reset confirmation dialog body  | `This will replace your current taste profile with the default. Your existing preferences will be lost. Continue?` |
| Reset confirmation: confirm     | `Reset` |
| Reset confirmation: dismiss     | `Keep my profile` |
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add ResetTasteProfileConfirmModal class and gate the Reset button behind it</name>
  <files>src/settings.ts</files>
  <read_first>
    - src/settings.ts (full file — 249 lines, current settings tab implementation)
    - src/main.ts lines 646-672 (openTasteProfile, resetTasteProfile method signatures)
    - .planning/phases/05-taste-profile-and-polish/05-UI-SPEC.md lines 108-115 (Modified Components — Edit/Reset buttons)
    - .planning/phases/05-taste-profile-and-polish/05-UI-SPEC.md lines 186-213 (Copywriting Contract and Destructive Actions sections)
    - .planning/phases/05-taste-profile-and-polish/05-CONTEXT.md (D-07)
  </read_first>
  <action>
    1. In src/settings.ts, UPDATE the top import statement on line 1 to add `Modal` and `Notice`:

    ```typescript
    import { App, PluginSettingTab, Setting, Modal, Notice } from 'obsidian';
    ```

    (Currently: `import { App, PluginSettingTab, Setting } from 'obsidian';` — line 1)

    2. ADD a new class `ResetTasteProfileConfirmModal` at the end of src/settings.ts (after the closing brace of `CanvasAISettingTab`, still inside the file, as a second exported class — unexported is also fine since it is only used within this file):

    ```typescript
    /**
     * Confirmation dialog shown before resetting the taste profile (D-07, UI-SPEC Destructive Actions).
     *
     * Copy matches 05-UI-SPEC.md lines 196-213 verbatim.
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
            btn
              .setButtonText('Keep my profile')
              .onClick(() => {
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
    ```

    3. REPLACE the existing "Reset to default button" block in src/settings.ts (currently lines 172-182) with one that opens the modal instead of calling `resetTasteProfile` directly:

    Current code:
    ```typescript
    // Reset to default button
    new Setting(containerEl)
      .setName('Reset taste profile')
      .setDesc('Reset to the default taste profile')
      .addButton((button) =>
        button
          .setButtonText('Reset to default')
          .setWarning()
          .onClick(async () => {
            await (this.plugin as any).resetTasteProfile();
          })
      );
    ```

    Replace with:
    ```typescript
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
    ```

    4. VERIFY the existing "Edit profile" button (lines 161-169) is already correctly wired to `openTasteProfile()`. Do NOT modify it. Confirm the copy matches UI-SPEC:
       - Name: `Edit taste profile` (Note: UI-SPEC line 196 calls this "Taste Profile" heading and line 199 calls the label "Edit profile". Current code at line 163 says "Edit taste profile" as the Setting name and "Edit profile" as the button text via `setButtonText('Edit profile')`. Verify both strings match by reading the file. If the current code says anything other than `.setName('Edit taste profile')` and `.setButtonText('Edit profile')` and `.setDesc('Open the taste profile file in the editor')`, update to match UI-SPEC exactly.)

    5. DO NOT add a Notice after the modal confirms — the `resetTasteProfile()` method in main.ts line 671 already emits `new Notice('Taste profile reset to default.', 10000)`. Double notices would be noisy.

    6. Run `npx tsc --noEmit` to confirm no TypeScript errors. If the `Modal` or `Notice` import fails, verify the obsidian package types are available (they are — used elsewhere in main.ts at line 1).

    7. Run `npm run build` (esbuild) to confirm the plugin still bundles. If `esbuild` is not the actual build command, check `package.json` scripts and use the correct one.

    8. Run `npx jest --bail` to confirm no test suite regressed (settings.ts has no direct unit tests currently, but typescript and snapshot-free jest should stay green).
  </action>
  <verify>
    <automated>npx tsc --noEmit && npx jest --bail</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "import.*Modal.*from 'obsidian'" src/settings.ts` returns a match (Modal imported)
    - `grep -n "class ResetTasteProfileConfirmModal" src/settings.ts` returns exactly 1 match
    - `grep -n "Reset taste profile" src/settings.ts` returns at least 2 matches (Setting name + modal h2)
    - `grep -n "Keep my profile" src/settings.ts` returns exactly 1 match (dismiss button copy from UI-SPEC)
    - `grep -nF "This will replace your current taste profile with the default. Your existing preferences will be lost. Continue?" src/settings.ts` returns exactly 1 match (verbatim body copy)
    - `grep -n "new ResetTasteProfileConfirmModal" src/settings.ts` returns exactly 1 match (modal is opened from the Reset button handler)
    - `grep -n "setButtonText('Edit profile')" src/settings.ts` returns exactly 1 match (Edit profile button verified per UI-SPEC)
    - `grep -n "Open the taste profile file in the editor" src/settings.ts` returns exactly 1 match (Edit profile description verbatim per UI-SPEC)
    - `npx tsc --noEmit` exits 0
    - `npx jest --bail` exits 0
  </acceptance_criteria>
  <done>
    Reset to default button opens a confirmation modal with UI-SPEC-exact copy. Confirming runs resetTasteProfile(); dismissing does nothing. Edit profile button wiring verified intact. TypeScript compiles, jest suite green.
  </done>
</task>

</tasks>

<verification>
- Settings tab renders an Obsidian Modal (ResetTasteProfileConfirmModal) on reset button click
- Modal copy matches UI-SPEC verbatim: title "Reset taste profile", body as specified, confirm "Reset", dismiss "Keep my profile"
- Dismiss closes modal without side effects
- Confirm invokes plugin.resetTasteProfile() (which writes DEFAULT_TASTE_PROFILE)
- TypeScript compiles, jest passes
- Manual verification of runtime behavior is handled in Plan 06 (checkpoint)
</verification>

<success_criteria>
- UI-SPEC copywriting contract honored verbatim for destructive confirmation
- Confirmation modal gates the only destructive taste profile action
- Edit profile wiring verified unchanged
- TypeScript + jest green
</success_criteria>

<output>
After completion, create `.planning/phases/05-taste-profile-and-polish/05-03-SUMMARY.md` per template.
</output>
