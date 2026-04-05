---
phase: 05-taste-profile-and-polish
plan: 02
subsystem: ai-prompt-builder
tags: [typescript, prompt-engineering, counter-sycophancy, system-prompt, prompt-caching]

# Dependency graph
requires:
  - phase: 03-core-generation-loop
    provides: buildSystemPrompt block[0] with cache_control ephemeral (GENP-08)
  - phase: 05-taste-profile-and-polish
    provides: 05-01 nested TasteProfile shape (formatTasteForPrompt output flows into block[0] after Intellectual Honesty section)
provides:
  - Intellectual Honesty section appended to GENERATION_INSTRUCTIONS with four D-05 behaviors
  - Permissive timing language (D-06) — "Use your judgment", "occasionally", "when appropriate"
  - Explicit anti-hostile phrasing (no "always challenge", no "never agree")
  - No-meta-narration directive — Claude must not flag the technique ("playing devil's advocate")
  - 7 new tests asserting presence and wording of the block, cached-block placement
affects: [05-06 manual verification, all Phase 5 generation calls]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hardcoded system-prompt directive appended to GENERATION_INSTRUCTIONS template literal — no new config surface, no runtime flag (D-04)"
    - "Permissive timing phrasing over imperative verbs — 'use your judgment', 'occasionally', 'when appropriate' rather than 'always', 'never', 'must always'"
    - "Anti-meta-narration clause — explicit instruction to NOT flag the technique ('Never flag these as playing devil\\'s advocate') to prevent performative pushback"
    - "Case-insensitive test matching via .toLowerCase() for sentence-case phrases that may begin a sentence"

key-files:
  created: []
  modified:
    - src/ai/prompt-builder.ts
    - tests/ai/prompt-builder.test.ts

key-decisions:
  - "[Phase 05]: Counter-sycophancy is hardcoded into GENERATION_INSTRUCTIONS (D-04) — no settings field, no runtime toggle. Users cannot opt out; the directive is a product commitment, not a preference."
  - "[Phase 05]: Block appended BEFORE the taste-profile injection point in block[0].text so the instruction-order reads: rules > caveat > personal style. Claude sees the sycophancy guard before it sees the user's taste, which is the correct priority order."
  - "[Phase 05]: Permissive timing language (D-06 probabilistic) — 'Use your judgment', 'occasionally', 'when appropriate'. Imperative phrasing ('always challenge') was explicitly forbidden per Pitfall 2 (hostile AI)."
  - "[Phase 05]: Anti-meta-narration directive — 'Never flag these as playing devil\\'s advocate'. The technique should feel natural, not performative."
  - "[Phase 05]: Case-insensitive test match for 'use your judgment' phrase — the actual prompt text begins the sentence with capital 'Use', so tests use .toLowerCase() to match intent regardless of sentence case."

patterns-established:
  - "System prompt directive pattern: new sections append to GENERATION_INSTRUCTIONS template literal. This automatically flows through buildSystemPrompt into the cached block[0] without any signature change. Future Phase 5+ directives should follow the same pattern to preserve prompt caching (GENP-08)."
  - "TDD RED-GREEN-REFACTOR collapsed into single commit when plan specifies exact text (source file + test file are interdependent — tests assert on specific wording the source must contain verbatim). The RED phase was verified (6 new tests initially failing), then GREEN phase landed in one commit since the block text is spec-locked."

requirements-completed: [TAST-07]

# Metrics
duration: 2min
completed: 2026-04-05
---

# Phase 05 Plan 02: Counter-Sycophancy Prompt Summary

**Hardcoded Intellectual Honesty block appended to GENERATION_INSTRUCTIONS, naming Devil's advocate, Unexpected connections, Uncomfortable questions, and Contrarian references with permissive timing — Claude is no longer a yes-machine, but also not a hostile contrarian.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-05T01:12:44Z
- **Completed:** 2026-04-05T01:14:56Z
- **Tasks:** 1 (executed TDD: RED phase confirmed 6 new failing tests, GREEN phase landed together with the block text)
- **Files modified:** 2

## Accomplishments

