# Phase 1: Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-02
**Phase:** 01-foundation
**Areas discussed:** Status bar indicator, Settings tab layout, Enable/disable scope, Canvas event feedback

---

## Status Bar Indicator

### State Display Style

| Option | Description | Selected |
|--------|-------------|----------|
| Icon + short text | e.g. brain emoji + "Thinking..." — compact but informative | |
| Minimal icon only | Colored dot, hover for details — unobtrusive | |
| Text badge | Short text like "AI: idle" — no emoji, professional look | ✓ |

**User's choice:** Text badge
**Notes:** Professional, clean aesthetic preferred over emoji-based indicators

### Click Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Toggle enable/disable | One-click to pause/resume the plugin | |
| Open settings | Click takes you to settings tab | |
| Show status popover | Click shows popup with state details | ✓ |

**User's choice:** Show status popover
**Notes:** None

### Popover Content

| Option | Description | Selected |
|--------|-------------|----------|
| Current state + last trigger time | e.g. "Idle — last triggered 12s ago" | ✓ |
| Token usage today | Daily token spend against budget cap | |
| Quick toggle button | Enable/disable button inside popover | |
| Link to settings | Shortcut to open settings from popover | |

**User's choice:** Current state + last trigger time only
**Notes:** Lightweight popover — minimal information

### Debounce Countdown

| Option | Description | Selected |
|--------|-------------|----------|
| Show countdown | "AI: 3s... 2s... 1s... thinking" | |
| Just flip to thinking | "AI: idle" then "AI: thinking" directly | ✓ |

**User's choice:** Just flip to thinking
**Notes:** Less visual noise preferred

---

## Settings Tab Layout

### Organization

| Option | Description | Selected |
|--------|-------------|----------|
| Grouped sections | API Keys section, Behavior section with headings | ✓ |
| Flat list | All settings in one scrollable list | |
| Tabbed sub-sections | Tabs within settings for API, Behavior, Advanced | |

**User's choice:** Grouped sections
**Notes:** None

### API Key Validation

| Option | Description | Selected |
|--------|-------------|----------|
| Test buttons per key | Each key field gets a "Test" button | |
| Just save | Keys saved as-is, errors surface at generation time | |
| Test on save | Auto-validate when settings saved, show inline result | ✓ |

**User's choice:** Test on save
**Notes:** Automatic validation without extra UI buttons

### Key Display

| Option | Description | Selected |
|--------|-------------|----------|
| Masked with reveal toggle | Keys show as dots, eye icon to reveal | |
| Plain text | Keys always visible | ✓ |
| Masked, no reveal | Keys hidden after entry | |

**User's choice:** Plain text
**Notes:** Local desktop app, masking is unnecessary overhead

### Debounce Input Style

| Option | Description | Selected |
|--------|-------------|----------|
| Slider with value label | Slider 1-10s with current value displayed | ✓ |
| Number input | Text field for typing delay in seconds | |
| Preset buttons | Quick/Normal/Slow presets (1s/3s/5s) | |

**User's choice:** Slider with value label
**Notes:** None

---

## Enable/Disable Scope

### Toggle Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Global only | One toggle for all canvases | |
| Per-canvas | Each canvas independently enabled/disabled | ✓ |
| Global + per-canvas override | Global on/off with per-canvas exceptions | |

**User's choice:** Per-canvas
**Notes:** User wants fine-grained control over which canvases have AI active

### Toggle Access

| Option | Description | Selected |
|--------|-------------|----------|
| Command palette only | "Toggle Canvas AI" in command palette | |
| Status bar click | Click status bar to toggle current canvas | |
| Canvas right-click menu | Right-click canvas background for toggle | ✓ |

**User's choice:** Canvas right-click menu
**Notes:** Contextual, discoverable access point

### Disabled State Display

| Option | Description | Selected |
|--------|-------------|----------|
| Show "AI: off" | Always visible in status bar | |
| Hide status bar item | No status bar when disabled | ✓ |
| Dimmed/grayed text | "AI: off" in muted style | |

**User's choice:** Hide status bar item
**Notes:** Completely out of the way when disabled

### New Canvas Default

| Option | Description | Selected |
|--------|-------------|----------|
| Enabled by default | New canvases start with AI active | ✓ |
| Disabled by default | User must explicitly enable per canvas | |
| Configurable in settings | Setting controls the default | |

**User's choice:** Enabled by default
**Notes:** Opt-out model — the whole point is auto-generation

---

## Canvas Event Feedback

### Normal Use Visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Silent — status bar only | Events trigger internal debounce, status bar shows "thinking" when it fires | ✓ |
| Brief flash on status bar | Status bar briefly shows "detected" per event | |
| Obsidian notice toast | Toast notification per event | |

**User's choice:** Silent — status bar only
**Notes:** No per-event noise

### Debug Logging

| Option | Description | Selected |
|--------|-------------|----------|
| Togglable in settings | Debug toggle enables console.log for every event | ✓ |
| Always log to console | Events always logged | |
| No debug logging | No event logging at all | |

**User's choice:** Togglable in settings
**Notes:** For development and bug reports

### Missing API Key Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Status bar error + one-time notice | "AI: no API key" + dismissable notice guiding to settings | ✓ |
| Just status bar error | "AI: error" in status bar, popover explains | |
| Open settings automatically | First failed trigger opens settings tab | |

**User's choice:** Status bar error + one-time notice
**Notes:** Guides without nagging

---

## Claude's Discretion

- Per-canvas state persistence mechanism
- Status popover implementation approach
- Canvas right-click menu integration method
- Slider widget implementation within Obsidian Setting API

## Deferred Ideas

None — discussion stayed within phase scope
