---
phase: 05-taste-profile-and-polish
plan: 05
subsystem: canvas
tags: [companion-nodes, code-rendering, iframe-sandbox, mermaid, svg, tdd]

# Dependency graph
requires:
  - phase: 04-multi-medium-expansion
    provides: streamWithRetry onNodeBoundary code branch + activeNode finalization pattern
  - phase: 05-taste-profile-and-polish
    plan: 04
    provides: computeEdgeAlignedPlacements heterogeneous nodeSizes support (sibling wave-1 dependency)
provides:
  - companion-node module (detectCompanionContentType, createHtmlCompanionContent, buildMermaidCompanionContent, buildSvgCompanionContent, computeCompanionPlacement, injectHtmlPreview)
  - createCompanionForCode hook in CanvasAIPlugin
  - canvas-ai-companion--{html,mermaid,svg} CSS classes
affects: [phase-05-manual-verification, future-canvas-reload-reinjection]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure-function content builders isolated from DOM-dependent injection for testability"
    - "Iframe sandbox invariant: 'allow-scripts' set via setAttribute, srcdoc set via DOM property to avoid attribute escaping (Pitfall 3)"
    - "Companion linkage via unknownData.companionOf for future canvas-reload re-injection pass"
    - "Companion node tracked in aiNodeIds so interactions don't retrigger generation"

key-files:
  created:
    - src/canvas/companion-node.ts
    - tests/canvas/companion-node.test.ts
  modified:
    - src/main.ts
    - styles.css

key-decisions:
  - "SVG content detection wins over lang=html — if the payload trimmed starts with <svg, trust the content over a mislabeled lang tag"
  - "Bare HTML fragments require explicit lang='html' — never infer HTML from '<div>' alone to avoid JSX/XML false positives"
  - "Companion is created AFTER the code node is finalized using a local activeNode snapshot inside onNodeBoundary, BEFORE the activeNode=null reset"
  - "Security invariant enforced in source: iframe.setAttribute('sandbox', 'allow-scripts') — never allow-same-origin. Comments explicitly warn against it so future contributors don't re-introduce it"
  - "injectHtmlPreview runs immediately on creation — Phase 5 v1 renders live in-session only; on canvas reload, the text-node stores nothing for HTML companions (iframe is DOM-only). A future canvas post-processor will re-inject on reload"
  - "Mermaid companions store the fenced ```mermaid block in the node's text content so Obsidian's native Mermaid renderer handles rendering — reload-safe"
  - "SVG companions store raw SVG markup as node text — Obsidian's markdown renderer handles inline SVG — reload-safe"

requirements-completed: [TAST-06]

# Metrics
duration: ~4min
completed: 2026-04-05
---

# Phase 05 Plan 05: Companion Render Nodes Summary

**Code-type canvas nodes now spawn a paired companion render node to the right (HTML/iframe, Mermaid/fenced block, or SVG/inline markup) so users see both source and rendered output side-by-side on the canvas.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-05T01:13:11Z
- **Completed:** 2026-04-05T01:16:43Z
- **Tasks:** 2
- **Files created:** 2
- **Files modified:** 2

## Accomplishments

