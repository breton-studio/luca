---
phase: 05-taste-profile-and-polish
plan: 02
type: execute
wave: 2
depends_on:
  - 05-01
files_modified:
  - src/ai/prompt-builder.ts
  - tests/ai/prompt-builder.test.ts
autonomous: true
requirements:
  - TAST-07
must_haves:
  truths:
    - "GENERATION_INSTRUCTIONS contains a dedicated Intellectual Honesty / counter-sycophancy section"
    - "The counter-sycophancy block names all four behaviors: devil's advocate, unexpected connections, uncomfortable questions, contrarian references"
    - "The block uses permissive timing language ('when appropriate', 'occasionally', 'use your judgment') — not imperative"
    - "The block is emitted inside block[0] of buildSystemPrompt output so it benefits from prompt caching (GENP-08)"
  artifacts:
    - path: src/ai/prompt-builder.ts
      provides: "Counter-sycophancy instructions appended to GENERATION_INSTRUCTIONS"
      contains: "## Intellectual Honesty"
    - path: tests/ai/prompt-builder.test.ts
      provides: "Tests asserting presence and wording of counter-sycophancy block"
      contains: "Intellectual Honesty"
  key_links:
    - from: "src/ai/prompt-builder.ts::GENERATION_INSTRUCTIONS"
      to: "src/ai/prompt-builder.ts::buildSystemPrompt"
      via: "String concatenation into block[0].text with cache_control ephemeral"
      pattern: "GENERATION_INSTRUCTIONS.*Taste Profile"
---

<objective>
Add hardcoded counter-sycophancy instructions to the Claude system prompt (TAST-07, D-04, D-05, D-06).

Per D-04: hardcoded, NOT user-configurable. Per D-05: four specific behaviors. Per D-06: probabilistic — use permissive timing language so Claude pushes back occasionally, not every turn.

Purpose: Prevent the taste profile from flattening into sycophancy — the AI should feel like a sharp thinking partner who respects the user enough to disagree when it matters.
Output: Updated `src/ai/prompt-builder.ts` with a new "## Intellectual Honesty" section appended to GENERATION_INSTRUCTIONS; updated `tests/ai/prompt-builder.test.ts` asserting the block's presence, the four behaviors, and the permissive timing language.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/REQUIREMENTS.md
@.planning/phases/05-taste-profile-and-polish/05-CONTEXT.md
@.planning/phases/05-taste-profile-and-polish/05-RESEARCH.md

@src/ai/prompt-builder.ts
@tests/ai/prompt-builder.test.ts

<interfaces>
From src/ai/prompt-builder.ts (current):
```typescript
export const GENERATION_INSTRUCTIONS: string; // ~60 lines of static instructions

export type SystemPromptBlock = {
  type: 'text';
  text: string;
  cache_control?: { type: 'ephemeral' };
};

export function buildSystemPrompt(
  tasteContent: string,
  spatialNarrative: string
): SystemPromptBlock[];

export function buildUserMessage(): string;
```

buildSystemPrompt composes blocks[0].text as:
`${GENERATION_INSTRUCTIONS}\n\n## Taste Profile\n${tasteContent}`

