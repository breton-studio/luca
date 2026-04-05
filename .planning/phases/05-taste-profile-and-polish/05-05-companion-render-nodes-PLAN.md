---
phase: 05-taste-profile-and-polish
plan: 05
type: execute
wave: 2
depends_on:
  - 05-04
files_modified:
  - src/canvas/companion-node.ts
  - tests/canvas/companion-node.test.ts
  - src/main.ts
  - styles.css
autonomous: true
requirements:
  - TAST-06
must_haves:
  truths:
    - "detectCompanionContentType correctly identifies HTML, SVG, Mermaid, and none-of-the-above from code content + lang tag"
    - "createHtmlCompanionContent returns the raw HTML content for HTML/CSS/JS code"
    - "injectHtmlPreview creates a sandboxed iframe with sandbox='allow-scripts' and NO allow-same-origin"
    - "After a code node finishes streaming, a companion node is created to the right of the code node (companion-gap = 24px, top-aligned) when content type is detectable"
    - "Companion node is marked via unknownData.companionOf = <code node id> and tracked in aiNodeIds so it does not trigger new generation"
    - "Mermaid code nodes produce a companion text node containing the mermaid fenced block (Obsidian renders it natively)"
    - "SVG code nodes produce a companion text node containing raw SVG markup"
    - "HTML/CSS/JS code nodes produce a companion node with the .canvas-ai-companion--html CSS class on its DOM element, and an iframe with srcdoc"
  artifacts:
    - path: src/canvas/companion-node.ts
      provides: "Pure functions for content detection + HTML preview creation + DOM iframe injection helper"
      contains: "export function detectCompanionContentType"
    - path: tests/canvas/companion-node.test.ts
      provides: "Unit tests for detection + HTML content builder (injection is DOM-dependent, manually verified)"
      contains: "describe('detectCompanionContentType'"
    - path: src/main.ts
      provides: "Companion node creation hook in onNodeBoundary for code type"
      contains: "createCompanionForCode"
    - path: styles.css
      provides: "New CSS classes .canvas-ai-companion--html, .canvas-ai-companion--svg per UI-SPEC"
      contains: "canvas-ai-companion--html"
  key_links:
    - from: "src/main.ts::streamWithRetry onNodeBoundary (code branch)"
      to: "src/canvas/companion-node.ts::detectCompanionContentType + createCompanionForCode helper"
      via: "Called synchronously after code node finalization when meta.type === 'code'"
      pattern: "detectCompanionContentType"
    - from: "createCompanionForCode"
      to: "canvasAdapter.createTextNodeOnCanvas + node.unknownData.companionOf"
      via: "Positions companion to right of code node with companion-gap = 24px, top-aligned"
      pattern: "companionOf"
---

<objective>
Create companion render nodes for code output (D-12, D-13, D-14) so code blocks are paired with live/interactive previews on the canvas.

