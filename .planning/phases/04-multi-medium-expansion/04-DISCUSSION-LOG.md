# Phase 4: Multi-Medium Expansion - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-03
**Phase:** 04-multi-medium-expansion
**Areas discussed:** Medium signaling protocol, Image generation flow, Mermaid buffering, Code block treatment

---

## Medium Signaling Protocol

### Q1: How should Claude signal which medium type it's generating?

| Option | Description | Selected |
|--------|-------------|----------|
| Typed node tags | Extend `<node>` with type attribute: `<node type="text">`, `<node type="code" lang="py">`, etc. | ✓ |
| Inline detection | Keep plain `<node>` tags, detect medium by content patterns. | |
| Separate tag types | Different top-level tags: `<text>`, `<code>`, `<mermaid>`, `<image>`. | |

**User's choice:** Typed node tags
**Notes:** Minimal change to existing stream handler — just add attribute parsing to opening tag.

### Q2: Can Claude mix medium types in a single trigger?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, mix freely | Claude picks best medium per node. 1-3 cap still applies. | ✓ |
| One medium per trigger | All nodes same type. | |
| Text always + optional other | At least one text, plus optionally one other. | |

**User's choice:** Yes, mix freely

### Q3: Should the 1-3 node cap stay the same for images?

| Option | Description | Selected |
|--------|-------------|----------|
| Same cap, images count | 1-3 total regardless of type. | ✓ |
| Images don't count | Images are bonus on top of cap. | |
| Raise cap to 4 | Allow 4 nodes for mixed triggers. | |

**User's choice:** Same cap, images count

### Q4: How should medium selection instructions work?

| Option | Description | Selected |
|--------|-------------|----------|
| Context-driven guidelines | Guidelines for each medium, Claude uses judgment. | ✓ |
| Weighted preferences | Probability weights per medium type. | |
| You decide | Claude's discretion for prompt wording. | |

**User's choice:** Context-driven guidelines

---

## Image Generation Flow

### Q5: What should image node content be?

| Option | Description | Selected |
|--------|-------------|----------|
| Plain image prompt text | Claude writes natural language prompt. | ✓ |
| Structured prompt with params | Prompt + style/aspect/negative fields. | |
| Brief description, plugin builds prompt | Plugin appends taste profile style tokens. | |

**User's choice:** Plain image prompt text

### Q6: Image placeholder while generating?

| Option | Description | Selected |
|--------|-------------|----------|
| Pulsing empty node with text | Pulsing border + "generating..." text, no icon. | ✓ |
| Text node with prompt shown | Show the image prompt while waiting. | |
| No placeholder | No feedback until image is ready. | |

**User's choice:** Pulsing empty node with "generating..." text (no icon)
**Notes:** User specifically requested no icon — text only.

### Q7: Where to save generated images?

| Option | Description | Selected |
|--------|-------------|----------|
| Plugin subfolder | .obsidian/plugins/canvas-ai/images/ (hidden) | |
| Vault-visible folder | canvas-ai-images/ at vault root | ✓ |
| Same folder as canvas | Alongside the .canvas file | |

**User's choice:** Vault-visible folder

### Q8: Sequential or parallel image generation?

| Option | Description | Selected |
|--------|-------------|----------|
| Parallel — non-blocking | Fire Runware async, stream continues | ✓ |
| Sequential — wait for image | Pause stream, wait for Runware | |

**User's choice:** Parallel — non-blocking

---

## Mermaid Buffering

### Q9: How should Mermaid diagrams render?

| Option | Description | Selected |
|--------|-------------|----------|
| Mermaid code block in text node | Fenced ```mermaid block, Obsidian renders natively | ✓ |
| SVG file node | Render to SVG, save as file | |
| You decide | Claude's discretion | |

**User's choice:** Mermaid code block in text node

### Q10: What shows while Mermaid is buffering?

| Option | Description | Selected |
|--------|-------------|----------|
| Pulsing empty node | Same pattern as text/image placeholders | ✓ |
| Show raw mermaid code | Stream syntax progressively | |
| 'Building diagram...' text | Explicit placeholder text | |

**User's choice:** Pulsing empty node (consistent pattern)

---

## Code Block Treatment

### Q11: How should code nodes differ from text nodes?

| Option | Description | Selected |
|--------|-------------|----------|
| Same text node, fenced code inside | Fenced code blocks with language tags, Obsidian highlights | ✓ |
| Distinct visual style | Different CSS class/color for code nodes | |
| You decide | Claude's discretion | |

**User's choice:** Same text node, fenced code inside
**Notes:** User also expressed interest in having code render its output in another node — captured as deferred idea (code execution/preview).

### Q12: Code streaming: progressive or buffered?

| Option | Description | Selected |
|--------|-------------|----------|
| Stream progressively | Like text, line by line | ✓ |
| Buffer until complete | Like mermaid, flush at boundary | |
| You decide | Claude's discretion | |

**User's choice:** Stream progressively

---

## Claude's Discretion

- Runware SDK integration details (initialization, error handling, retry)
- Image file node dimensions and aspect ratio
- Mermaid buffer boundary detection implementation
- Code node width adjustment (wider per MMED-09)
- Stream handler refactoring approach for typed node parsing
- Whether to append taste profile style tokens to image prompts

## Deferred Ideas

- **Code execution/preview** — Rendering generated code output in a companion node. Requires sandboxed execution, security model, multi-language runtime. Future phase.