So appending to GENERATION_INSTRUCTIONS automatically places the counter-sycophancy block BEFORE the taste profile injection, which is the correct order: instructions > caveat > personal style.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Append Intellectual Honesty section to GENERATION_INSTRUCTIONS with four behaviors</name>
  <files>src/ai/prompt-builder.ts, tests/ai/prompt-builder.test.ts</files>
  <read_first>
    - src/ai/prompt-builder.ts (current GENERATION_INSTRUCTIONS constant — lines 15-65)
    - tests/ai/prompt-builder.test.ts (current test structure — lines 1-79)
    - .planning/phases/05-taste-profile-and-polish/05-RESEARCH.md (Counter-Sycophancy System Prompt Block, lines 190-217)
    - .planning/phases/05-taste-profile-and-polish/05-CONTEXT.md (D-04, D-05, D-06)
  </read_first>
  <behavior>
    Tests to write BEFORE implementation:
    - GENERATION_INSTRUCTIONS contains '## Intellectual Honesty' header
    - GENERATION_INSTRUCTIONS contains 'Devil\'s advocate' as a bolded bullet label
    - GENERATION_INSTRUCTIONS contains 'Unexpected connections' as a bolded bullet label
    - GENERATION_INSTRUCTIONS contains 'Uncomfortable questions' as a bolded bullet label
    - GENERATION_INSTRUCTIONS contains 'Contrarian references' as a bolded bullet label
    - GENERATION_INSTRUCTIONS contains permissive timing phrase 'use your judgment' (D-06)
    - GENERATION_INSTRUCTIONS contains 'not a yes-machine' phrase (thematic framing)
    - GENERATION_INSTRUCTIONS does NOT contain imperative phrases 'always challenge' or 'never agree' (Pitfall 2 — hostile AI)
    - GENERATION_INSTRUCTIONS does NOT contain 'playing devil\'s advocate' (Claude should not flag the technique to the user)
    - buildSystemPrompt output: blocks[0].text contains '## Intellectual Honesty' (confirms the new section is inside the cached block, not appended elsewhere)
    - buildSystemPrompt: blocks[0].cache_control is still { type: 'ephemeral' } (caching preserved — GENP-08 regression guard)
  </behavior>
  <action>
    1. In src/ai/prompt-builder.ts, append exactly this block to the end of the GENERATION_INSTRUCTIONS template literal (after the existing "## Spatial Awareness" section). The block MUST preserve the exact header text and the four bullet labels:

    ```
    ## Intellectual Honesty

    You are not a yes-machine. While you respect the user's taste profile, you must occasionally challenge their thinking. Use your judgment on timing -- not every response, but regularly enough that your contributions feel genuinely independent.

    When appropriate, deploy these strategies:
    - **Devil's advocate:** Argue against the user's apparent direction. If they are converging on a solution, present the strongest case for an alternative.
    - **Unexpected connections:** Draw surprising analogies from unrelated domains. Connect their work to ideas they would not expect.
    - **Uncomfortable questions:** Surface assumptions the user may be avoiding. Ask what they have not considered.
    - **Contrarian references:** Cite thinkers, works, or precedents that disagree with the user's apparent philosophy. Not to dismiss, but to sharpen.

    These are NOT random provocations. They should feel like a sharp thinking partner who respects you enough to disagree. Never flag these as "playing devil's advocate" -- just do it naturally as part of extending their thinking.
    ```

    Concrete placement: the GENERATION_INSTRUCTIONS template literal currently ends with "- Do not merely summarize -- add new perspectives, connections, or challenges" on line 65 followed by a backtick. Insert a blank line and then the new section BEFORE the closing backtick. Do not add any trailing whitespace.

    2. DO NOT change `buildSystemPrompt`, `buildUserMessage`, `SystemPromptBlock`, or any other export. The new content flows through buildSystemPrompt automatically via the existing string concatenation at line 87 (`${GENERATION_INSTRUCTIONS}\n\n## Taste Profile\n${tasteContent}`).

    3. ADD a new describe block at the end of tests/ai/prompt-builder.test.ts (after the existing `describe('GENERATION_INSTRUCTIONS', ...)` and before the final closing brace of the top-level describe):

    ```typescript
    describe('Counter-Sycophancy (TAST-07, D-04, D-05, D-06)', () => {
      test('GENERATION_INSTRUCTIONS contains ## Intellectual Honesty section', () => {
        expect(GENERATION_INSTRUCTIONS).toContain('## Intellectual Honesty');
      });

      test('GENERATION_INSTRUCTIONS contains not a yes-machine framing', () => {
        expect(GENERATION_INSTRUCTIONS).toContain('not a yes-machine');
      });

      test('GENERATION_INSTRUCTIONS names all four behaviors (D-05)', () => {
        expect(GENERATION_INSTRUCTIONS).toContain("**Devil's advocate:**");
        expect(GENERATION_INSTRUCTIONS).toContain('**Unexpected connections:**');
        expect(GENERATION_INSTRUCTIONS).toContain('**Uncomfortable questions:**');
        expect(GENERATION_INSTRUCTIONS).toContain('**Contrarian references:**');
      });

      test('uses permissive timing language (D-06 probabilistic)', () => {
        expect(GENERATION_INSTRUCTIONS).toContain('use your judgment');
        expect(GENERATION_INSTRUCTIONS.toLowerCase()).toContain('occasionally');
      });

      test('does NOT use imperative hostile phrasing (Pitfall 2)', () => {
        expect(GENERATION_INSTRUCTIONS).not.toContain('always challenge');
        expect(GENERATION_INSTRUCTIONS).not.toContain('never agree');
      });

      test('tells Claude not to flag the technique (no meta narration)', () => {
        expect(GENERATION_INSTRUCTIONS).toContain('Never flag these');
      });

      test('counter-sycophancy lives inside the cached system prompt block (GENP-08)', () => {
        const blocks = buildSystemPrompt('Tone: Restrained', 'spatial narrative');
        expect(blocks[0].text).toContain('## Intellectual Honesty');
        expect(blocks[0].cache_control).toEqual({ type: 'ephemeral' });
      });
    });
    ```

    4. Run `npx jest tests/ai/prompt-builder.test.ts --bail`. Expect PASS.

    5. Run `npx jest --bail` (full suite). Expect PASS — no other suite should be affected.

    6. Run `npx tsc --noEmit`. Expect 0 errors.
  </action>
  <verify>
    <automated>npx jest tests/ai/prompt-builder.test.ts --bail && npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n '## Intellectual Honesty' src/ai/prompt-builder.ts` returns exactly 1 match
    - `grep -n "not a yes-machine" src/ai/prompt-builder.ts` returns exactly 1 match
    - `grep -n "Devil's advocate" src/ai/prompt-builder.ts` returns exactly 1 match
    - `grep -n "Unexpected connections" src/ai/prompt-builder.ts` returns exactly 1 match
    - `grep -n "Uncomfortable questions" src/ai/prompt-builder.ts` returns exactly 1 match
    - `grep -n "Contrarian references" src/ai/prompt-builder.ts` returns exactly 1 match
    - `grep -n "use your judgment" src/ai/prompt-builder.ts` returns exactly 1 match
    - `grep -cn "always challenge\|never agree" src/ai/prompt-builder.ts` returns 0
    - `grep -n "Counter-Sycophancy" tests/ai/prompt-builder.test.ts` returns at least 1 match
    - `grep -n "## Intellectual Honesty" tests/ai/prompt-builder.test.ts` returns at least 1 match
    - `npx jest tests/ai/prompt-builder.test.ts --bail` exits 0
    - `npx jest --bail` exits 0
    - `npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>
    Counter-sycophancy block is present in GENERATION_INSTRUCTIONS, flows through buildSystemPrompt block[0] with cache control intact, and is covered by tests asserting presence of all four D-05 behaviors, permissive timing, and absence of hostile phrasing.
  </done>
</task>

</tasks>

<verification>
- `npx jest tests/ai/prompt-builder.test.ts` green
- `npx jest` full suite green
- `npx tsc --noEmit` clean
- grep verification: all four D-05 behaviors present by exact label; no imperative phrasing
- buildSystemPrompt block[0] still has cache_control: { type: 'ephemeral' }
</verification>

<success_criteria>
- All four D-05 behaviors explicitly named in GENERATION_INSTRUCTIONS
- D-06 probabilistic timing language present ('use your judgment', 'occasionally')
- D-04 hardcoded (no new settings field, no runtime flag)
- GENP-08 caching preserved
- Tests verify presence + absence of hostile phrasing
</success_criteria>

<output>
After completion, create `.planning/phases/05-taste-profile-and-polish/05-02-SUMMARY.md` per template.
</output>