- Appended the "## Intellectual Honesty" section to the GENERATION_INSTRUCTIONS template literal in `src/ai/prompt-builder.ts`, placed after the existing "## Spatial Awareness" section and before the closing backtick.
- Block names all four D-05 behaviors with bolded bullet labels: **Devil's advocate**, **Unexpected connections**, **Uncomfortable questions**, **Contrarian references**.
- Permissive timing language per D-06: "occasionally challenge", "Use your judgment on timing", "not every response", "When appropriate". No imperatives.
- Framing phrase "You are not a yes-machine" anchors the section thematically and makes the instruction scannable in logs.
- Anti-meta-narration directive: "Never flag these as 'playing devil's advocate' — just do it naturally as part of extending their thinking." Prevents performative pushback.
- Block flows through `buildSystemPrompt` block[0].text via existing string concatenation (`${GENERATION_INSTRUCTIONS}\n\n## Taste Profile\n${tasteContent}`). No signature changes to buildSystemPrompt, buildUserMessage, SystemPromptBlock, or any other export. Prompt caching (`cache_control: { type: 'ephemeral' }`, GENP-08) is preserved.
- Added a new `describe('Counter-Sycophancy (TAST-07, D-04, D-05, D-06)', ...)` block with 7 tests in `tests/ai/prompt-builder.test.ts` covering section header presence, yes-machine framing, all four bolded behavior labels, permissive timing language, absence of hostile imperatives ("always challenge", "never agree"), the no-meta-narration directive, and the GENP-08 regression guard (block lives inside cached block[0]).
- Test suite grew from 16 to 23 cases; all 23 pass. `npx tsc --noEmit` clean across the project.

## Task Commits

1. **Task 1 (Intellectual Honesty block + tests):** `500e089` (feat)

Plan metadata: (pending — staged with final commit)

## Files Created/Modified

- `src/ai/prompt-builder.ts` — Added a 10-line "## Intellectual Honesty" section at the end of the GENERATION_INSTRUCTIONS template literal. No other exports changed. The block is positioned after "## Spatial Awareness" and before the closing backtick. Net delta: +10 lines (1 blank separator + 9 content lines).
- `tests/ai/prompt-builder.test.ts` — Added a new describe block `Counter-Sycophancy (TAST-07, D-04, D-05, D-06)` with 7 tests. Net delta: +42 lines. Existing tests untouched.

## Decisions Made

- **D-04 enforced: hardcoded, not configurable.** No new settings field, no runtime flag, no dependency injection. The block is a hardcoded string constant baked into the source. Users cannot opt out. This is a product commitment: the AI should push back occasionally, and that behavior is not a preference.
- **Permissive timing language over imperatives (D-06 + Pitfall 2).** The plan explicitly forbade imperative phrasing like "always challenge" or "never agree". The final text uses "occasionally", "When appropriate", "Use your judgment on timing", "regularly enough" — language that signals probability rather than obligation. This matches the D-06 probabilistic semantics.
- **No meta-narration.** The final clause ("Never flag these as 'playing devil's advocate' -- just do it naturally") prevents Claude from performing the technique openly, which would feel forced. The pushback must feel organic to the user, not staged.
- **Block placement: inside block[0], before taste-profile injection.** Because buildSystemPrompt concatenates `GENERATION_INSTRUCTIONS + "\n\n## Taste Profile\n" + tasteContent`, appending to GENERATION_INSTRUCTIONS automatically places the counter-sycophancy block BEFORE the taste profile. This is the correct priority order: rules > caveat > personal style. The user's taste profile is read through the lens of the honesty caveat, not vice versa.
- **Case-insensitive test match for 'use your judgment'.** The prompt text starts the sentence with capital "Use your judgment". The test for this phrase uses `.toLowerCase()` to match regardless of sentence case — consistent with the sibling assertion for `'occasionally'` which also uses `.toLowerCase()`. Documented inline in the test.

## Deviations from Plan

### [Rule 1 - Bug] Fixed case-sensitivity mismatch in plan test spec

- **Found during:** Task 1 GREEN phase (first jest run after landing the block).
- **Issue:** The plan's `<action>` specifies the exact block text `"Use your judgment on timing -- not every response..."` (capital U at sentence start). The plan's `<behavior>` and test spec, however, wrote `expect(GENERATION_INSTRUCTIONS).toContain('use your judgment')` (lowercase u) without a `.toLowerCase()` normalization. The lowercase substring is not present in the prompt text — the actual text is "Use your judgment" — so the test failed on the otherwise-correct implementation.
- **Fix:** Changed the test to `expect(GENERATION_INSTRUCTIONS.toLowerCase()).toContain('use your judgment')`, matching the pattern used by the sibling assertion `expect(GENERATION_INSTRUCTIONS.toLowerCase()).toContain('occasionally')` two lines below. Added an inline comment documenting the intent (case-insensitive match because the phrase begins a sentence with capital U).
- **Rationale:** The plan is internally inconsistent — the block text and the test spec disagree on case. Two options exist: (a) lowercase the block text to match the lowercase test spec, or (b) upgrade the test to case-insensitive to match the block text. Option (b) is correct because (1) the block text in the plan's `<action>` is explicitly marked as "MUST preserve the exact header text and the four bullet labels" with the exact capital-U version, and (2) the sibling test already uses `.toLowerCase()` for the same reason ("occasionally" might also appear capitalized). The fix aligns the test with the intent.
- **Files modified:** `tests/ai/prompt-builder.test.ts`
- **Verification:** `npx jest tests/ai/prompt-builder.test.ts` → 23/23 green. The case-insensitive match still catches the intended phrase and fails if it were removed.
- **Committed in:** `500e089` (same commit as the primary work)

