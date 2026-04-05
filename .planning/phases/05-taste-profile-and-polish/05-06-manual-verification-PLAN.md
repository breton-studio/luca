---
phase: 05-taste-profile-and-polish
plan: 06
type: execute
wave: 3
depends_on:
  - 05-01
  - 05-02
  - 05-03
  - 05-04
  - 05-05
files_modified: []
autonomous: false
requirements:
  - TAST-05
  - TAST-07
must_haves:
  truths:
    - "Running `npm run build` produces a clean bundle with all Phase 5 changes"
    - "Full jest suite is green after all Phase 5 plans land"
    - "TypeScript compiles without errors across the project"
    - "In live Obsidian: clicking 'Edit profile' in settings opens the taste profile in an editor tab"
    - "In live Obsidian: clicking 'Reset to default' opens a confirmation modal with UI-SPEC copy; 'Keep my profile' cancels without side effects; 'Reset' overwrites the profile and shows a Notice"
    - "In live Obsidian: generated nodes after a canvas trigger stack rightward from the trigger node's right edge per D-09/D-10"
    - "In live Obsidian: when Claude generates a code node, a companion node appears to its right within the same generation cycle"
    - "In live Obsidian: HTML companion nodes render an interactive iframe; Mermaid companions render the diagram via Obsidian's native renderer; SVG companions render inline"
    - "In live Obsidian: counter-sycophancy manifests qualitatively — after multiple triggers, generated content occasionally challenges/questions/connects rather than only reinforcing"
  artifacts: []
  key_links: []
---

<objective>
Final build + manual verification gate for Phase 5.

All prior plans (01-05) are autonomous code changes with unit test coverage. This plan is the human-verification checkpoint that confirms the runtime behavior in a live Obsidian instance — things that cannot be unit-tested without a full Obsidian canvas mock (settings modal UX, companion iframe rendering, counter-sycophancy qualitative feel, edge-aligned placement visual layout).

TAST-05 and TAST-07 are listed in `requirements` because they include runtime behaviors verified only here (TAST-05 settings UI interaction; TAST-07 counter-sycophancy qualitative behavior).

