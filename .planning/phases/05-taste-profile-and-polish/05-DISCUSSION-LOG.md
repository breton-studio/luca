# Phase 5: Taste Profile and Polish - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-03
**Phase:** 05-taste-profile-and-polish
**Areas discussed:** Style vs Substance, Counter-sycophancy, Settings UI editing, AI node placement (backlog), Code render companion (backlog)

---

## Style vs Substance Separation

| Option | Description | Selected |
|--------|-------------|----------|
| YAML sections | Split frontmatter into style: and substance: groups. Single file. | ✓ |
| Separate files | Two files: taste-style.md and taste-substance.md | |
| Flat fields with prefixes | Keep flat YAML with style_* and substance_* prefixes | |

**User's choice:** YAML sections
**Notes:** None

### Follow-up: Body split

| Option | Description | Selected |
|--------|-------------|----------|
| Single body | One freeform body, YAML provides structure | |
| Headed sections | Body uses ## Style Philosophy and ## Substance Philosophy headers | ✓ |

**User's choice:** Headed sections

---

## Counter-Sycophancy

| Option | Description | Selected |
|--------|-------------|----------|
| System prompt only | Hardcoded instructions, user doesn't configure | ✓ |
| Taste profile field | challenge_level field in YAML (low/medium/high) | |
| Both | Base instructions + configurable intensity | |

**User's choice:** System prompt only

### Follow-up: Behaviors

| Option | Description | Selected |
|--------|-------------|----------|
| Devil's advocate | Argue against user's direction | ✓ |
| Unexpected connections | Surprising analogies from unrelated domains | ✓ |
| Uncomfortable questions | Surface assumptions user may be avoiding | ✓ |
| Contrarian references | Cite thinkers/works that disagree with user | ✓ |

**User's choice:** All four behaviors

---

## Settings UI Editing

| Option | Description | Selected |
|--------|-------------|----------|
| Open file button | Button opens taste profile in Obsidian editor | ✓ |
| Inline text areas | Text inputs for each field in settings tab | |
| Both | Inline fields + open editor button | |

**User's choice:** Open file button

### Follow-up: Per-member profiles

| Option | Description | Selected |
|--------|-------------|----------|
| Named files + dropdown | Multiple files with dropdown selector | |
| Single file, you decide | Claude's discretion | |
| Defer to later | Skip per-member profiles | ✓ |

**User's choice:** Defer to later

---

## AI Node Placement Alignment (backlog fold)

| Option | Description | Selected |
|--------|-------------|----------|
| Right edge | Nodes flow rightward, aligned to trigger's right edge | ✓ |
| Dominant direction | Auto-detect most open space | |
| User-configured | Setting for preferred direction | |

**User's choice:** Right edge

---

## Code Render Companion Node (backlog fold)

**Code types for preview:** HTML/CSS/JS (with interactivity), Mermaid, SVG
**User note:** "HTML/CSS/JS including interactivity"

---

## Claude's Discretion

- System prompt wording for counter-sycophancy
- Placement gap sizes and stacking offsets
- Companion node sizing
- HTML/JS sandboxing approach
- Taste profile migration strategy

## Deferred Ideas

- TAST-04: Per-member profile switching — deferred from Phase 5
