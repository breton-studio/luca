# Obsidian Canvas AI

## What This Is

An Obsidian plugin that integrates Claude Opus 4.6 into the canvas as a spatial thinking partner. When users write, move, or cluster nodes on the canvas, Opus reads the spatial state after a brief idle pause and auto-generates new nodes nearby — text, code, diagrams, or images — turning the canvas into a real-time AI-powered ideation surface.

## Core Value

After any canvas action, Opus reads spatial context and generates relevant multi-medium content that feels like a natural extension of your thinking — fast enough that it doesn't break flow.

## Requirements

### Validated

- [x] Opus receives spatial context: node positions, content, and proximity relationships — Validated in Phase 02: spatial-intelligence
- [x] Proximity interpreted as both "related concepts" and "focus area" — Validated in Phase 02: spatial-intelligence
- [x] Generated nodes appear with spatial awareness (placed logically, not overlapping) — Validated in Phase 02: spatial-intelligence
- [x] Plugin hooks into Obsidian canvas events (node create, move, edit, delete) — Validated in Phase 03: core-generation-loop
- [x] Debounce triggers Opus after ~3s of user idle — Validated in Phase 03: core-generation-loop
- [x] Auto-generates new text/markdown nodes placed near the action area — Validated in Phase 03: core-generation-loop
- [x] Streaming/progressive rendering so content appears quickly — Validated in Phase 03: core-generation-loop
- [x] Global taste profile that defines what the user considers tasteful and how they think — Validated in Phase 03: core-generation-loop
- [x] Taste profile is editable (settings UI or markdown file) — Validated in Phase 03: core-generation-loop
- [x] Opus uses the taste profile to shape all generated content — tone, style, depth, aesthetics — Validated in Phase 03: core-generation-loop

### Active

- [ ] Auto-generates code block nodes when context calls for it
- [ ] Auto-generates SVG/Mermaid diagram nodes for structured visuals
- [ ] Auto-generates images via Riverflow 2.0 Pro (Runware API) when visuals are needed
- [ ] Opus decides which medium type(s) to generate based on context
- [ ] Works for a small team (shared configuration, API key management)
- [ ] Each team member can have their own taste profile

### Out of Scope

- Mobile app — Obsidian desktop canvas only for v1
- Voice input — text/spatial interaction only
- Real-time multiplayer — async collaboration is fine, live cursors are not
- Plugin marketplace publishing — internal distribution for now
- Updating/rewriting existing nodes — v1 generates new nodes only

## Context

- Obsidian has a plugin API (TypeScript) with access to canvas events and workspace
- Canvas files are JSON (`.canvas` format) with nodes, edges, positions, and dimensions
- Claude API supports streaming responses, which enables progressive content rendering
- Runware provides an API for running image generation models including Riverflow 2.0 Pro
- The debounce-after-idle interaction pattern avoids overwhelming the API and feels natural
- Spatial proximity is a novel input signal — no existing Obsidian plugins do this with LLMs

## Constraints

- **API**: Claude API (Opus 4.6) for reasoning, Runware API for image generation
- **Platform**: Obsidian plugin (TypeScript, Obsidian API)
- **Latency**: Content must begin appearing within a few seconds of idle trigger
- **Image model**: Riverflow 2.0 Pro specifically, accessed through Runware
- **Distribution**: Small team — no public plugin store requirements

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Debounce on idle (~3s) rather than trigger per action | Avoids spam, feels natural, batches related actions | -- Pending |
| Riverflow 2.0 Pro via Runware for images | User preference for this specific model/provider | -- Pending |
| Generate new nodes only (don't modify existing) | Simpler v1, preserves user's original content | -- Pending |
| Opus decides medium type based on context | More natural than forcing user to specify output type | -- Pending |
| Proximity = relationship + focus signal | Richer spatial interpretation enables better generation | -- Pending |
| Taste profile shapes all generation | Users think differently — generated content should reflect the user's sensibility, not generic AI output | -- Pending |
| Max one node per content type per generation | Prevents overwhelming the canvas. Each generation produces at most 1 text node + optionally 1 code + 1 diagram + 1 image — each must be a distinct type. No duplicate types. | Implemented Phase 3 (text-only cap); Phase 4 adds multi-type |
| AI nodes don't trigger generation | Interactions with AI-generated nodes (click, select, focus) are ignored by the debounce system. Only user-created content triggers the loop. | Implemented Phase 3 |
| Generation requires edit-mode exit | Debounce only starts after user clicks out of a node (isEditing=false). Prevents mid-thought interruption. | Implemented Phase 3 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-03 after Phase 03 completion*
