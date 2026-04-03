# Phase 3: Core Generation Loop - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-04-03
**Phase:** 03-core-generation-loop
**Areas discussed:** Streaming UX, AI Node Appearance, Taste Profile Format, Token Budget UX

---

## Streaming UX

### Node Appearance Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Pre-allocate + stream | Create sized empty node immediately, stream text progressively | ✓ |
| Ghost node + reveal | Translucent placeholder, solidifies when complete | |
| Inline at cursor | Stream into edited node as appended section | |

**User's choice:** Pre-allocate + stream
**Notes:** User preferred the responsive feel of immediate node appearance with progressive fill.

### Node Count Per Trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Single node | One node per trigger, focused and concise | |
| 1-3 nodes, Claude decides | Claude generates multiple when context warrants it | ✓ |
| Always multiple | Always 2-3 nodes per trigger | |

**User's choice:** 1-3 nodes, Claude decides
**Notes:** Pairs well with Phase 2's orbital placement for fanning out multiple nodes.

### Multi-Node Sequencing

| Option | Description | Selected |
|--------|-------------|----------|
| Sequential | First node completes, then next appears and streams | ✓ |
| Simultaneous | All nodes appear at once, stream in parallel | |
| Staggered | Nodes appear with slight delay, stream independently | |

**User's choice:** Sequential
**Notes:** Easier to follow and read as content arrives.

### Loading State

| Option | Description | Selected |
|--------|-------------|----------|
| Subtle pulsing border | Empty node with gently pulsing border color | ✓ |
| "Thinking..." text | Faint placeholder text replaced by real content | |
| Just empty | Normal empty node, status bar shows thinking state | |

**User's choice:** Subtle pulsing border
**Notes:** Minimal and unobtrusive. Status bar already shows "AI: thinking" for global feedback.

---

## AI Node Appearance

### Visual Distinction Method

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated color | Use one of Obsidian's 6 color presets for AI nodes | |
| Custom CSS class | Add CSS class for custom styling (border, gradient, glow) | |
| Content prefix | Prepend content with marker like sparkle emoji or "[AI]" | |
| Color + label | Dedicated color AND small "AI" prefix on first line | ✓ (modified) |

**User's choice:** Color + label (then refined -- see below)
**Notes:** Initially selected color + label, but refined through follow-up questions.

### Color Choice

| Option | Description | Selected |
|--------|-------------|----------|
| Purple (6) | Distinctive, AI-associated | |
| Cyan (5) | Cool, techy feel | |
| You decide | Claude picks during implementation | |

**User's choice:** Other -- inverse of default node color
**Notes:** User wants adaptive color: if default theme has dark nodes, AI nodes are light (and vice versa). Also wants a settings option to change the color globally and control styling properties like padding. Much more considered than a fixed preset.

### Label Style

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal dot prefix | Small "·" before first line of content | |
| Italic attribution | Faint italic footer "-- Canvas AI" | |
| No label, color only | Skip text label, rely on visual styling only | ✓ |

**User's choice:** No label, color only
**Notes:** Clean content, no text pollution. Inverse color scheme is distinctive enough.

---

## Taste Profile Format

### File Format

| Option | Description | Selected |
|--------|-------------|----------|
| Markdown with frontmatter | YAML frontmatter for structured fields + freeform markdown body | ✓ |
| Pure markdown (freeform) | No structured fields, just headings and natural language | |
| JSON | Structured JSON with defined schema | |

**User's choice:** Markdown with frontmatter
**Notes:** Feels native to Obsidian, editable in-app, readable as a note.

### File Location

| Option | Description | Selected |
|--------|-------------|----------|
| Root: .canvas-ai-taste.md | Hidden dotfile at vault root | |
| Configurable path in settings | User picks any path | |
| Inside .obsidian folder | .obsidian/plugins/canvas-ai/taste-profile.md | ✓ |

**User's choice:** Inside .obsidian folder
**Notes:** Co-located with plugin data, hidden from vault browsing.

### First-Run Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Create default template | Seed with sensible template on first run | |
| Start blank, prompt to create | No auto-creation, show notice | |
| Interactive onboarding | Walk user through questions | |

**User's choice:** Other -- seed with user's existing design philosophy
**Notes:** User provided a complete ~400-word design philosophy document rooted in Swiss rational tradition (Gerstner, Muller-Brockmann, Ruder). Covers space, grid, typography, color, materials, and timelessness. Will be used as the initial taste profile seed -- user will edit once the experience is running.

---

## Token Budget UX

### Budget Type

| Option | Description | Selected |
|--------|-------------|----------|
| Daily cap only | Single daily token budget, resets at midnight | ✓ |
| Daily + hourly caps | Both daily and hourly burst cap | |
| Dollar-based budget | Budget in dollars with estimated cost tracking | |
| No budget, just tracking | Track and display but never auto-pause | |

**User's choice:** Daily cap only
**Notes:** Simple to understand and configure. One number in settings.

### Exceeded Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Hard stop + notice | Generation pauses, status bar shows "budget", notice explains | |
| Soft warning, keep going | Warnings at 80% and 100% but no stop | |
| Hard stop + override button | Hard stop with "Continue anyway" escape hatch in settings | ✓ |

**User's choice:** Hard stop + override button
**Notes:** Safety net with an escape hatch. Override unlocks generation for the rest of the day.

### Usage Persistence

| Option | Description | Selected |
|--------|-------------|----------|
| Plugin data | Store in data.json via saveData() | ✓ |
| Separate vault file | Dedicated JSON file in vault | |
| You decide | Claude picks during implementation | |

**User's choice:** Plugin data
**Notes:** Simple, reliable, co-located with other plugin state.

---

## Claude's Discretion

- System prompt structure and wording
- Prompt caching strategy
- Pre-allocation node dimensions
- Timeout watchdog implementation
- API error retry strategy
- Multi-node decision logic
- Pulsing border CSS animation
- Token counting approach

## Deferred Ideas

None -- discussion stayed within phase scope
