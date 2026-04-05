---
phase: 05-taste-profile-and-polish
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/taste/taste-profile.ts
  - tests/taste/taste-profile.test.ts
autonomous: true
requirements:
  - TAST-04
  - TAST-06
must_haves:
  truths:
    - "Taste profile frontmatter parses into nested style/substance groups"
    - "Legacy flat format (tone, depth, visual_preference, thinking_style) parses into the same nested output without data loss"
    - "formatTasteForPrompt emits '### Style (how to communicate)' and '### Substance (what to communicate)' sections"
    - "Freeform body content under '## Style Philosophy' and '## Substance Philosophy' headers is captured and rendered into the prompt"
    - "DEFAULT_TASTE_PROFILE uses the new nested structure and preserves the existing Swiss rational content"
  artifacts:
    - path: src/taste/taste-profile.ts
      provides: "Nested TasteProfile interface, nested+legacy parser, new formatTasteForPrompt"
      contains: "interface TasteStyleFields"
    - path: src/taste/taste-profile.ts
      provides: "DEFAULT_TASTE_PROFILE in nested format"
      contains: "style:"
    - path: tests/taste/taste-profile.test.ts
      provides: "Test coverage for nested parsing, legacy migration, style/substance formatting"
      contains: "describe('parseTasteProfileFrontmatter', nested format)"
  key_links:
    - from: "src/taste/taste-profile.ts::parseTasteProfileFrontmatter"
      to: "src/taste/taste-profile.ts::migrateFlatToNested"
      via: "Detection of flat keys (tone/depth/visual_preference/thinking_style) at top level"
      pattern: "migrateFlatToNested"
    - from: "src/taste/taste-profile.ts::parseTasteProfileFrontmatter"
      to: "body stylePhilosophy/substancePhilosophy extraction"
      via: "Markdown header splitter (## Style Philosophy, ## Substance Philosophy)"
      pattern: "## Style Philosophy|## Substance Philosophy"
---

<objective>
Evolve the taste profile module to support structured style/substance separation (TAST-06, D-01/D-02/D-03) while preserving full backward compatibility with the existing flat-format profiles currently in use.

This plan rewrites the `TasteProfile` shape, parser, default content, and formatter. It does NOT touch the prompt-builder call site (that happens in Plan 02, same wave file owner: prompt-builder.ts), and it does NOT wire any UI (that is Plan 03).

TAST-04 (per-member profiles) is covered by this plan ONLY as an explicit deferral — D-08 locks single global profile for Phase 5. A code comment documents the deferral in-place so future contributors do not accidentally re-introduce conflicting state.

Purpose: Structural separation of style vs substance allows the system prompt to treat tone/voice/formatting (how) and depth/domains/thinking_approach (what) as independent axes, and allows legacy profiles to migrate without data loss.
Output: Updated `src/taste/taste-profile.ts` with nested interface, dual-format parser, restructured DEFAULT, new formatter output; updated `tests/taste/taste-profile.test.ts` with nested, legacy, and philosophy-body coverage.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/REQUIREMENTS.md
@.planning/phases/05-taste-profile-and-polish/05-CONTEXT.md
@.planning/phases/05-taste-profile-and-polish/05-RESEARCH.md

@src/taste/taste-profile.ts
@tests/taste/taste-profile.test.ts

<interfaces>
<!-- Current (pre-Phase-5) interface being replaced: -->

From src/taste/taste-profile.ts:
```typescript
export interface TasteProfileFields {
  tone: string;
  depth: string;
  visual_preference: string;
  thinking_style: string;
}

export interface TasteProfile {
  fields: TasteProfileFields;
  body: string;
  raw: string;
}

export function parseTasteProfileFrontmatter(content: string): TasteProfile;
export function formatTasteForPrompt(profile: TasteProfile): string;
export async function readTasteProfile(adapter, path): Promise<TasteProfile>;
export async function seedTasteProfile(adapter, path): Promise<void>;
export const DEFAULT_TASTE_PROFILE: string;
```

