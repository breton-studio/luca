---
phase: 05-taste-profile-and-polish
plan: 01
subsystem: taste-profile
tags: [typescript, yaml-frontmatter, parser, migration, prompt-engineering]

# Dependency graph
requires:
  - phase: 03-core-generation-loop
    provides: flat TasteProfile parser + formatTasteForPrompt string contract consumed by main.ts
provides:
  - Nested TasteProfileFields interface (style + substance groups) as the canonical taste profile shape
  - Dual-format parser (nested + legacy flat) with lossless D-03 migration for existing profiles
  - Philosophy body extraction (## Style Philosophy / ## Substance Philosophy)
  - DEFAULT_TASTE_PROFILE in nested format preserving the Swiss rational seed content
  - formatTasteForPrompt emitting labeled '### Style (how to communicate)' / '### Substance (what to communicate)' sections
  - TAST-04 deferral documented in-place as a file-level JSDoc comment
affects: [05-02 prompt builder integration, 05-03 settings UI, 05-04 placement, future per-member profile work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Strict top-level-only key detection for legacy-vs-nested frontmatter discrimination (Pitfall 1)"
    - "Two-pass frontmatter parsing: classify format first, then dispatch to nested or migration parser"
    - "Philosophy body extraction via substring header markers, header-order independent"
    - "Backward-compatible body fallback in prompt formatter (covers legacy profiles without philosophy headers)"

key-files:
  created: []
  modified:
    - src/taste/taste-profile.ts
    - tests/taste/taste-profile.test.ts

key-decisions:
  - "[Phase 05]: Nested TasteProfile shape split into style (how) + substance (what) groups per D-01/D-02"
  - "[Phase 05]: Legacy-vs-nested detection uses top-level-only key check to avoid misclassifying nested frontmatter containing an indented `tone:` sub-key (Pitfall 1 from RESEARCH.md)"
  - "[Phase 05]: visual_preference legacy key maps to style.formatting (not style.voice) — formatting is the right conceptual bucket for visual aesthetics"
  - "[Phase 05]: stylePhilosophy/substancePhilosophy optional — missing headers leave both empty and formatTasteForPrompt falls back to combined body so D-03 migrated profiles render without content loss"
  - "[Phase 05]: TAST-04 (per-member profiles) explicitly deferred with file-level JSDoc so future contributors don't accidentally re-introduce per-member state into the global-profile module"

patterns-established:
  - "Parser architecture: isLegacyFrontmatter(block) -> migrateFlatToNested(block) | parseNestedFrontmatter(block) -> TasteProfileFields. Classification is isolated from parsing, enabling future format additions without touching existing branches."
  - "Indentation detection via line.startsWith(' ') || line.startsWith('\\t') (tab-tolerant) rather than regex — matches research recommendation for simple YAML subset without a full parser dependency."
  - "Prompt formatter structure: header → key:value lines (skipped when empty) → optional philosophy body → blank separator between sections. Enables readable system prompts and zero-noise output when fields are partially filled."

requirements-completed: [TAST-06]

# Metrics
duration: 5min
completed: 2026-04-05
---

# Phase 05 Plan 01: Taste Profile Structure Summary

**Nested style/substance TasteProfile shape with dual-format parser, legacy D-03 migration, philosophy-body extraction, and labeled prompt sections — no data loss for existing flat-format profiles.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-05T00:55:27Z
- **Completed:** 2026-04-05T01:00:32Z
- **Tasks:** 3 (all three collapsed into a single atomic commit because they share one file and are interdependent by design — see Deviations)
- **Files modified:** 2

## Accomplishments

- Nested TasteProfileFields interface with TasteStyleFields (tone/voice/formatting) and TasteSubstanceFields (depth/domains/thinking_approach) now the canonical shape.
- Parser classifies frontmatter as nested or legacy via strict top-level-only key detection, then dispatches to either parseNestedFrontmatter or migrateFlatToNested. Legacy D-03 mapping preserves all four flat keys into their semantic nested homes.
- extractPhilosophySections pulls freeform body under '## Style Philosophy' and '## Substance Philosophy' headers into stylePhilosophy / substancePhilosophy fields; absence leaves both empty for backward compat.
- DEFAULT_TASTE_PROFILE reformatted to nested shape, populating all six fields and splitting the body into the two philosophy headers while preserving every sentence of the original Swiss rational content (restraint, grotesque typefaces, Swiss rational tradition, timelessness-over-novelty).
- formatTasteForPrompt now emits '### Style (how to communicate)' and '### Substance (what to communicate)' labeled sections with rendered key-values, injected philosophy bodies, empty-field omission, and a combined-body fallback for legacy-migrated profiles.
- TAST-04 (per-member profiles) explicitly deferred via file-level JSDoc comment per D-08, so future contributors understand the module is single-profile by design.
- Test suite grew from 8 to 27 cases covering nested parsing, legacy migration, philosophy extraction, DEFAULT round-trip, formatter sections, empty-field omission, and body fallback.

## Task Commits

The three tasks target the same two files and are structurally interdependent (Task 2 tests require the Task 1 parser; Task 3 formatter reads fields written by Task 2's default). They were landed in a single atomic commit covering all three scopes:

1. **Task 1 + Task 2 + Task 3 (combined):** nested types, dual-format parser, nested DEFAULT, labeled formatter — `51c5719` (feat)

**Plan metadata:** (pending — staged with final commit)

_Note: Per plan file_boundary (both tasks target src/taste/taste-profile.ts + tests/taste/taste-profile.test.ts), splitting into three commits would have produced either broken intermediate states (Task 2 tests reference Task 1 parser) or empty commits. Single-commit landing matches the shared-boundary reality. All three task acceptance criteria are verified via tests passing + grep assertions in the commit diff._

## Files Created/Modified

- `src/taste/taste-profile.ts` — Rewrote from 189 LOC flat implementation to ~340 LOC nested implementation. New exports: TasteStyleFields, TasteSubstanceFields. Interface shape change: TasteProfile gains stylePhilosophy/substancePhilosophy fields, TasteProfileFields becomes nested. Added private helpers: isLegacyFrontmatter, migrateFlatToNested, parseNestedFrontmatter, extractPhilosophySections. DEFAULT_TASTE_PROFILE rewritten. formatTasteForPrompt rewritten. readTasteProfile and seedTasteProfile signatures unchanged.
- `tests/taste/taste-profile.test.ts` — Rewrote test suite from 145 LOC / 8 tests to ~390 LOC / 27 tests. New describe blocks: 'parseTasteProfileFrontmatter - nested format' (4 tests), 'parseTasteProfileFrontmatter - legacy migration (D-03)' (3 tests), 'parseTasteProfileFrontmatter - philosophy body extraction' (3 tests), 'DEFAULT_TASTE_PROFILE' (5 tests including round-trip parse), 'formatTasteForPrompt' (8 tests), 'readTasteProfile' (2 tests, migrated to nested assertions), 'seedTasteProfile' (2 tests, unchanged).

## Decisions Made

- **Legacy detection is top-level-only.** `isLegacyFrontmatter` only considers lines with no leading whitespace. This prevents a nested frontmatter block that contains an indented `tone:` sub-key from being misread as flat. Matches Pitfall 1 in 05-RESEARCH.md lines 184-189.
- **visual_preference → style.formatting (not style.voice).** Visual preference describes rendered output aesthetics (monochromatic, surgical color), which is a formatting concern, not a vocal quality. Documented in the migrateFlatToNested JSDoc.
- **Philosophy sections are optional.** Missing `## Style Philosophy` / `## Substance Philosophy` headers leave both fields empty; formatTasteForPrompt then falls back to rendering the full body as a trailing combined block. This preserves D-03 round-trips for legacy profiles that have unstructured freeform bodies.
- **Tab-tolerant indentation detection.** `line.startsWith(' ') || line.startsWith('\t')` handles both spaces and tabs, matching research recommendation for a simple YAML subset without pulling in a full parser dependency.
- **Single atomic commit for three tasks.** The three tasks share a single-file boundary and have interdependent tests (Task 2 and 3 tests both call parseTasteProfileFrontmatter which is replaced in Task 1). Splitting would produce either broken intermediate commits or empty placeholder commits. See Deviations.

## Deviations from Plan

### Process deviation: single commit instead of three

- **Found during:** Task 1 implementation
- **Issue:** The plan specifies three TDD task blocks expecting three commits, but all three tasks target the same two files (`src/taste/taste-profile.ts`, `tests/taste/taste-profile.test.ts`) and are structurally interdependent. Task 2 tests assert on the Task 1 parser output; Task 3 tests assert on interface fields defined in Task 1. Landing them as three commits would require either (a) committing broken intermediate states where some tests fail, or (b) producing empty placeholder commits for Tasks 2 and 3 after a single-commit first push. Neither is honest.
- **Fix:** Landed all three tasks in a single commit (`51c5719`) with a commit body that enumerates each task's scope and its verification. All three `<acceptance_criteria>` blocks are verified in the same commit diff.
- **Files modified:** n/a (process only)
- **Verification:** `npx jest tests/taste/taste-profile.test.ts` → 27/27 green; all grep-based acceptance criteria from all three tasks matched against the committed file; `npx tsc --noEmit` shows zero errors in taste-profile files.
- **Committed in:** 51c5719

---

**Total deviations:** 1 process deviation (no code-level auto-fixes required)
**Impact on plan:** None on correctness or scope. The three logical task boundaries are preserved in the commit body and in the SUMMARY task list; what changed is commit granularity, not work scope.

## Issues Encountered

- **Full-suite jest + tsc have pre-existing failures outside file boundary.** `npx jest` shows 11 failures in `tests/spatial/*` from a parallel agent's in-progress rewrite of `src/spatial/placement.ts` (rename of `computeOrbitalPlacements`). `npx tsc --noEmit` additionally reports errors in `src/main.ts:457`, `src/types/canvas.ts:25`, `src/spatial/context-builder.ts:23`, `src/spatial/index.ts:26`. All are outside the 05-01 file boundary (`src/taste/taste-profile.ts`, `tests/taste/taste-profile.test.ts`) and belong to other parallel plans. Resolution: logged to `.planning/phases/05-taste-profile-and-polish/deferred-items.md` with attribution. Plan 05-01 cleared the one pre-existing TS error it owned (`src/taste/taste-profile.ts(102,8)` `Record<string, string>` cast mismatch) by replacing the flat parser.
- **Stashed-state verification confirmed pre-existing errors.** Ran `git stash` during execution to confirm `src/main.ts`, `src/types/canvas.ts`, and the old `src/taste/taste-profile.ts(102,8)` TS errors all existed before my changes. My rewrite resolved the taste-profile one; the others remain for their owning plans.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Plan 05-02 (prompt builder) is unblocked.** The nested TasteProfile shape and new formatTasteForPrompt output are landed and test-verified. Plan 05-02 can call `formatTasteForPrompt(profile)` and receive the new labeled section output immediately — no further taste-profile module changes needed.
- **Plan 05-03 (settings UI) is unblocked for read-side.** Settings UI can read and display nested fields via the new TasteProfile interface. Write-side depends on Plan 05-03 deciding the edit flow (direct YAML edit vs structured form), which is independent of this plan.
- **Legacy profiles are safe.** Any user who already has a flat-format `taste-profile.md` on disk will have it migrated invisibly on first read after this update. `migrateFlatToNested` handles all four legacy keys and leaves the unmapped nested fields empty for later user-driven fill-in.
- **TAST-04 remains deferred.** Per D-08, per-member profiles are out of scope for Phase 5. The file-level JSDoc comment documents this for future contributors.

## Self-Check: PASSED

**Files verified present:**
- src/taste/taste-profile.ts (FOUND — 340+ lines, contains `TasteStyleFields`, `TasteSubstanceFields`, `migrateFlatToNested`, `extractPhilosophySections`, `TAST-04` deferral comment, `style:` / `substance:` / `## Style Philosophy` / `## Substance Philosophy` in DEFAULT, `### Style (how to communicate)` / `### Substance (what to communicate)` in formatter)
- tests/taste/taste-profile.test.ts (FOUND — contains nested-format, legacy-migration, and philosophy-body describe blocks)

**Commits verified present:**
- 51c5719 (FOUND via `git log --oneline`)

**Verification commands run:**
- `npx jest tests/taste/taste-profile.test.ts` → 27/27 tests passed
- `npx tsc --noEmit` filtered to taste files → no errors
- `grep -rn "fields\.tone\|fields\.depth\|fields\.visual_preference\|fields\.thinking_style" src/` → no matches (no flat-shape consumers remain)

## Known Stubs

None. All six nested fields in DEFAULT_TASTE_PROFILE are populated with substantive Swiss rational content migrated from the Phase 3 default. No placeholder text, no empty UI bindings, no "coming soon" markers. The plan does not wire any UI (that is Plan 05-03), so there is no display stub to track. The module is a pure data/formatting library with no UI surface of its own.

---
*Phase: 05-taste-profile-and-polish*
*Completed: 2026-04-05*