Per D-12: code nodes get a companion node showing rendered/interactive output, placed adjacent to the code node.
Per D-13: supported content types are HTML/CSS/JS (sandboxed iframe with interactivity), Mermaid (source + diagram via Obsidian's renderer), and SVG (inline markup).
Per D-14: the companion is a separate canvas node created AFTER code streaming completes.

Per UI-SPEC:
- Companion position: x = codeNode.x + codeNode.width + 24px, y = codeNode.y (top-aligned)
- Companion sizing: mirror parent code node dimensions
- Identification: `unknownData.companionOf = codeNodeId`
- CSS classes: `.canvas-ai-companion--html`, `.canvas-ai-companion--mermaid`, `.canvas-ai-companion--svg`
- Security: iframe sandbox = "allow-scripts" ONLY (never allow-same-origin)

Purpose: Make code generation useful without leaving the canvas. Users see both the source AND the rendered result side-by-side, turning the canvas into a live sketchpad.
Output: New `src/canvas/companion-node.ts` module with content-type detection + HTML builder + iframe injection helper; new test file; wiring in main.ts `onNodeBoundary`; new CSS classes in styles.css.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/05-taste-profile-and-polish/05-CONTEXT.md
@.planning/phases/05-taste-profile-and-polish/05-RESEARCH.md
@.planning/phases/05-taste-profile-and-polish/05-UI-SPEC.md

@src/canvas/canvas-adapter.ts
@src/main.ts
@styles.css

<interfaces>
From src/canvas/canvas-adapter.ts (relevant methods for companion creation):
```typescript
createTextNodeOnCanvas(canvas: any, pos: { x: number; y: number; width: number; height: number }, color: string): any;
updateNodeText(node: any, text: string): void;
addNodeCssClass(node: any, className: string): void;
requestCanvasSave(canvas: any): void;
```

From src/main.ts (relevant hooks):
- NODE_SIZES.code = { width: 400, height: 250 }  — line 30
- streamWithRetry onNodeBoundary — line 415
- activeNode holds the canvas node object before it is reset to null at line 443
- this.aiNodeIds: Set<string> — line 49
- this.suppressEvents(fn): T — wraps mutations
- this.adapter: CanvasAdapter

Decision from RESEARCH.md Open Question 1 (lines 583-588):
Store HTML source in the text node's text content as a fenced code block so canvas persistence works (iframe gets re-injected on reload via a post-processor in a future phase). For Phase 5, we inject the iframe directly into the node's DOM on creation; on canvas reload it will show the HTML source in markdown until a re-injection pass is added. This is acceptable for v1 per the Phase 5 scope.

UI-SPEC Companion Node Visual Contract (05-UI-SPEC.md lines 119-155):
- Companion sizing: same width/height as parent code node
- Positioning: x = code.x + code.width + 24, y = code.y
- CSS classes: .canvas-ai-companion--html, .canvas-ai-companion--mermaid, .canvas-ai-companion--svg
- Companion identification: unknownData.companionOf = codeNodeId
- Added to aiNodeIds so it doesn't trigger generation
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create companion-node.ts with detection + HTML preview builder + injection + tests</name>
  <files>src/canvas/companion-node.ts, tests/canvas/companion-node.test.ts</files>
  <read_first>
    - src/canvas/canvas-adapter.ts (patterns for node creation + DOM manipulation — lines 151-330)
    - src/main.ts lines 26-33 (NODE_SIZES) and lines 415-445 (onNodeBoundary callback — integration target)
    - .planning/phases/05-taste-profile-and-polish/05-RESEARCH.md lines 248-324 (Companion Render Node Architecture section)
    - .planning/phases/05-taste-profile-and-polish/05-RESEARCH.md lines 489-524 (Sandboxed HTML Preview code example)
    - .planning/phases/05-taste-profile-and-polish/05-UI-SPEC.md lines 119-155 (Companion Node Visual Contract)
    - .planning/phases/05-taste-profile-and-polish/05-RESEARCH.md lines 370-376 (Pitfall 3 — iframe srcdoc escaping, use DOM property not attribute)
  </read_first>
  <behavior>
    Tests to write BEFORE implementation (RED):

    detectCompanionContentType(content, lang):
    - ('<!DOCTYPE html>...', 'html') returns 'html'
    - ('<html>...</html>', 'htm') returns 'html'
    - ('<div>...</div>', 'html') returns 'html'
    - ('const x = 1', 'javascript') returns null (plain JS without HTML wrapper — no companion)
    - ('graph TD\n  A --> B', 'mermaid') returns 'mermaid'
    - ('graph TD\n  A --> B', '') returns 'mermaid' when content starts with 'graph '
    - ('<svg xmlns="..."><circle/></svg>', 'svg') returns 'svg'
    - ('<svg xmlns="..."><circle/></svg>', '') returns 'svg' when content starts with '<svg'
    - ('def foo():\n  pass', 'python') returns null
    - ('SELECT * FROM users', 'sql') returns null
    - (empty string, 'html') returns null (empty content ignored)
    - (whitespace-only, '') returns null

    createHtmlCompanionContent(content, lang):
    - For 'html' input: wraps bare HTML (no <html> tag) into a minimal document with <!DOCTYPE html><html><head><meta charset="utf-8"></head><body>{content}</body></html>
    - For full HTML documents (already has <!DOCTYPE> or <html>): returns content unchanged
    - Returns null for non-HTML input (never touches mermaid/svg)

    buildMermaidCompanionContent(content):
    - Returns a fenced code block string: '```mermaid\n{content}\n```'
    - Trims trailing whitespace from content but preserves internal newlines
    - Returns empty string for empty input

    buildSvgCompanionContent(content):
    - Returns the raw SVG markup trimmed (Obsidian renders inline SVG natively)
    - Returns empty string for empty input

    computeCompanionPlacement(codeNode, gap=24):
    - Returns { x: codeNode.x + codeNode.width + gap, y: codeNode.y, width: codeNode.width, height: codeNode.height } — mirror sizing per UI-SPEC
  </behavior>
  <action>
    1. CREATE new file `src/canvas/companion-node.ts` with these exports (pure functions, no DOM dependency for testability — the DOM injection is a separate non-tested helper):

    ```typescript
    /**
     * Companion render node helpers (Phase 5, D-12, D-13, D-14).
     *
     * Creates visual companions next to code nodes that render the output:
     *  - HTML/CSS/JS  -> sandboxed iframe with srcdoc + sandbox="allow-scripts"
     *  - Mermaid      -> text node with fenced ```mermaid block (Obsidian's native renderer)
     *  - SVG          -> text node with raw SVG markup (Obsidian's markdown renderer)
     *
     * Pure functions for detection/content building are exported for unit testing.
     * DOM injection (injectHtmlPreview) is separate because it touches the live node DOM
     * and cannot be unit-tested without a headless Obsidian canvas mock.
     */

    /** Canvas node shape (subset) for placement math. */
    export interface CompanionTargetNode {
      x: number;
      y: number;
      width: number;
      height: number;
      id?: string;
    }

    /** Placement for the companion node. Mirrors parent code node dimensions. */
    export interface CompanionPlacement {
      x: number;
      y: number;
      width: number;
      height: number;
    }

    /** Detected content types for companion rendering. */
    export type CompanionContentType = 'html' | 'mermaid' | 'svg' | null;

    /** Companion gap per UI-SPEC (tighter than placement gap for visual pairing). */
    export const COMPANION_GAP = 24;

    /**
     * Detect whether code content should produce a companion render node, and of what type.
     *
     * HTML: lang in ['html', 'htm'] OR content starts with <!DOCTYPE / <html OR contains HTML tag markers with no lang set
     * SVG: lang === 'svg' OR content trimmed starts with <svg
     * Mermaid: lang === 'mermaid' OR content trimmed starts with 'graph ' | 'flowchart ' | 'sequenceDiagram' | 'classDiagram' | 'stateDiagram' | 'erDiagram' | 'gantt' | 'pie'
     * Otherwise: null (no companion)
     */
    export function detectCompanionContentType(
      content: string,
      lang: string | undefined
    ): CompanionContentType {
      const trimmed = (content ?? '').trim();
      if (!trimmed) return null;
      const normalizedLang = (lang ?? '').toLowerCase();

      // SVG: explicit lang OR markup starts with <svg
      if (normalizedLang === 'svg' || trimmed.startsWith('<svg')) {
        return 'svg';
      }

      // Mermaid: explicit lang OR recognizable mermaid diagram opener
      if (normalizedLang === 'mermaid') return 'mermaid';
      const mermaidOpeners = [
        'graph ',
        'flowchart ',
        'sequenceDiagram',
        'classDiagram',
        'stateDiagram',
        'erDiagram',
        'gantt',
        'pie',
        'journey',
        'mindmap',
      ];
      if (mermaidOpeners.some((opener) => trimmed.startsWith(opener))) {
        return 'mermaid';
      }

      // HTML: explicit lang OR DOCTYPE / <html tag
      if (normalizedLang === 'html' || normalizedLang === 'htm') return 'html';
      const lowerStart = trimmed.toLowerCase();
      if (lowerStart.startsWith('<!doctype') || lowerStart.startsWith('<html')) {
        return 'html';
      }
      // Bare HTML fragment detection requires explicit lang tag to avoid false positives
      // (e.g. JSX or XML). We do NOT treat '<div>' or '<p>' as HTML without lang='html'.

      return null;
    }

    /**
     * Wrap bare HTML into a minimal document if needed, so the iframe srcdoc renders correctly.
     * Returns null if content type is not HTML (caller should route to mermaid/svg builders).
     */
    export function createHtmlCompanionContent(
      content: string,
      lang: string | undefined
    ): string | null {
      const type = detectCompanionContentType(content, lang);
      if (type !== 'html') return null;
      const trimmed = content.trim();
      const lower = trimmed.toLowerCase();

      // Already a full HTML document
      if (lower.startsWith('<!doctype') || lower.startsWith('<html')) {
        return trimmed;
      }

      // Bare HTML fragment: wrap in a minimal document
      return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
${trimmed}
</body>
</html>`;
    }

    /** Build mermaid companion content as a fenced code block (Obsidian renders natively). */
    export function buildMermaidCompanionContent(content: string): string {
      const trimmed = (content ?? '').trimEnd();
      if (!trimmed) return '';
      return '```mermaid\n' + trimmed + '\n```';
    }

    /** Build SVG companion content as raw markup (Obsidian renders inline SVG in markdown). */
    export function buildSvgCompanionContent(content: string): string {
      return (content ?? '').trim();
    }

    /** Compute mirror-sized placement to the right of the code node. */
    export function computeCompanionPlacement(
      codeNode: CompanionTargetNode,
      gap: number = COMPANION_GAP
    ): CompanionPlacement {
      return {
        x: codeNode.x + codeNode.width + gap,
        y: codeNode.y,
        width: codeNode.width,
        height: codeNode.height,
      };
    }

    /**
     * Inject a sandboxed iframe into a companion node's DOM element (HTML type only).
     *
     * Security contract (D-13, RESEARCH.md Pitfall 3):
     *  - sandbox = "allow-scripts" ONLY (never allow-same-origin — defeats the sandbox)
     *  - srcdoc set via DOM property, NOT HTML attribute (avoids escaping pitfalls)
     *
     * NOT unit-tested: depends on a live canvas node DOM. Verified manually in Plan 06.
     */
    export function injectHtmlPreview(companionNode: any, htmlContent: string): void {
      const nodeEl = companionNode?.nodeEl;
      if (!nodeEl) return;

      // Find the markdown-rendered container or create one as fallback
      const existing = nodeEl.querySelector('.markdown-rendered');
      const container = existing ?? nodeEl.createDiv({ cls: 'markdown-rendered' });
      container.empty();

      const iframe = document.createElement('iframe');
      iframe.setAttribute('sandbox', 'allow-scripts'); // CRITICAL: no allow-same-origin
      iframe.setAttribute('aria-label', 'Code preview');
      // srcdoc via DOM property — handles escaping internally (Pitfall 3)
      iframe.srcdoc = htmlContent;
      iframe.style.cssText = 'width:100%;height:100%;border:none;background:var(--background-primary);';

      container.appendChild(iframe);
    }
    ```

    2. CREATE new test file `tests/canvas/companion-node.test.ts`:

    ```typescript
    import {
      detectCompanionContentType,
      createHtmlCompanionContent,
      buildMermaidCompanionContent,
      buildSvgCompanionContent,
      computeCompanionPlacement,
      COMPANION_GAP,
    } from '../../src/canvas/companion-node';

    describe('detectCompanionContentType (D-12, D-13)', () => {
      test('detects HTML from DOCTYPE', () => {
        expect(detectCompanionContentType('<!DOCTYPE html><html></html>', undefined)).toBe('html');
      });
      test('detects HTML from <html> opening tag', () => {
        expect(detectCompanionContentType('<html><body></body></html>', undefined)).toBe('html');
      });
      test('detects HTML from explicit lang=html', () => {
        expect(detectCompanionContentType('<div>hello</div>', 'html')).toBe('html');
      });
      test('detects HTML from lang=htm', () => {
        expect(detectCompanionContentType('<div>hello</div>', 'htm')).toBe('html');
      });
      test('does NOT treat plain JS as HTML', () => {
        expect(detectCompanionContentType('const x = 1;', 'javascript')).toBeNull();
      });
      test('does NOT treat Python as HTML', () => {
        expect(detectCompanionContentType('def foo():\n  pass', 'python')).toBeNull();
      });
      test('does NOT treat SQL as HTML', () => {
        expect(detectCompanionContentType('SELECT * FROM users', 'sql')).toBeNull();
      });
      test('detects Mermaid from lang=mermaid', () => {
        expect(detectCompanionContentType('graph TD\n  A --> B', 'mermaid')).toBe('mermaid');
      });
      test('detects Mermaid from graph opener', () => {
        expect(detectCompanionContentType('graph TD\n  A --> B', '')).toBe('mermaid');
      });
      test('detects Mermaid from flowchart opener', () => {
        expect(detectCompanionContentType('flowchart LR\n  A --> B', undefined)).toBe('mermaid');
      });
      test('detects Mermaid from sequenceDiagram opener', () => {
        expect(detectCompanionContentType('sequenceDiagram\n  A->>B: hi', undefined)).toBe('mermaid');
      });
      test('detects SVG from lang=svg', () => {
        expect(detectCompanionContentType('<svg><circle/></svg>', 'svg')).toBe('svg');
      });
      test('detects SVG from <svg opening tag', () => {
        expect(detectCompanionContentType('<svg xmlns="http://www.w3.org/2000/svg"><circle r="10"/></svg>', '')).toBe('svg');
      });
      test('returns null for empty content', () => {
        expect(detectCompanionContentType('', 'html')).toBeNull();
      });
      test('returns null for whitespace-only content', () => {
        expect(detectCompanionContentType('   \n\t  ', '')).toBeNull();
      });
      test('prefers SVG detection over HTML when content starts with <svg even with lang=html', () => {
        // Edge case: if lang says html but content is actually svg, trust the content
        expect(detectCompanionContentType('<svg></svg>', 'html')).toBe('svg');
      });
    });

    describe('createHtmlCompanionContent', () => {
      test('returns full HTML document unchanged', () => {
        const input = '<!DOCTYPE html><html><body>hi</body></html>';
        expect(createHtmlCompanionContent(input, 'html')).toBe(input);
      });
      test('wraps bare HTML fragment in minimal document', () => {
        const result = createHtmlCompanionContent('<div>hi</div>', 'html');
        expect(result).toContain('<!DOCTYPE html>');
        expect(result).toContain('<body>');
        expect(result).toContain('<div>hi</div>');
        expect(result).toContain('</body>');
      });
      test('returns null for non-HTML content', () => {
        expect(createHtmlCompanionContent('const x = 1', 'javascript')).toBeNull();
        expect(createHtmlCompanionContent('graph TD\n  A --> B', 'mermaid')).toBeNull();
      });
      test('returns null for empty content', () => {
        expect(createHtmlCompanionContent('', 'html')).toBeNull();
      });
    });

    describe('buildMermaidCompanionContent', () => {
      test('wraps content in ```mermaid fenced block', () => {
        expect(buildMermaidCompanionContent('graph TD\n  A --> B')).toBe(
          '```mermaid\ngraph TD\n  A --> B\n```'
        );
      });
      test('returns empty string for empty input', () => {
        expect(buildMermaidCompanionContent('')).toBe('');
      });
      test('trims trailing whitespace but preserves internal newlines', () => {
        expect(buildMermaidCompanionContent('graph\n  A\n  \n')).toBe(
          '```mermaid\ngraph\n  A\n```'
        );
      });
    });

    describe('buildSvgCompanionContent', () => {
      test('returns trimmed SVG markup', () => {
        expect(buildSvgCompanionContent('  <svg><circle/></svg>  ')).toBe('<svg><circle/></svg>');
      });
      test('returns empty string for empty input', () => {
        expect(buildSvgCompanionContent('')).toBe('');
      });
    });

    describe('computeCompanionPlacement', () => {
      test('places companion to the right of code node with COMPANION_GAP', () => {
        const codeNode = { x: 100, y: 200, width: 400, height: 250 };
        const result = computeCompanionPlacement(codeNode);
        expect(result).toEqual({
          x: 100 + 400 + COMPANION_GAP,
          y: 200,
          width: 400,
          height: 250,
        });
      });
      test('mirrors sizing exactly', () => {
        const codeNode = { x: 0, y: 0, width: 512, height: 512 };
        const result = computeCompanionPlacement(codeNode);
        expect(result.width).toBe(512);
        expect(result.height).toBe(512);
      });
      test('COMPANION_GAP is 24 per UI-SPEC', () => {
        expect(COMPANION_GAP).toBe(24);
      });
    });
    ```

    3. Run `npx jest tests/canvas/companion-node.test.ts --bail`. Expect RED first, then implement until GREEN.

    4. Run `npx tsc --noEmit` — must be 0 errors.

    5. Run `npx jest --bail` (full suite) — all suites must remain green.
  </action>
  <verify>
    <automated>npx jest tests/canvas/companion-node.test.ts --bail && npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `ls src/canvas/companion-node.ts` exits 0
    - `ls tests/canvas/companion-node.test.ts` exits 0
    - `grep -n "export function detectCompanionContentType" src/canvas/companion-node.ts` returns exactly 1 match
    - `grep -n "export function createHtmlCompanionContent" src/canvas/companion-node.ts` returns exactly 1 match
    - `grep -n "export function buildMermaidCompanionContent" src/canvas/companion-node.ts` returns exactly 1 match
    - `grep -n "export function buildSvgCompanionContent" src/canvas/companion-node.ts` returns exactly 1 match
    - `grep -n "export function computeCompanionPlacement" src/canvas/companion-node.ts` returns exactly 1 match
    - `grep -n "export function injectHtmlPreview" src/canvas/companion-node.ts` returns exactly 1 match
    - `grep -n "export const COMPANION_GAP = 24" src/canvas/companion-node.ts` returns exactly 1 match
    - `grep -n "sandbox.*allow-scripts" src/canvas/companion-node.ts` returns at least 1 match
    - `grep -cn "allow-same-origin" src/canvas/companion-node.ts` returns 0 (security invariant)
    - `grep -n "describe('detectCompanionContentType" tests/canvas/companion-node.test.ts` returns a match
    - `grep -n "describe('createHtmlCompanionContent'" tests/canvas/companion-node.test.ts` returns a match
    - `grep -n "describe('buildMermaidCompanionContent'" tests/canvas/companion-node.test.ts` returns a match
    - `grep -n "describe('buildSvgCompanionContent'" tests/canvas/companion-node.test.ts` returns a match
    - `grep -n "describe('computeCompanionPlacement'" tests/canvas/companion-node.test.ts` returns a match
    - `npx jest tests/canvas/companion-node.test.ts --bail` exits 0
    - `npx tsc --noEmit` exits 0
    - `npx jest --bail` exits 0
  </acceptance_criteria>
  <done>
    companion-node.ts exists with typed detection, HTML wrapping, mermaid/svg builders, placement math, and iframe injection helper. All pure functions covered by tests (injection is DOM-dependent and deferred to manual verification). Security invariant (no allow-same-origin) enforced in source.
  </done>
</task>

<task type="auto">
  <name>Task 2: Wire companion node creation into streamWithRetry onNodeBoundary + add CSS</name>
  <files>src/main.ts, styles.css</files>
  <read_first>
    - src/main.ts lines 1-35 (imports + NODE_SIZES)
    - src/main.ts lines 314-495 (entire streamWithRetry function, especially onNodeBoundary at 415-445)
    - src/main.ts lines 344-366 (createNodeForType helper pattern for reference)
    - styles.css (current CSS classes — grep 'canvas-ai' confirms .canvas-ai-node--streaming and .canvas-ai-node--image-placeholder exist at lines 38, 52)
    - src/canvas/companion-node.ts (the module from Task 1)
    - .planning/phases/05-taste-profile-and-polish/05-UI-SPEC.md lines 229-250 (CSS Additions for Phase 5)
    - .planning/phases/05-taste-profile-and-polish/05-RESEARCH.md lines 372-378 (Pitfall 4 — companion after primary placements to avoid placement conflicts)
    - src/canvas/canvas-adapter.ts lines 151-220 (createTextNodeOnCanvas + updateNodeText + addNodeCssClass)
  </read_first>
  <action>
    1. In src/main.ts, ADD the import at the top near the other canvas imports (around line 11):

    ```typescript
    import {
      detectCompanionContentType,
      createHtmlCompanionContent,
      buildMermaidCompanionContent,
      buildSvgCompanionContent,
      computeCompanionPlacement,
      injectHtmlPreview,
    } from './canvas/companion-node';
    ```

    2. ADD a new private method `createCompanionForCode` on the CanvasAIPlugin class (place it immediately after `fireImageGeneration` around line 584, before `handleApiError`):

    ```typescript
    /**
     * Create a companion render node for a code node (D-12, D-13, D-14).
     *
     * Called from onNodeBoundary when meta.type === 'code' AFTER the code node
     * has been finalized. Detects the content type (HTML/Mermaid/SVG) and creates
     * a visually-paired companion node to the right of the code node.
     *
     * Non-blocking: failures are logged and swallowed so they don't break the stream.
     */
    private createCompanionForCode(
      canvas: any,
      codeNode: any,
      codeContent: string,
      lang: string | undefined
    ): void {
      if (!codeNode || !codeContent) return;

      const contentType = detectCompanionContentType(codeContent, lang);
      if (!contentType) return; // Language not supported for companion rendering

      try {
        const placement = computeCompanionPlacement({
          x: codeNode.x,
          y: codeNode.y,
          width: codeNode.width,
          height: codeNode.height,
          id: codeNode.id,
        });

        const companionNode = this.suppressEvents(() =>
          this.adapter.createTextNodeOnCanvas(
            canvas,
            placement,
            this.settings.aiNodeColor
          )
        );
        if (!companionNode) return;

        // Track companion as an AI node (do not trigger generation on interaction)
        if (companionNode.id) this.aiNodeIds.add(companionNode.id);

        // Mark companion linkage for future canvas-reload re-injection (RESEARCH.md Open Q 1)
        if (codeNode.id) {
          companionNode.unknownData = companionNode.unknownData ?? {};
          companionNode.unknownData.companionOf = codeNode.id;
        }

        // Apply type-specific CSS class
        const cssClass = `canvas-ai-companion--${contentType}`;
        this.adapter.addNodeCssClass(companionNode, cssClass);

        // Populate content by type
        if (contentType === 'html') {
          const htmlContent = createHtmlCompanionContent(codeContent, lang);
          if (htmlContent) {
            // Inject live iframe into DOM (Phase 5 session only — reloads show raw source)
            injectHtmlPreview(companionNode, htmlContent);
          }
        } else if (contentType === 'mermaid') {
          const mermaidBlock = buildMermaidCompanionContent(codeContent);
          this.suppressEvents(() => this.adapter.updateNodeText(companionNode, mermaidBlock));
        } else if (contentType === 'svg') {
          const svgMarkup = buildSvgCompanionContent(codeContent);
          this.suppressEvents(() => this.adapter.updateNodeText(companionNode, svgMarkup));
        }

        this.suppressEvents(() => this.adapter.requestCanvasSave(canvas));
      } catch (err) {
        console.error('[Canvas AI] Companion node creation failed:', err);
      }
    }
    ```

    3. In `streamWithRetry`, MODIFY the `onNodeBoundary` callback (currently at lines 415-445). Currently the code branch at lines 427-431 is:

    ```typescript
    } else if (activeNodeMeta.type === 'code') {
      // Final flush with complete code
      const lang = activeNodeMeta.lang ?? '';
      const wrappedCode = '```' + lang + '\n' + content + '\n```';
      this.suppressEvents(() => this.adapter.updateNodeText(activeNode, wrappedCode));
    }
    ```

    REPLACE this branch with (capturing the finalized code node + content for companion creation):

    ```typescript
    } else if (activeNodeMeta.type === 'code') {
      // Final flush with complete code
      const lang = activeNodeMeta.lang ?? '';
      const wrappedCode = '```' + lang + '\n' + content + '\n```';
      this.suppressEvents(() => this.adapter.updateNodeText(activeNode, wrappedCode));

      // D-12, D-14: create companion render node AFTER code node is finalized.
      // Pitfall 4: companion is placed relative to the CODE node (not the trigger),
      // so it lives further right than any primary placement zone.
      const finalizedCodeNode = activeNode;
      const finalizedCodeLang = activeNodeMeta.lang;
      this.createCompanionForCode(canvas, finalizedCodeNode, content, finalizedCodeLang);
    }
    ```

    IMPORTANT: keep the existing `activeNode = null; activeNodeMeta = null;` reset at the end of the callback unchanged. The companion is created BEFORE the reset using the local snapshot.

    4. In styles.css, APPEND the new CSS classes from UI-SPEC lines 229-250 at the end of the file:

    ```css

    /* Phase 5: Companion render nodes (D-12, D-13) */
    .canvas-ai-companion--html .markdown-rendered {
      padding: 0;
      overflow: hidden;
    }

    .canvas-ai-companion--html iframe {
      width: 100%;
      height: 100%;
      border: none;
      background: var(--background-primary);
    }

    /* SVG companion: ensure SVG fills container */
    .canvas-ai-companion--svg .markdown-rendered svg {
      max-width: 100%;
      height: auto;
    }
    ```

    5. Run `npx tsc --noEmit` — must be 0 errors.

    6. Run `npx jest --bail` — full suite must remain green. (The companion-node.test.ts suite from Task 1 provides coverage; main.ts wiring is verified via manual testing in Plan 06 because onNodeBoundary integration requires a live Claude stream.)

    7. Run `npm run build` (or the esbuild command from package.json scripts) to confirm the plugin bundles cleanly.
  </action>
  <verify>
    <automated>npx tsc --noEmit && npx jest --bail</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "from './canvas/companion-node'" src/main.ts` returns exactly 1 match
    - `grep -n "detectCompanionContentType" src/main.ts` returns at least 1 match
    - `grep -n "createCompanionForCode" src/main.ts` returns at least 2 matches (definition + call)
    - `grep -n "injectHtmlPreview" src/main.ts` returns at least 1 match (imported and called)
    - `grep -n "companionOf" src/main.ts` returns exactly 1 match (unknownData linkage)
    - `grep -n "canvas-ai-companion--" src/main.ts` returns at least 1 match (CSS class template)
    - `grep -n ".canvas-ai-companion--html" styles.css` returns at least 1 match
    - `grep -n ".canvas-ai-companion--svg" styles.css` returns at least 1 match
    - `grep -n "sandbox=\"allow-scripts\"" src/canvas/companion-node.ts` returns 0 matches (sandbox is set via setAttribute, not literal string match) BUT `grep -n "setAttribute('sandbox', 'allow-scripts')" src/canvas/companion-node.ts` returns at least 1 match
    - `grep -cn "allow-same-origin" src/main.ts src/canvas/companion-node.ts` returns 0 (security invariant)
    - `npx tsc --noEmit` exits 0
    - `npx jest --bail` exits 0
  </acceptance_criteria>
  <done>
    Companion node creation is wired into the code-type branch of onNodeBoundary. HTML companions get sandboxed iframes; mermaid companions get fenced mermaid blocks for Obsidian's native renderer; SVG companions get inline markup. CSS classes match UI-SPEC. Companion nodes are tracked in aiNodeIds so they don't trigger new generation. Security invariant (no allow-same-origin) enforced. TypeScript + jest green.
  </done>
</task>

</tasks>

<verification>
- companion-node.ts module exists with all exports covered by unit tests
- `detectCompanionContentType` correctly classifies HTML/mermaid/svg/none-of-the-above
- Security invariant: sandbox is `allow-scripts` only, never `allow-same-origin`
- main.ts onNodeBoundary creates companion after code node finalization
- CSS classes match UI-SPEC contract
- Full jest + tsc green
- Plugin builds cleanly
</verification>

<success_criteria>
- All three companion content types (HTML/Mermaid/SVG) supported
- Companion placement follows UI-SPEC: right of code node, 24px gap, mirror sizing
- unknownData.companionOf links companion to parent for future re-injection
- Companion is tracked in aiNodeIds (no retrigger)
- Pitfall 3 (srcdoc escaping via DOM property) honored
- Pitfall 4 (companion after primary placement, relative to code node) honored
- No forbidden sandbox combinations
</success_criteria>

<output>
After completion, create `.planning/phases/05-taste-profile-and-polish/05-05-SUMMARY.md` per template.
</output>