Consumers of TasteProfile (must continue to compile or be migrated by this plan):
- src/main.ts (readTasteProfile, formatTasteForPrompt, seedTasteProfile, DEFAULT_TASTE_PROFILE) — call sites use only the string output of formatTasteForPrompt and do not destructure .fields
- src/ai/prompt-builder.ts — does NOT import from taste-profile.ts (receives string only). No change needed in Plan 01.

Legacy mapping (D-03):
- flat.tone              -> nested.style.tone
- flat.depth             -> nested.substance.depth
- flat.visual_preference -> nested.style.formatting
- flat.thinking_style    -> nested.substance.thinking_approach
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Replace TasteProfile types and parser with nested + legacy-compat implementation</name>
  <files>src/taste/taste-profile.ts, tests/taste/taste-profile.test.ts</files>
  <read_first>
    - src/taste/taste-profile.ts (current flat implementation — lines 1-189)
    - tests/taste/taste-profile.test.ts (current test shape — lines 1-145)
    - .planning/phases/05-taste-profile-and-polish/05-RESEARCH.md (Parser Approach for Nested YAML, lines 120-189; Nested YAML Frontmatter Parsing code example, lines 394-440)
    - .planning/phases/05-taste-profile-and-polish/05-CONTEXT.md (decisions D-01, D-02, D-03, D-08)
  </read_first>
  <behavior>
    Tests to write BEFORE implementation (RED):
    - parseTasteProfileFrontmatter nested input returns fields.style.tone = 'Restrained', fields.style.voice = 'Direct', fields.style.formatting = 'Clean', fields.substance.depth = 'Deep', fields.substance.domains = 'Architecture', fields.substance.thinking_approach = 'Swiss' when given a nested frontmatter block with those values
    - parseTasteProfileFrontmatter legacy input (flat: tone/depth/visual_preference/thinking_style) migrates to nested: legacy.tone -> style.tone, legacy.depth -> substance.depth, legacy.visual_preference -> style.formatting, legacy.thinking_style -> substance.thinking_approach
    - parseTasteProfileFrontmatter returns stylePhilosophy = content after '## Style Philosophy' and substancePhilosophy = content after '## Substance Philosophy' when both headers exist
    - parseTasteProfileFrontmatter returns body = full trimmed body and empty stylePhilosophy/substancePhilosophy when headers are missing
    - parseTasteProfileFrontmatter returns all-empty nested fields and empty body when no frontmatter
    - parseTasteProfileFrontmatter handles the current DEFAULT_TASTE_PROFILE content (nested format) correctly after the default is updated in Task 2
    - Legacy-format test input: the exact existing test fixture from tests/taste/taste-profile.test.ts line 13-20 still maps correctly into nested output
  </behavior>
  <action>
    1. REPLACE the existing `TasteProfileFields` interface and `TasteProfile` interface in src/taste/taste-profile.ts with:

    ```typescript
    export interface TasteStyleFields {
      tone: string;
      voice: string;
      formatting: string;
    }

    export interface TasteSubstanceFields {
      depth: string;
      domains: string;
      thinking_approach: string;
    }

    export interface TasteProfileFields {
      style: TasteStyleFields;
      substance: TasteSubstanceFields;
    }

    export interface TasteProfile {
      fields: TasteProfileFields;
      body: string;
      stylePhilosophy: string;
      substancePhilosophy: string;
      raw: string;
    }
    ```

    2. REPLACE `EMPTY_FIELDS` constant with:

    ```typescript
    const EMPTY_FIELDS: TasteProfileFields = {
      style: { tone: '', voice: '', formatting: '' },
      substance: { depth: '', domains: '', thinking_approach: '' },
    };
    ```

    3. REPLACE `parseTasteProfileFrontmatter` with a nested-aware parser that:
       - Splits content at `---` delimiters (same as current)
       - Iterates lines of the frontmatter block
       - Tracks `currentGroup: 'style' | 'substance' | null`
       - Detects indentation via `line.startsWith('  ') || line.startsWith('\t')`
       - Top-level `style:` or `substance:` with empty value -> sets currentGroup
       - Top-level key in LEGACY_KEYS = ['tone', 'depth', 'visual_preference', 'thinking_style'] triggers legacy migration
       - Indented key with currentGroup assigns to `fields[currentGroup][key]` if the key is a recognized sub-field
       - Body parsing: split trimmed body on `\n## Style Philosophy\n` and `\n## Substance Philosophy\n` markers. Extract content between headers. If neither header present, set `stylePhilosophy = ''`, `substancePhilosophy = ''`, leave `body` as the full trimmed body.

    4. ADD new private helper `migrateFlatToNested(frontmatterBlock: string): TasteProfileFields` that:
       - Parses flat keys via simple colon split (same logic as old parser)
       - Maps: `tone` -> `style.tone`, `depth` -> `substance.depth`, `visual_preference` -> `style.formatting`, `thinking_style` -> `substance.thinking_approach`
       - Leaves `style.voice`, `style.formatting` (unless mapped), `substance.domains`, `substance.thinking_approach` (unless mapped) empty
       - Returns a `TasteProfileFields` object
       - IMPORTANT: `visual_preference` maps into `style.formatting`, NOT `style.voice` — per RESEARCH.md line 184. Document this mapping in a JSDoc comment above `migrateFlatToNested`.

    5. Detection rule (strict, per Pitfall 1 in RESEARCH.md): if ANY of the four legacy keys (`tone`, `depth`, `visual_preference`, `thinking_style`) appears at top-level (no leading whitespace) in the frontmatter, call `migrateFlatToNested` and use its result. Otherwise parse as nested. This prevents the heuristic from being fooled by a user-added `style:` field at top level with a value (instead of empty-value group header).

    6. ADD "TAST-04 DEFERRED" JSDoc comment at the top of the file:

    ```typescript
    /**
     * TAST-04 (per-member profiles) is DEFERRED in Phase 5 per D-08.
     * This module supports a single global profile only. Future phases may
     * add per-member profile switching; if/when that happens, the parser
     * and interface remain unchanged — only the file-path resolution and
     * settings UI would need to branch on the active user identity.
     */
    ```

    7. DO NOT touch `readTasteProfile`, `seedTasteProfile`, `DEFAULT_TASTE_PROFILE` (default is updated in Task 2), or any other exports yet. DO NOT touch `formatTasteForPrompt` yet (Task 3).

    8. UPDATE tests/taste/taste-profile.test.ts to add test cases BEFORE running implementation (RED-GREEN):
       - Add `describe('parseTasteProfileFrontmatter - nested format', ...)` block with the six test cases from <behavior>
       - Add `describe('parseTasteProfileFrontmatter - legacy migration (D-03)', ...)` block asserting the four legacy keys map correctly
       - Add `describe('parseTasteProfileFrontmatter - philosophy body extraction', ...)` block asserting stylePhilosophy/substancePhilosophy extraction
       - KEEP existing test cases that verify no-frontmatter behavior (line 44-52); update them to assert the new empty nested shape `fields.style.tone === '' && fields.substance.depth === ''`
       - REMOVE or REWRITE existing tests that assert flat `fields.tone`, `fields.visual_preference`, `fields.thinking_style` directly — they should now use the nested or legacy-migration form. The flat-format test at line 13-25 should be moved into the legacy-migration describe block and updated to assert `result.fields.style.tone === 'Direct and clear'`, `result.fields.substance.depth === 'Surface level'`, `result.fields.style.formatting === 'Colorful'`, `result.fields.substance.thinking_approach === 'Intuitive'`.

    9. Run `npx jest tests/taste/taste-profile.test.ts --bail` — expect failures initially (RED), then implement parser changes until all tests pass (GREEN).
  </action>
  <verify>
    <automated>npx jest tests/taste/taste-profile.test.ts --bail</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n 'export interface TasteStyleFields' src/taste/taste-profile.ts` returns a match
    - `grep -n 'export interface TasteSubstanceFields' src/taste/taste-profile.ts` returns a match
    - `grep -n 'stylePhilosophy: string' src/taste/taste-profile.ts` returns a match
    - `grep -n 'substancePhilosophy: string' src/taste/taste-profile.ts` returns a match
    - `grep -n 'migrateFlatToNested' src/taste/taste-profile.ts` returns at least 2 matches (function def + call site)
    - `grep -n "TAST-04" src/taste/taste-profile.ts` returns the deferral comment
    - `grep -n "describe('parseTasteProfileFrontmatter - nested format'" tests/taste/taste-profile.test.ts` returns a match
    - `grep -n "describe('parseTasteProfileFrontmatter - legacy migration" tests/taste/taste-profile.test.ts` returns a match
    - `grep -n "stylePhilosophy" tests/taste/taste-profile.test.ts` returns at least 1 match
    - `npx jest tests/taste/taste-profile.test.ts --bail` exits 0
    - `grep -cE 'result\.fields\.(tone|depth|visual_preference|thinking_style)' tests/taste/taste-profile.test.ts` returns 0 (no direct flat-field assertions remain outside legacy-migration describe block) OR only appears inside strings passed as frontmatter input (not as assertion targets)
  </acceptance_criteria>
  <done>
    Nested interface, nested+legacy parser, and philosophy-body extraction land with passing tests. Legacy format continues to parse into the new nested shape without data loss. No consumer call site is broken (main.ts imports continue to resolve because `TasteProfile` name and `readTasteProfile`/`seedTasteProfile` signatures are unchanged).
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Migrate DEFAULT_TASTE_PROFILE to nested format preserving Swiss rational content</name>
  <files>src/taste/taste-profile.ts, tests/taste/taste-profile.test.ts</files>
  <read_first>
    - src/taste/taste-profile.ts (current DEFAULT_TASTE_PROFILE lines 33-46)
    - .planning/phases/05-taste-profile-and-polish/05-CONTEXT.md (specifics section — "user's existing taste profile is deeply specific (Swiss rational tradition, grotesque typefaces, monochromatic)")
    - .planning/phases/05-taste-profile-and-polish/05-RESEARCH.md (New format example, lines 99-116)
  </read_first>
  <behavior>
    Tests to write BEFORE implementation:
    - DEFAULT_TASTE_PROFILE top matter contains `style:` and `substance:` group headers (not the legacy flat keys)
    - DEFAULT_TASTE_PROFILE parses via parseTasteProfileFrontmatter into non-empty style.tone, style.voice, style.formatting, substance.depth, substance.domains, substance.thinking_approach
    - DEFAULT_TASTE_PROFILE body still contains 'restraint' (preservation of original Swiss rational content)
    - DEFAULT_TASTE_PROFILE body contains both '## Style Philosophy' and '## Substance Philosophy' headers
    - readTasteProfile returns a profile where fields.style.tone contains 'Restrained' (migration preserves the key trait from the original flat default)
  </behavior>
  <action>
    1. REPLACE `DEFAULT_TASTE_PROFILE` constant in src/taste/taste-profile.ts with this exact content (nested format preserving the Swiss rational voice):

    ```typescript
    export const DEFAULT_TASTE_PROFILE = `---
    style:
      tone: Restrained, considered, unhurried. Direct without being blunt.
      voice: Measured and declarative. Reasoning made visible, not hidden behind assertions.
      formatting: Monochromatic default. Clean, minimal markup. Color used surgically -- single accent, low saturation. No trends, no named movements.
    substance:
      depth: Deep structural analysis. First-principles thinking. Justify in terms of spatial relationships and logic.
      domains: Architecture, design systems, typography, spatial reasoning, structural design.
      thinking_approach: Swiss rational tradition. Systematic thinking over intuition. Soft mathematical ratios over rigid alignment. Space as primary material.
    ---

    ## Style Philosophy

    We believe design begins with restraint. Every element must earn its place through structural necessity, not decoration. Space is not empty -- it is the primary material that gives form its meaning.

    Typography serves structure: grotesque typefaces at considered scales, never decorative. Color is used surgically -- a single accent at low saturation, as if mixed with concrete. The palette is monochromatic by default; color arrives only when it carries specific meaning.

    ## Substance Philosophy

    We think in systems, not artifacts. A grid is not a cage but a foundation for rational relationships. Proportions follow soft mathematical ratios rather than rigid geometric alignment. The work should feel inevitable -- as if no other solution were possible.

    Timelessness over novelty. If a solution would have worked in 1957 and will work in 2057, it is likely correct. We do not chase movements or name our approach. The work speaks through its structural soundness and considered restraint.`;
    ```

    2. UPDATE the existing DEFAULT_TASTE_PROFILE tests in tests/taste/taste-profile.test.ts (currently lines 55-66):
       - Replace the assertions that check `toContain('tone:')`, `toContain('depth:')`, `toContain('visual_preference:')`, `toContain('thinking_style:')` with:
         - `expect(DEFAULT_TASTE_PROFILE).toContain('style:')`
         - `expect(DEFAULT_TASTE_PROFILE).toContain('substance:')`
         - `expect(DEFAULT_TASTE_PROFILE).toContain('tone:')` (still present, now indented)
         - `expect(DEFAULT_TASTE_PROFILE).toContain('voice:')`
         - `expect(DEFAULT_TASTE_PROFILE).toContain('formatting:')`
         - `expect(DEFAULT_TASTE_PROFILE).toContain('domains:')`
         - `expect(DEFAULT_TASTE_PROFILE).toContain('thinking_approach:')`
       - Keep the `toContain('restraint')` assertion — the body preservation check
       - ADD `expect(DEFAULT_TASTE_PROFILE).toContain('## Style Philosophy')`
       - ADD `expect(DEFAULT_TASTE_PROFILE).toContain('## Substance Philosophy')`
       - ADD a test that parses DEFAULT_TASTE_PROFILE via parseTasteProfileFrontmatter and asserts all six nested fields are non-empty

    3. UPDATE the `readTasteProfile` existing test at lines 108-117 ("returns parsed DEFAULT_TASTE_PROFILE when file does not exist"):
       - Replace `expect(result.fields.tone).toContain('Restrained')` with `expect(result.fields.style.tone).toContain('Restrained')`
       - Keep `expect(result.body).toContain('restraint')` — now validates the body still contains the preserved content

    4. Run `npx jest tests/taste/taste-profile.test.ts --bail`. Expect PASS.
  </action>
  <verify>
    <automated>npx jest tests/taste/taste-profile.test.ts --bail</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n '^style:' src/taste/taste-profile.ts` returns a match inside the DEFAULT_TASTE_PROFILE template literal
    - `grep -n '^substance:' src/taste/taste-profile.ts` returns a match
    - `grep -n '## Style Philosophy' src/taste/taste-profile.ts` returns a match
    - `grep -n '## Substance Philosophy' src/taste/taste-profile.ts` returns a match
    - `grep -n 'restraint' src/taste/taste-profile.ts` returns at least 1 match (body content preserved)
    - `grep -n 'Swiss rational tradition' src/taste/taste-profile.ts` returns a match
    - `grep -n "result.fields.style.tone" tests/taste/taste-profile.test.ts` returns at least 1 match
    - `npx jest tests/taste/taste-profile.test.ts --bail` exits 0
  </acceptance_criteria>
  <done>
    DEFAULT_TASTE_PROFILE is in nested format, preserves all original Swiss rational voice content, round-trips through parseTasteProfileFrontmatter into non-empty nested fields. All existing taste-profile tests pass against the new default.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Update formatTasteForPrompt to emit style/substance sections with philosophy bodies</name>
  <files>src/taste/taste-profile.ts, tests/taste/taste-profile.test.ts</files>
  <read_first>
    - src/taste/taste-profile.ts (current formatTasteForPrompt lines 120-135)
    - .planning/phases/05-taste-profile-and-polish/05-RESEARCH.md (formatTasteForPrompt code example, lines 527-564)
    - .planning/phases/05-taste-profile-and-polish/05-CONTEXT.md (D-01, D-02)
  </read_first>
  <behavior>
    Tests to write BEFORE implementation:
    - formatTasteForPrompt output contains '### Style (how to communicate)' header
    - formatTasteForPrompt output contains '### Substance (what to communicate)' header
    - formatTasteForPrompt output contains 'Tone:', 'Voice:', 'Formatting:' lines under Style section
    - formatTasteForPrompt output contains 'Depth:', 'Domains:', 'Thinking Approach:' lines under Substance section
    - formatTasteForPrompt includes stylePhilosophy content under Style section when present
    - formatTasteForPrompt includes substancePhilosophy content under Substance section when present
    - formatTasteForPrompt falls back to combined body when neither stylePhilosophy nor substancePhilosophy set but body is non-empty
    - formatTasteForPrompt omits empty field lines (no "Tone: " line when tone is empty string)
  </behavior>
  <action>
    1. REPLACE `formatTasteForPrompt` in src/taste/taste-profile.ts with exactly this implementation:

    ```typescript
    /**
     * Format a parsed taste profile for injection into Claude's system prompt.
     *
     * Emits two labeled sections per D-01/D-02:
     *   ### Style (how to communicate)
     *   Tone/Voice/Formatting key-values
     *   [stylePhilosophy body content if present]
     *
     *   ### Substance (what to communicate)
     *   Depth/Domains/Thinking Approach key-values
     *   [substancePhilosophy body content if present]
     *
     * If neither stylePhilosophy nor substancePhilosophy is set but body is
     * non-empty, appends body as a combined trailing block for backward compat.
     */
    export function formatTasteForPrompt(profile: TasteProfile): string {
      const { fields, body, stylePhilosophy, substancePhilosophy } = profile;
      const parts: string[] = [];

      // Style section
      parts.push('### Style (how to communicate)');
      if (fields.style.tone) parts.push(`Tone: ${fields.style.tone}`);
      if (fields.style.voice) parts.push(`Voice: ${fields.style.voice}`);
      if (fields.style.formatting) parts.push(`Formatting: ${fields.style.formatting}`);
      if (stylePhilosophy) {
        parts.push('');
        parts.push(stylePhilosophy);
      }

      // Substance section
      parts.push('');
      parts.push('### Substance (what to communicate)');
      if (fields.substance.depth) parts.push(`Depth: ${fields.substance.depth}`);
      if (fields.substance.domains) parts.push(`Domains: ${fields.substance.domains}`);
      if (fields.substance.thinking_approach) parts.push(`Thinking Approach: ${fields.substance.thinking_approach}`);
      if (substancePhilosophy) {
        parts.push('');
        parts.push(substancePhilosophy);
      }

      // Fallback: if neither philosophy section was extracted but body has content,
      // append it as a combined trailing block (covers legacy profiles migrated via D-03).
      if (body && !stylePhilosophy && !substancePhilosophy) {
        parts.push('');
        parts.push(body);
      }

      return parts.join('\n');
    }
    ```

    2. REWRITE the existing `formatTasteForPrompt` test at tests/taste/taste-profile.test.ts lines 68-87 to cover the new structure:
       - Replace the single "returns combined frontmatter fields + body as a single string" test with a `describe('formatTasteForPrompt', ...)` block containing:
         - `test('emits ### Style (how to communicate) header', ...)` — assert `result.includes('### Style (how to communicate)')`
         - `test('emits ### Substance (what to communicate) header', ...)` — assert `result.includes('### Substance (what to communicate)')`
         - `test('emits Tone/Voice/Formatting under Style', ...)` — input profile with style.tone='A', style.voice='B', style.formatting='C'; assert output contains 'Tone: A', 'Voice: B', 'Formatting: C'
         - `test('emits Depth/Domains/Thinking Approach under Substance', ...)` — input profile with substance.depth='X', substance.domains='Y', substance.thinking_approach='Z'; assert output contains 'Depth: X', 'Domains: Y', 'Thinking Approach: Z'
         - `test('includes stylePhilosophy body content when present', ...)` — input profile with stylePhilosophy='Style body text here'; assert output contains 'Style body text here'
         - `test('includes substancePhilosophy body content when present', ...)` — input profile with substancePhilosophy='Substance body text here'; assert output contains 'Substance body text here'
         - `test('falls back to combined body when no philosophy sections', ...)` — input profile with body='Legacy body content' and empty philosophies; assert output contains 'Legacy body content'
         - `test('omits empty field lines', ...)` — input profile with style.tone='' (empty); assert output does NOT contain 'Tone: \n' (empty tone line). Use `expect(result).not.toMatch(/Tone:\s*$/m)`.

    3. Run `npx jest tests/taste/taste-profile.test.ts --bail`. Expect PASS.

    4. ALSO run `npx jest tests/ai/prompt-builder.test.ts --bail` — this may break because prompt-builder.test.ts line 9 uses `mockTasteContent = 'Tone: Restrained\nDepth: Deep structural analysis\n\nWe believe...'` which is a string literal, not a call to formatTasteForPrompt. So it should still pass. Verify.

    5. ALSO run `npx jest --bail` to verify no OTHER test suite broke from the TasteProfile interface change. The only downstream consumer is src/main.ts which passes the string output of formatTasteForPrompt to buildSystemPrompt — type signature is unchanged (still string). If main.ts fails to compile because it uses `profile.fields.tone` directly (it does not, per our grep), fix the specific call site. Based on code review, main.ts at line 266 only uses `formatTasteForPrompt(tasteProfile)` — should compile clean.

    6. Run `npx tsc --noEmit` to confirm no TypeScript errors. If any, fix immediately.
  </action>
  <verify>
    <automated>npx jest tests/taste/taste-profile.test.ts --bail && npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "### Style (how to communicate)" src/taste/taste-profile.ts` returns a match
    - `grep -n "### Substance (what to communicate)" src/taste/taste-profile.ts` returns a match
    - `grep -n "fields.style.tone" src/taste/taste-profile.ts` returns at least 1 match
    - `grep -n "fields.substance.depth" src/taste/taste-profile.ts` returns at least 1 match
    - `grep -n "stylePhilosophy" src/taste/taste-profile.ts` returns at least 2 matches (extracted + rendered)
    - `grep -n "### Style (how to communicate)" tests/taste/taste-profile.test.ts` returns a match
    - `npx jest tests/taste/taste-profile.test.ts --bail` exits 0
    - `npx tsc --noEmit` exits 0
    - `npx jest --bail` exits 0 (full suite — no regression in other modules)
  </acceptance_criteria>
  <done>
    formatTasteForPrompt emits structured style/substance sections with preserved philosophy bodies and backward-compatible body fallback. Full test suite green. TypeScript compiles. No consumer is broken.
  </done>
</task>

</tasks>

<verification>
- `npx jest tests/taste/taste-profile.test.ts` runs all tests green
- `npx jest` full suite runs green (no regression from interface change)
- `npx tsc --noEmit` passes
- `grep -rn "fields.tone\|fields.depth\|fields.visual_preference\|fields.thinking_style" src/` returns no matches (no code still uses the flat shape)
- TAST-04 deferral comment is present in src/taste/taste-profile.ts
</verification>

<success_criteria>
- Nested TasteProfile interface is the canonical shape
- Parser handles both nested and flat (legacy) formats via D-03 migration
- DEFAULT_TASTE_PROFILE is nested and preserves all original Swiss rational content
- formatTasteForPrompt emits labeled style/substance sections
- All taste profile tests green; full jest suite green
- TAST-04 deferral documented in-place
</success_criteria>

<output>
After completion, create `.planning/phases/05-taste-profile-and-polish/05-01-SUMMARY.md` per template.
</output>
