# Phase 1: Foundation - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Plugin shell that loads in Obsidian, detects canvas events (create, edit, move, delete) via monkey-patching, runs a configurable debounce timer, provides a settings UI for API keys and behavior, and offers per-canvas enable/disable controls with a status bar indicator.

</domain>

<decisions>
## Implementation Decisions

### Status Bar Indicator
- **D-01:** Text badge style — no emoji/icons. States: "AI: idle", "AI: thinking", "AI: error", "AI: off"
- **D-02:** Clicking the status bar opens a status popover showing current state + last trigger time
- **D-03:** No debounce countdown in status bar — just flip directly from "idle" to "thinking" when debounce fires
- **D-04:** When canvas is disabled, hide the status bar item entirely (don't show "AI: off")

### Settings Tab Layout
- **D-05:** Grouped sections with headings — API Keys section, Behavior section (debounce, debug mode)
- **D-06:** API keys validated on save (auto-test when settings are saved, show inline success/fail)
- **D-07:** API key fields displayed as plain text (not masked)
- **D-08:** Debounce delay uses a slider input (1-10s range) with current value label displayed

### Enable/Disable Scope
- **D-09:** Per-canvas toggle — each canvas can be independently enabled/disabled
- **D-10:** Toggle accessed via canvas right-click context menu ("Enable/Disable Canvas AI")
- **D-11:** Newly opened canvases default to enabled
- **D-12:** Per-canvas state needs to be tracked and persisted (implementation detail for planner)

### Canvas Event Feedback
- **D-13:** Silent during normal use — events only trigger internal debounce, status bar shows "thinking" when debounce fires
- **D-14:** Debug mode togglable in settings — when enabled, logs all detected canvas events to developer console
- **D-15:** Missing API key triggers status bar error ("AI: no API key") plus a one-time dismissable Obsidian notice guiding user to settings

### Claude's Discretion
- How to persist per-canvas enabled/disabled state (frontmatter, separate config, etc.)
- Status popover implementation approach (Obsidian Menu, custom DOM, etc.)
- Canvas right-click menu integration method (monkey-patch vs event listener)
- Exact slider widget implementation within Obsidian's Setting API

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Specs
- `.planning/PROJECT.md` — Core value, constraints, key decisions
- `.planning/REQUIREMENTS.md` — FOUN-01 through FOUN-13 acceptance criteria
- `.planning/ROADMAP.md` — Phase 1 success criteria and dependency chain

### Technical References
- `CLAUDE.md` — Full technology stack, build configuration, canvas data format, plugin lifecycle, key technical decisions, and alternatives considered

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- No existing code — fresh project, will be scaffolded from Obsidian sample plugin template

### Established Patterns
- None yet — Phase 1 establishes the foundational patterns for all subsequent phases

### Integration Points
- Obsidian Plugin API: `onload()` / `onunload()` lifecycle
- Obsidian `addSettingTab()` for settings UI
- Obsidian `addStatusBarItem()` for status bar
- `monkey-around` for canvas event interception
- `obsidian-typings` for undocumented canvas API types

</code_context>

<specifics>
## Specific Ideas

- Status bar should feel professional and unobtrusive — text badge, not emoji
- The popover on status bar click should be lightweight — just state + last trigger time, nothing more
- Right-click context menu for per-canvas toggle is the primary control surface
- Debug mode is for development and bug reports — not user-facing in normal use

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-04-02*