Purpose: Gate phase completion on actual observed behavior in Obsidian, not just green tests.
Output: Build artifacts verified, manual checklist confirmed, phase marked complete in STATE.md.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/05-taste-profile-and-polish/05-01-taste-profile-structure-PLAN.md
@.planning/phases/05-taste-profile-and-polish/05-02-counter-sycophancy-prompt-PLAN.md
@.planning/phases/05-taste-profile-and-polish/05-03-settings-reset-confirm-PLAN.md
@.planning/phases/05-taste-profile-and-polish/05-04-edge-aligned-placement-PLAN.md
@.planning/phases/05-taste-profile-and-polish/05-05-companion-render-nodes-PLAN.md
@.planning/phases/05-taste-profile-and-polish/05-UI-SPEC.md
@.planning/phases/05-taste-profile-and-polish/05-VALIDATION.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Automated phase-gate validation (build + typecheck + full test suite)</name>
  <files>(none — read-only verification of existing files)</files>
  <read_first>
    - package.json (to confirm exact script names for build)
    - .planning/phases/05-taste-profile-and-polish/05-VALIDATION.md (phase gate validation section)
  </read_first>
  <action>
    1. Run the full automated phase-gate sequence in order:

       a. `npx tsc --noEmit` — TypeScript must pass with 0 errors
       b. `npx jest` (full suite, no --bail) — all tests must pass
       c. `npm run build` — esbuild bundle must succeed
       d. `ls main.js` — confirm build artifact exists at the plugin root (esbuild output)

    2. Verify presence of Phase 5 artifacts by grep:

       a. `grep -n "style:" src/taste/taste-profile.ts` — Plan 01 applied
       b. `grep -n "## Intellectual Honesty" src/ai/prompt-builder.ts` — Plan 02 applied
       c. `grep -n "ResetTasteProfileConfirmModal" src/settings.ts` — Plan 03 applied
       d. `grep -n "computeEdgeAlignedPlacements" src/spatial/placement.ts` — Plan 04 applied
       e. `grep -n "createCompanionForCode" src/main.ts` — Plan 05 applied
       f. `grep -n ".canvas-ai-companion--html" styles.css` — Plan 05 CSS applied

    3. Verify nothing was accidentally left behind:

       a. `grep -rn "computeOrbitalPlacements" src/ tests/` — must return 0 matches
       b. `grep -cn "allow-same-origin" src/` — must return 0 (security invariant across all source files)
       c. `grep -rn "fields\.tone\b\|fields\.depth\b\|fields\.visual_preference\b\|fields\.thinking_style\b" src/` — must return 0 matches (no flat-field access remains in source)

    4. If any step fails, STOP and report the failure. Do NOT proceed to Task 2 (manual verification) until automated gates are green.

    5. If all checks pass, record the outcome in the task summary with the exact command outputs (test count, bundle size if available).
  </action>
  <verify>
    <automated>npx tsc --noEmit && npx jest && npm run build</automated>
  </verify>
  <acceptance_criteria>
    - `npx tsc --noEmit` exits 0
    - `npx jest` exits 0 (full suite, no --bail)
    - `npm run build` exits 0
    - `ls main.js` exits 0
    - `grep -n "style:" src/taste/taste-profile.ts` returns a match (inside DEFAULT_TASTE_PROFILE)
    - `grep -n "## Intellectual Honesty" src/ai/prompt-builder.ts` returns a match
    - `grep -n "ResetTasteProfileConfirmModal" src/settings.ts` returns a match
    - `grep -n "computeEdgeAlignedPlacements" src/spatial/placement.ts` returns a match
    - `grep -n "createCompanionForCode" src/main.ts` returns a match
    - `grep -n ".canvas-ai-companion--html" styles.css` returns a match
    - `grep -rn "computeOrbitalPlacements" src/ tests/` returns 0 matches
    - `grep -rn "allow-same-origin" src/` returns 0 matches
  </acceptance_criteria>
  <done>
    All automated phase gates green: TypeScript clean, jest full suite green, build produces main.js, all Phase 5 artifacts present, no regressions or security issues.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Human verification in live Obsidian — full Phase 5 manual checklist</name>
  <files>(live Obsidian runtime — no files modified by this task)</files>
  <read_first>
    - .planning/phases/05-taste-profile-and-polish/05-UI-SPEC.md (full UI contract — Group A/D verify against this)
    - .planning/phases/05-taste-profile-and-polish/05-CONTEXT.md (D-04/D-05/D-06 counter-sycophancy behaviors — Group B verify against these)
    - .planning/phases/05-taste-profile-and-polish/05-VALIDATION.md (Manual-Only Verifications section)
  </read_first>
  <what-built>
    Phase 5 delivers:
    1. Nested style/substance taste profile with backward-compatible flat-format parsing (Plan 01)
    2. Hardcoded counter-sycophancy instructions in the system prompt (Plan 02)
    3. Confirmation modal on taste profile reset (Plan 03)
    4. Right-edge-aligned placement replacing orbital (Plan 04)
    5. Companion render nodes for HTML/CSS/JS, Mermaid, and SVG code output (Plan 05)

    All features require runtime verification because they depend on the live Obsidian canvas + Claude API + Runware API + DOM rendering that unit tests cannot exercise end-to-end.
  </what-built>
  <action>
    **Setup (one-time):**
    1. In the plugin project root, run `npm run build` (already verified green in Task 1).
    2. Copy or symlink `main.js`, `manifest.json`, `styles.css` into an Obsidian vault's `.obsidian/plugins/canvas-ai/` directory (or use the local dev setup you normally use).
    3. Reload Obsidian (Cmd+R / Ctrl+R with developer tools open).
    4. Enable the Canvas AI plugin in Settings > Community plugins.
    5. Confirm your Claude API key + Runware API key are still set.

    **Verification checklist (check each item; report any failures):**

    **Group A — Taste profile (Plan 01, Plan 03)**
    - A1. Open Settings > Canvas AI. Scroll to "Taste Profile" section.
    - A2. Click "Edit profile". A new editor tab opens showing the taste profile markdown file.
    - A3. The profile file now uses the nested format: `style:` group with tone/voice/formatting, `substance:` group with depth/domains/thinking_approach, and optional `## Style Philosophy` / `## Substance Philosophy` body sections.
    - A4. (Legacy compat spot-check) In a scratch vault file, manually write a taste profile with the OLD flat format (tone/depth/visual_preference/thinking_style). Point tasteProfilePath at it temporarily. Reload the plugin. The profile should parse and appear in generated content (not crash the plugin).
    - A5. Back in Settings > Canvas AI, click "Reset to default". A confirmation modal appears with:
        - Title: "Reset taste profile"
        - Body: "This will replace your current taste profile with the default. Your existing preferences will be lost. Continue?"
        - Two buttons: "Keep my profile" (left) and "Reset" (right, red/warning style)
    - A6. Click "Keep my profile". Modal closes. The taste profile file is unchanged.
    - A7. Click "Reset to default" again, then click "Reset". Modal closes. A Notice appears ("Taste profile reset to default."). Re-open the taste profile file and verify it now contains the default nested content with Swiss rational text.

    **Group B — Counter-sycophancy qualitative feel (Plan 02)**
    - B1. Open a canvas. Create a text node with a strongly opinionated statement like "Skeuomorphism is the future of UI design".
    - B2. Click outside the node, wait for the debounce, and let the AI generate.
    - B3. Repeat 5-10 times with different opinionated prompts across multiple runs. At least 1-2 of the generations should include one of: devil's-advocate pushback, an unexpected cross-domain connection, an uncomfortable question, OR a contrarian reference. It should NOT feel hostile or argumentative on every response — the timing should be occasional.
    - B4. Spot-check one generated text node for any explicit "playing devil's advocate" or "let me push back" narration — there should be NONE (per instructions, Claude disagrees naturally without flagging the technique).

    **Group C — Edge-aligned placement (Plan 04)**
    - C1. On a clean canvas, create a single text node at roughly the center. Wait for the AI to trigger.
    - C2. Observe the first generated node: it appears to the RIGHT of the trigger node, top-aligned with the trigger's top edge, with approximately a 40px gap.
    - C3. If multiple types are generated in the same response (text + code, or text + mermaid, etc.), the second/third nodes stack vertically along the SAME x-coordinate, each about 40px below the previous.
    - C4. Now block the right side: manually create several text nodes in a column to the right of the trigger node. Trigger another generation. The new generated nodes should either slide down past the wall OR fall back to below/left/above (per D-11 clockwise fallback) — not overlap the obstacles and not appear at arbitrary angles.

    **Group D — Companion render nodes (Plan 05)**
    - D1. On a canvas, create a text node that strongly suggests HTML output, e.g., "A login form with two inputs and a submit button". Trigger generation.
    - D2. If Claude emits a code node with lang=html: a companion node appears 24px to the right of the code node, top-aligned, mirroring the code node's dimensions. The companion renders an INTERACTIVE iframe — clicking inputs should focus them, button clicks should work.
    - D3. On a canvas, create a text node like "A flowchart showing data flow from user input to database to response". Trigger generation.
    - D4. If Claude emits a mermaid node: a companion node appears to its right, containing the mermaid diagram rendered via Obsidian's built-in renderer (NOT raw text).
    - D5. On a canvas, create a text node like "A simple SVG icon of a gear". Trigger generation.
    - D6. If Claude emits a code node with lang=svg: a companion node appears to its right rendering the SVG inline.
    - D7. Click the companion node and verify it does NOT trigger a new AI generation (it is tracked in aiNodeIds).
    - D8. Reload the canvas file (close + reopen). HTML companions may revert to raw source (expected per RESEARCH.md Open Question 1 — re-injection is future work); Mermaid and SVG companions should still render because they are text content.

    **Group E — Regression sweep**
    - E1. All Phase 1-4 behavior still works: status bar indicator updates, token budget displays, AI nodes are color-tinted, pulse animation during streaming, debounce still respects the configured delay.
    - E2. Open Obsidian devtools console. Verify no red errors during normal use (warnings are acceptable).

    **Report format:**
    Paste this checklist back with each item marked [x] (pass), [ ] (not tested), or [FAIL: reason]. If Groups A, C, D all pass and at least one observation in Group B shows counter-sycophancy behavior, the phase is approved.
  </action>
  <verify>
    <automated>MISSING — this is a human-verification checkpoint. Task 1 provides the automated gate; this task verifies behaviors that require a live Obsidian runtime (settings modal UX, iframe DOM rendering, counter-sycophancy qualitative feel, edge-aligned visual layout). See 05-VALIDATION.md Manual-Only Verifications table.</automated>
  </verify>
  <acceptance_criteria>
    - All Group A items (A1-A7) pass or are explicitly marked [FAIL: reason] by the human verifier
    - At least 1 of B1-B4 demonstrates counter-sycophancy behavior across 5-10 generations
    - All Group C items (C1-C4) pass
    - All Group D items (D1-D8) pass — allowing D8 HTML companion persistence caveat
    - All Group E regression items (E1-E2) pass
    - Verifier responds with "approved" OR a structured failure report
  </acceptance_criteria>
  <done>
    Human verifier has walked through the full checklist in a live Obsidian instance, and has typed "approved" OR reported specific failures for follow-up. Phase 5 is ready to close.
  </done>
  <resume-signal>Type "approved" if all critical checks pass (A, C, D fully green; B shows at least one counter-sycophancy behavior across 5-10 generations; E regression clean). Otherwise describe the failures and which group/item they belong to.</resume-signal>
</task>

</tasks>

<verification>
- Task 1 automated gates all green
- Task 2 human checklist confirms runtime behavior matches plan intent
- No regressions from Phase 1-4
- Phase 5 is approved for commit to STATE.md as complete
</verification>

<success_criteria>
- `npm run build` produces a clean bundle
- Full jest suite green
- TypeScript clean
- Human verification confirms: settings UI TAST-05 behavior, counter-sycophancy TAST-07 qualitative behavior, edge-aligned placement visual, companion nodes rendering for all three types
- Regression sweep clean
</success_criteria>

<output>
After completion, create `.planning/phases/05-taste-profile-and-polish/05-06-SUMMARY.md` with the full manual checklist results pasted in.
</output>