---

**Total deviations:** 1 minor test-spec fix (Rule 1 — plan internal inconsistency between action text and test spec).
**Impact on plan:** None on scope or correctness. The fix hardens the test against sentence-case variation without weakening the assertion.

## Issues Encountered

- **Parallel agent suite failure outside file boundary.** `npx jest` full suite shows 1 failed test suite: `tests/canvas/companion-node.test.ts`. This file was created by the parallel 05-05 agent in commit `55f26ff` ("test(05-05): add failing tests for companion node detection and builders") as its TDD RED phase. The 05-05 source (`src/canvas/companion-node.ts`) is still untracked pending that agent's GREEN commit. This failure is outside the 05-02 file boundary (`src/ai/prompt-builder.ts`, `tests/ai/prompt-builder.test.ts`) and belongs to the parallel 05-05 agent. No action taken; will resolve when 05-05 lands its GREEN commit. All 241 individual jest tests pass — only the companion-node suite fails to even load because its source file is not yet committed.
- **`npx tsc --noEmit` clean.** No TypeScript errors across the project. Baseline preserved.

## User Setup Required

None. Pure system-prompt update. Existing API keys and settings continue to work unchanged. First Claude call after this update will include the new Intellectual Honesty section; cache miss on the first call, cache hit on subsequent calls within the 5-minute TTL (GENP-08).

## Next Phase Readiness

- **Plan 05-06 (manual verification) is unblocked.** The prompt block is live in GENERATION_INSTRUCTIONS and will be sent with every Claude call. Manual verification can observe pushback behavior in live canvas sessions.
- **Plan 05-03 and 05-05 (parallel wave) are unaffected.** This plan touches only `src/ai/prompt-builder.ts` and `tests/ai/prompt-builder.test.ts`, completely disjoint from settings UI (05-03) and companion nodes (05-05).
- **D-04 commitment locked in.** Counter-sycophancy is now a hardcoded product property, not a runtime preference. Future plans that add a settings UI should not expose a toggle for this behavior — it is deliberately non-negotiable per D-04.
- **Caching preserved.** The new block sits inside block[0] which retains its `cache_control: { type: 'ephemeral' }`. The first call after deploy invalidates the cache and re-primes it; subsequent calls within 5 minutes hit the cache. No new cache-control surface was added.

## Self-Check: PASSED

**Files verified present:**
- `/Users/hoydbreton/Developer/obsidian/src/ai/prompt-builder.ts` (FOUND — contains "## Intellectual Honesty" at line 67, "not a yes-machine" at line 69, all four bolded behaviors at lines 72-75)
- `/Users/hoydbreton/Developer/obsidian/tests/ai/prompt-builder.test.ts` (FOUND — contains describe block "Counter-Sycophancy (TAST-07, D-04, D-05, D-06)" at line 94 with 7 tests)

**Commits verified present:**
- `500e089` (FOUND via `git log --oneline`, message: "feat(05-02): add Intellectual Honesty counter-sycophancy block to system prompt")

**Verification commands run:**
- `npx jest tests/ai/prompt-builder.test.ts` → 23/23 tests passed
- `npx tsc --noEmit` → 0 errors
- `grep` acceptance criteria: "## Intellectual Honesty" (1 match in src), "not a yes-machine" (1 match), "Devil's advocate"/"Unexpected connections"/"Uncomfortable questions"/"Contrarian references" (1 match each), "Use your judgment" (1 match, capital U), "always challenge|never agree" (0 matches), "Counter-Sycophancy" in tests (1 match), "## Intellectual Honesty" in tests (2 matches — describe header + block[0].text assertion)

## Known Stubs

None. The plan is a pure system-prompt directive with no UI surface, no settings binding, no runtime flag, and no data source wiring. Every line of the new block is substantive and test-asserted. D-04 explicitly forbids a user-facing toggle, so there is no UI to stub out.

---
*Phase: 05-taste-profile-and-polish*
*Completed: 2026-04-05*
