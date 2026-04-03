---
phase: 04-multi-medium-expansion
plan: 03
subsystem: ai, canvas, image
tags: [pipeline-wiring, multi-medium, image-generation, mermaid-buffering, code-streaming]

# Dependency graph
requires:
  - phase: 04-multi-medium-expansion
    plan: 01
    provides: typed node tag parsing in stream handler, TypedNodeMeta, StreamCallbacks with meta
  - phase: 04-multi-medium-expansion
    plan: 02
    provides: RunwareImageClient, ImageSaver, createFileNodeOnCanvas, removeNodeFromCanvas
provides:
  - end-to-end multi-medium pipeline (prompt -> stream -> route -> render)
  - context-driven medium selection in Claude prompt
  - one-per-type enforcement via Set<string>
  - mermaid buffered rendering
  - async image generation with placeholder-to-file-node swap
affects:
  - src/ai/prompt-builder.ts
  - src/main.ts
  - src/types/settings.ts
  - src/settings.ts
  - styles.css

# Tech stack
added: []
patterns:
  - deferred node creation (create on first onTextUpdate, not before streaming)
  - medium-specific routing in onTextUpdate and onNodeBoundary callbacks
  - mermaid content buffering with boundary-triggered flush
  - fenced code block wrapping for progressive code streaming
  - async fire-and-forget image generation with placeholder swap
  - one-per-type enforcement via Set tracking

# Key files
created: []
modified:
  - src/ai/prompt-builder.ts
  - src/main.ts
  - src/types/settings.ts
  - src/settings.ts
  - styles.css
  - tests/ai/prompt-builder.test.ts

# Decisions
key-decisions:
  - "Deferred node creation: first node created in onTextUpdate (not pre-allocated), enabling correct type-specific sizing"
  - "One-per-type enforcement via Set<string> -- duplicate types silently skipped, max 4 nodes total"
  - "Mermaid buffering accumulates text in mermaidBuffer variable, flushed as complete ```mermaid block on </node> boundary"
  - "Code streaming wraps content in fenced code block on each update for live syntax highlighting"
  - "Image fireImageGeneration is async fire-and-forget from onNodeBoundary -- Claude stream continues immediately"
  - "Incomplete mermaid on stream end gets %% interruption comment marker"

# Metrics
duration: 4min
completed: 2026-04-03
tasks: 2
files: 6
---

# Phase 04 Plan 03: Multi-Medium Pipeline Wiring Summary

End-to-end multi-medium pipeline connecting typed node parsing (Plan 01) and image infrastructure (Plan 02) into working generation flow with context-driven medium selection, one-per-type enforcement, and medium-specific rendering strategies.

## What Was Done

### Task 1: Update prompt builder, settings, and CSS (6941bb2)
- Replaced text-only output format in GENERATION_INSTRUCTIONS with typed `<node type="...">` tags for text, code, mermaid, and image
- Added medium selection guidelines instructing Claude on context-driven type choice (text default, code for technical, mermaid for structure, image sparingly)
- Added `imageSavePath` field to `CanvasAISettings` with `'canvas-ai-images'` default
- Added "Image Generation" settings section with image save location text input
- Added CSS class `canvas-ai-node--image-placeholder` for centered, muted, italic placeholder text
- Updated `buildUserMessage` to reference "typed `<node>` tags"
- Updated prompt-builder tests: 16 tests covering all four typed tags, one-per-type constraint, and old text-only removal

### Task 2: Wire multi-medium pipeline routing in main.ts (f9c73a0)
- Added imports for `RunwareImageClient`, `ImageSaver`, and `TypedNodeMeta`
- Added `NODE_SIZES` constant with medium-specific dimensions (text 300x200, code 400x250, mermaid 400x300, image 512x512)
- Rewrote `streamWithRetry` with deferred node creation and one-per-type enforcement via `Set<string>`
- Text nodes: progressive streaming (same as Phase 3)
- Code nodes: progressive streaming with fenced code block wrapping (`\`\`\`{lang}\n{content}\n\`\`\``)
- Mermaid nodes: content buffered in `mermaidBuffer`, flushed as complete `\`\`\`mermaid` block on `</node>` boundary
- Image nodes: placeholder with "Generating image..." text, async Runware request fired on boundary
- Added `fireImageGeneration` method implementing placeholder-to-file-node swap sequence
- Error handling: auth errors show specific Notice, network errors show connection Notice, timeouts silent per UI-SPEC
- Incomplete mermaid on stream end gets `%% (incomplete -- generation was interrupted)` marker
- Runware client initialization in onload (lazy connect), cleanup in onunload

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

- `npm run build` -- PASS (TypeScript compiles successfully)
- `npx jest --bail --no-coverage` -- PASS (221 tests across 13 suites)
- All acceptance criteria verified via pattern checks

## Requirements Addressed

| Requirement | Status |
|-------------|--------|
| MMED-02 | Code blocks with language-tagged fenced code |
| MMED-03 | Mermaid diagrams via Obsidian's built-in renderer |
| MMED-04 | Mermaid buffered until complete |
| MMED-05 | Image generation via Runware/Riverflow 2.0 Pro |
| MMED-06 | Opus generates image prompts, Runware renders |
| MMED-07 | Images saved to vault as file nodes |
| MMED-08 | Image placeholder visible during generation |

## Self-Check: PASSED

- All 7 modified/created files exist on disk
- Commit 6941bb2 (Task 1) verified in git log
- Commit f9c73a0 (Task 2) verified in git log