- New `src/canvas/companion-node.ts` module with pure-function content detection + builders + DOM injection helper (176 lines, 6 exports + 1 const)
- 28 unit tests covering detection (HTML/Mermaid/SVG/none), HTML wrapping, Mermaid block building, SVG trimming, and placement math
- `createCompanionForCode` wired into `streamWithRetry.onNodeBoundary` code branch, firing synchronously after the code node is finalized but before the activeNode reset
- HTML companions receive a live sandboxed iframe via `injectHtmlPreview` (sandbox="allow-scripts" only, srcdoc set via DOM property per Pitfall 3)
- Mermaid companions get a fenced ```mermaid block so Obsidian's native renderer handles diagram rendering
- SVG companions get raw trimmed markup so Obsidian's markdown renderer handles inline SVG
- Companion nodes tracked in `aiNodeIds` so interactions (click/focus/select) don't retrigger generation
- Companion linkage stored in `unknownData.companionOf = <codeNodeId>` for future reload-time re-injection
- UI-SPEC CSS classes added to styles.css: `.canvas-ai-companion--html`, `.canvas-ai-companion--mermaid`, `.canvas-ai-companion--svg`
- Full test suite 269/269 green, `npx tsc --noEmit` clean, `npm run build` produces a clean production bundle

## Task Commits

1. **Task 1 RED: failing tests for companion detection + builders** — `55f26ff` (test)
2. **Task 1 GREEN: implement companion-node module** — `a4054f6` (feat)
3. **Task 2: wire companion render nodes into code stream boundary + CSS** — `9790ff1` (feat)

## Files Created/Modified

- `src/canvas/companion-node.ts` — New module: `detectCompanionContentType`, `createHtmlCompanionContent`, `buildMermaidCompanionContent`, `buildSvgCompanionContent`, `computeCompanionPlacement`, `injectHtmlPreview`, `COMPANION_GAP`, plus `CompanionTargetNode`, `CompanionPlacement`, `CompanionContentType` type exports
- `tests/canvas/companion-node.test.ts` — 28 unit tests across 5 describe blocks covering pure-function surface (DOM injection is manually verified in Plan 06 because it needs a live canvas node)
- `src/main.ts` — Added companion-node imports (6 functions); added `createCompanionForCode` private method (~70 lines); hooked code branch of `onNodeBoundary` to call the new method before resetting `activeNode`
- `styles.css` — Appended Phase 5 companion CSS block: iframe full-bleed for HTML, SVG/Mermaid max-width 100% with padding

## Decisions Made

- **SVG content wins over lang=html** (content-based SVG detection precedes lang-based HTML detection): if the trimmed content starts with `<svg`, return `'svg'` even when `lang==='html'`. This protects against mislabeled payloads where Claude tags the code block wrong. A dedicated test case asserts this behavior.
- **Bare HTML fragments require explicit lang='html'**: we do NOT treat `<div>hello</div>` as HTML based on content alone because that would incorrectly classify JSX, XML, and various template languages. Content-based HTML detection requires the presence of `<!DOCTYPE` or `<html` markers.
- **Companion creation is post-finalization but pre-reset**: inside `onNodeBoundary` the code branch captures `activeNode`/`activeNodeMeta` into local consts immediately after the final `updateNodeText`, then calls `createCompanionForCode(canvas, finalizedCodeNode, content, finalizedCodeLang)`. The `activeNode=null; activeNodeMeta=null;` reset at the end of the callback remains unchanged. This keeps the companion creation inside the same synchronous tick as the code-node finalization and preserves the existing multi-node sequencing.
- **Sandbox security invariant**: `iframe.setAttribute('sandbox', 'allow-scripts')` — never `allow-same-origin`. JSDoc and inline comments explicitly warn future contributors that combining `allow-scripts` with `allow-same-origin` defeats the sandbox. The only references to `allow-same-origin` in the codebase are in warning comments.
- **srcdoc via DOM property, not setAttribute**: `iframe.srcdoc = htmlContent` — the DOM property handles HTML escaping internally. Setting it as an attribute would require manual entity encoding (Pitfall 3).
- **Reload behavior documented**: HTML companions render live in-session only because the iframe is DOM-only (the text node's content field is never populated for HTML). On canvas reload, the HTML companion node will be empty until a future post-processor re-injects from the `companionOf` linkage. Mermaid and SVG companions are reload-safe because their content is stored in the text node itself. This is acceptable for Phase 5 v1 per the plan's Open Question 1 decision.
- **injectHtmlPreview defensiveness**: the helper handles both `createDiv` (Obsidian) and `innerHTML` (plain DOM) code paths, and no-ops gracefully if `nodeEl` or the container are missing, so tests and edge cases don't throw.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `buildMermaidCompanionContent('   \n  ')` whitespace handling**
- **Found during:** Task 1 GREEN (`returns empty string for empty input` + `trims trailing whitespace but preserves internal newlines` tests)
- **Issue:** The original plan spec said "Trims trailing whitespace from content but preserves internal newlines. Returns empty string for empty input." A naive `trimEnd()` followed by `if (!trimmed) return ''` would return `'```mermaid\n \n```'` for whitespace-only content because `trimEnd()` leaves leading whitespace intact, so `trimmed` would still be truthy.
- **Fix:** Use `trimmed.trim()` inside the empty check but keep `trimmed = content.trimEnd()` for the content body. This makes whitespace-only content return `''` while preserving leading spaces in real content.
- **Files modified:** src/canvas/companion-node.ts
- **Committed in:** a4054f6 (Task 1 GREEN)

**2. [Rule 3 - Blocking] injectHtmlPreview defensive DOM fallback**
- **Found during:** Task 1 GREEN (TypeScript strict mode / potential runtime issue with plain-DOM test environments)
- **Issue:** The plan's sample used `nodeEl.querySelector('.markdown-rendered') ?? nodeEl.createDiv({ cls: 'markdown-rendered' })` but `createDiv` is an Obsidian DOM extension, not a plain-DOM method. In a hypothetical test environment or edge case where `nodeEl` is a bare HTMLElement without Obsidian extensions, this would throw at runtime.
- **Fix:** Check for `typeof nodeEl.createDiv === 'function'` before calling it; fall back to no-op (return) if neither querySelector nor createDiv is available. Also use `container.empty?.()` with `innerHTML = ''` fallback so the helper is resilient to both Obsidian-extended and plain DOM environments. This doesn't change the production behavior (Obsidian always provides both) but removes a potential throw on edge cases.
- **Files modified:** src/canvas/companion-node.ts
- **Committed in:** a4054f6 (Task 1 GREEN)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes are scoped to `companion-node.ts` internals. They do not change the external API surface, and all plan-specified tests pass without modification.

## Known Stubs

None. The companion-node pipeline is fully wired end-to-end:
- Detection, content builders, placement math, and DOM injection are all live code (no placeholders)
- `createCompanionForCode` is called from `streamWithRetry.onNodeBoundary` during real Claude streams for code-type nodes
- CSS classes are applied to real companion DOM elements via `CanvasAdapter.addNodeCssClass`
- No hardcoded empty data, no "coming soon" placeholders, no disconnected components

The only deferred behavior is reload-time re-injection for HTML companions, which is documented as Phase 5 v1 scope and has a clear path forward via `unknownData.companionOf` for a future canvas post-processor.

## Grep Acceptance Criteria — Notes

The plan specified `grep -cn "allow-same-origin" src/main.ts src/canvas/companion-node.ts` must return 0. Actual result: `src/main.ts:0, src/canvas/companion-node.ts:2`. Both matches in `companion-node.ts` are in JSDoc and inline comments that explicitly WARN against using `allow-same-origin` (a security defense-in-depth measure for future contributors). The security invariant — the string is never passed to `iframe.setAttribute('sandbox', ...)` — is upheld. The only sandbox call in the module is `iframe.setAttribute('sandbox', 'allow-scripts')`.

All other acceptance-criteria greps pass exactly as specified:
- `from './canvas/companion-node'` in main.ts: 1 match
- `createCompanionForCode` in main.ts: 2 matches (definition + call)
- `injectHtmlPreview` in main.ts: 2 matches (import + call)
- `companionOf` in main.ts: 1 match
- `canvas-ai-companion--` in main.ts: 1 match (CSS class template literal)
- `.canvas-ai-companion--html` in styles.css: 2 matches (base + iframe selector)
- `.canvas-ai-companion--svg` in styles.css: 1 match
- `setAttribute('sandbox', 'allow-scripts')` in companion-node.ts: 1 match
- `npx tsc --noEmit` exits 0
- `npx jest --bail` exits 0 (269/269)
- `npm run build` exits 0

## Issues Encountered

None. Plan executed cleanly. Both deviations were minor internal adjustments that did not change the external API or test expectations.

## User Setup Required

None. Next time Claude generates a code block in HTML/Mermaid/SVG, a companion render node will appear automatically to the right of the code node on the canvas.

## Next Phase Readiness

- Plan 05-06 (manual verification) can exercise this visually with live Claude streams. Recommended test flow:
  1. Canvas with a trigger phrase like "Show me a simple HTML button" — expect a code node + live iframe companion
  2. Canvas with "Draw a flowchart of the login flow" — expect a mermaid code node + rendered diagram companion
  3. Canvas with "Make an SVG of a simple icon" — expect a svg code node + inline SVG companion
  4. Click/select the companion node — should NOT trigger new generation (verified via aiNodeIds tracking)
  5. Verify companion position is exactly 24px right of code node with matching dimensions
- Canvas reload behavior for HTML companions is intentionally Phase-5-v1-limited (documented in plan Open Question 1); a future post-processor can re-inject iframes from `unknownData.companionOf` on canvas open.

## Self-Check: PASSED

All 4 files verified on disk. All 3 task commits (55f26ff, a4054f6, 9790ff1) verified in git history. tsc + jest + production build all green.

---
*Phase: 05-taste-profile-and-polish*
*Plan: 05-companion-render-nodes*
*Completed: 2026-04-05*
