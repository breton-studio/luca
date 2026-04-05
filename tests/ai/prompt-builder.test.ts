import {
  buildSystemPrompt,
  buildUserMessage,
  buildIterationUserMessage,
  GENERATION_INSTRUCTIONS,
  SystemPromptBlock,
} from '../../src/ai/prompt-builder';
import type {
  IterationContext,
  IterationSource,
} from '../../src/canvas/iteration-detector';
import type { CanvasNodeInfo } from '../../src/types/canvas';

describe('prompt-builder', () => {
  const mockTasteContent = 'Tone: Restrained\nDepth: Deep structural analysis\n\nWe believe design begins with restraint.';
  const mockSpatialNarrative = '## Canvas Context\n### Focus Area\n3 nodes clustered around "Architecture"';

  describe('buildSystemPrompt', () => {
    let blocks: SystemPromptBlock[];

    beforeEach(() => {
      blocks = buildSystemPrompt(mockTasteContent, mockSpatialNarrative);
    });

    test('returns an array of 2 content blocks', () => {
      expect(blocks).toHaveLength(2);
    });

    test('first content block has cache_control: { type: "ephemeral" }', () => {
      expect(blocks[0].cache_control).toEqual({ type: 'ephemeral' });
    });

    test('first content block text contains "spatial thinking partner"', () => {
      expect(blocks[0].text).toContain('spatial thinking partner');
    });

    test('first content block text contains the formatted taste profile content', () => {
      expect(blocks[0].text).toContain('Restrained');
      expect(blocks[0].text).toContain('Deep structural analysis');
      expect(blocks[0].text).toContain('We believe design begins with restraint.');
    });

    test('first content block text contains "Medium Selection" section', () => {
      expect(blocks[0].text).toContain('Medium Selection');
    });

    test('second content block text contains the spatial narrative', () => {
      expect(blocks[1].text).toContain('Canvas Context');
      expect(blocks[1].text).toContain('3 nodes clustered around "Architecture"');
    });

    test('second content block does NOT have cache_control', () => {
      expect(blocks[1].cache_control).toBeUndefined();
    });
  });

  describe('GENERATION_INSTRUCTIONS', () => {
    test('contains typed <node type="text"> tag instruction', () => {
      expect(GENERATION_INSTRUCTIONS).toContain('<node type="text">');
    });

    test('contains typed <node type="code" lang="typescript"> tag instruction', () => {
      expect(GENERATION_INSTRUCTIONS).toContain('<node type="code" lang="typescript">');
    });

    test('contains typed <node type="mermaid"> tag instruction', () => {
      expect(GENERATION_INSTRUCTIONS).toContain('<node type="mermaid">');
    });

    test('contains typed <node type="image"> tag instruction', () => {
      expect(GENERATION_INSTRUCTIONS).toContain('<node type="image">');
    });

    test('contains "AT MOST one node of each type" constraint', () => {
      expect(GENERATION_INSTRUCTIONS).toContain('AT MOST one node of each type');
    });

    test('does NOT contain old text-only instruction', () => {
      expect(GENERATION_INSTRUCTIONS).not.toContain('For now, generate text/markdown nodes only');
    });

    test('contains </node> closing tag', () => {
      expect(GENERATION_INSTRUCTIONS).toContain('</node>');
    });
  });

  describe('buildUserMessage', () => {
    test('returns the user prompt string', () => {
      const message = buildUserMessage();
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
    });

    test('references typed <node> tags', () => {
      const message = buildUserMessage();
      expect(message).toContain('typed <node> tags');
    });
  });

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
      // Case-insensitive match: the prompt text begins the sentence with "Use your judgment"
      // (capital U). Intent is to verify the permissive timing phrase is present regardless
      // of sentence case.
      expect(GENERATION_INSTRUCTIONS.toLowerCase()).toContain('use your judgment');
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

  // Gap closure for Phase 5 manual verification (Group B/D):
  //   1. "Image of A warm sand-to-clay gradient jersey..." → text + mermaid (no image)
  //   2. Mermaid emitted for fabric/design descriptions that have nothing to do
  //      with processes, flows, or hierarchies
  //
  // Root cause in the pre-fix prompt:
  //   - "Image: use sparingly -- only when a visual concept is genuinely powerful"
  //   - "Do not generate images unless the spatial context strongly calls for it"
  //   - No mechanism to honor an explicit user request for a specific medium
  //   - Mermaid restriction ("ONLY for processes/flows") lacked concrete forbidden
  //     examples, so Claude treated it as a soft preference
  describe('Explicit Medium Requests (Phase 5 gap closure)', () => {
    test('GENERATION_INSTRUCTIONS contains ## Explicit User Requests section', () => {
      expect(GENERATION_INSTRUCTIONS).toContain('## Explicit User Requests');
    });

    test('lists image-requesting phrases the user might use', () => {
      // Lowercase match — the prompt may use title case or sentence case
      const lower = GENERATION_INSTRUCTIONS.toLowerCase();
      expect(lower).toContain('image of');
      expect(lower).toContain('photo of');
      expect(lower).toContain('picture of');
      expect(lower).toContain('illustration of');
    });

    test('instructs Claude to honor explicit requests (not substitute)', () => {
      const lower = GENERATION_INSTRUCTIONS.toLowerCase();
      // The explicit-request section must make it clear that a requested
      // medium cannot be swapped for a different medium (text + mermaid for
      // an image request was the observed bug).
      expect(lower).toContain('must');
      // Either "do not substitute" or "do not replace" or similar
      expect(
        lower.includes('do not substitute') ||
          lower.includes('do not replace') ||
          lower.includes('not substitute')
      ).toBe(true);
    });

    test('image guidance no longer contains anti-image bias phrases', () => {
      // These exact phrases biased Claude away from images even when explicitly
      // requested. They must be gone from the rewritten prompt.
      expect(GENERATION_INSTRUCTIONS).not.toContain(
        'use sparingly -- only when a visual concept is genuinely powerful'
      );
      expect(GENERATION_INSTRUCTIONS).not.toContain(
        'Do not generate images unless the spatial context strongly calls for it'
      );
    });

    test('mermaid rule uses FORBIDDEN/ALLOWED framing', () => {
      // The old soft "Add mermaid ONLY when..." language produced mermaid output
      // for fabric-gradient descriptions. Stronger framing with explicit negative
      // examples should suppress that.
      expect(GENERATION_INSTRUCTIONS).toContain('FORBIDDEN');
      expect(GENERATION_INSTRUCTIONS).toContain('ALLOWED');
    });

    test('mermaid FORBIDDEN list names concrete non-process cases', () => {
      // The Phase 5 failure was mermaid for "a warm sand-to-clay gradient jersey"
      // (a design/object description). At least one of these categories must be
      // listed as forbidden so Claude has a clear example of what to avoid.
      const lower = GENERATION_INSTRUCTIONS.toLowerCase();
      expect(
        lower.includes('descriptions') ||
          lower.includes('aesthetic') ||
          lower.includes('materials') ||
          lower.includes('objects')
      ).toBe(true);
    });

    test('explicit-request section lives inside the cached system prompt block', () => {
      const blocks = buildSystemPrompt('Tone: Restrained', 'spatial narrative');
      expect(blocks[0].text).toContain('## Explicit User Requests');
      expect(blocks[0].cache_control).toEqual({ type: 'ephemeral' });
    });
  });

  // Iteration feature (Phase 5 gap closure): user draws an edge from an
  // AI-generated node to a new text node, writes instructions in the text
  // node, and expects an iterated version of the same type. The iteration
  // content lives in the user message (dynamic), NOT the cached system block.
  describe('buildIterationUserMessage (Phase 5 iteration feature)', () => {
    function makeNode(id: string, overrides: Partial<CanvasNodeInfo> = {}): CanvasNodeInfo {
      return {
        id,
        type: 'text',
        x: 0,
        y: 0,
        width: 300,
        height: 200,
        content: '',
        ...overrides,
      };
    }

    function makeSource(
      overrides: Partial<IterationSource> & { type: IterationSource['type'] }
    ): IterationSource {
      return {
        node: makeNode('ai-' + overrides.type),
        content: 'source content',
        createdIndex: 0,
        ...overrides,
      };
    }

    function makeContext(
      primary: IterationSource,
      additional: IterationSource[] = [],
      instructions: string = 'do the iteration'
    ): IterationContext {
      return {
        primarySource: primary,
        additionalSources: additional,
        triggerTextNode: makeNode('trigger', { content: instructions }),
        userInstructions: instructions,
        targetType: primary.type,
        targetLang: primary.lang,
      };
    }

    // ---------- Single-source variants ----------

    test('code source: includes fenced code block with lang, targets <node type="code" lang="...">', () => {
      const ctx = makeContext(
        makeSource({
          type: 'code',
          content: 'const x = 1;',
          lang: 'typescript',
        }),
        [],
        'add a type annotation'
      );
      const msg = buildIterationUserMessage(ctx);
      expect(msg).toContain('```typescript');
      expect(msg).toContain('const x = 1;');
      expect(msg).toContain('add a type annotation');
      expect(msg).toContain('<node type="code"');
      expect(msg).toContain('lang="typescript"');
    });

    test('code source without lang: targets <node type="code"> with empty fence', () => {
      const ctx = makeContext(
        makeSource({ type: 'code', content: 'raw code', lang: undefined }),
        [],
        'refactor'
      );
      const msg = buildIterationUserMessage(ctx);
      expect(msg).toContain('<node type="code">');
      // Should not invent a lang attribute
      expect(msg).not.toContain('lang="undefined"');
      expect(msg).not.toContain('lang=""');
    });

    test('text source: includes raw content, targets <node type="text">', () => {
      const ctx = makeContext(
        makeSource({
          type: 'text',
          content: 'A reflective paragraph about design.',
        }),
        [],
        'rewrite in the style of cormac mccarthy'
      );
      const msg = buildIterationUserMessage(ctx);
      expect(msg).toContain('A reflective paragraph about design.');
      expect(msg).toContain('rewrite in the style of cormac mccarthy');
      expect(msg).toContain('<node type="text">');
    });

    test('mermaid source: includes mermaid fenced block, targets <node type="mermaid">', () => {
      const ctx = makeContext(
        makeSource({
          type: 'mermaid',
          content: 'graph TD\n  A --> B',
        }),
        [],
        'add a cache node'
      );
      const msg = buildIterationUserMessage(ctx);
      expect(msg).toContain('```mermaid');
      expect(msg).toContain('graph TD');
      expect(msg).toContain('<node type="mermaid">');
    });

    test('image source: frames as image iteration, targets <node type="image">', () => {
      const ctx = makeContext(
        makeSource({
          type: 'image',
          content: 'canvas-ai-images/2026-04-05_abc.png',
        }),
        [],
        'make it at dusk with warm lighting'
      );
      const msg = buildIterationUserMessage(ctx);
      expect(msg).toContain('<node type="image">');
      // Should reference the file path somewhere as the source
      expect(msg.toLowerCase()).toContain('image');
      // Tell Claude to infer visual intent from instructions (no persisted prompt)
      expect(msg.toLowerCase()).toMatch(/visual|infer|scene|describe/);
    });

    // ---------- Universal assertions ----------

    test('all variants reference "iteration" explicitly (not a fresh generation)', () => {
      const types: Array<IterationSource['type']> = ['code', 'text', 'mermaid', 'image'];
      for (const type of types) {
        const ctx = makeContext(
          makeSource({
            type,
            content: type === 'code' ? 'x = 1' : 'content',
            lang: type === 'code' ? 'python' : undefined,
          })
        );
        const msg = buildIterationUserMessage(ctx).toLowerCase();
        expect(msg).toContain('iteration');
      }
    });

    test('all variants reference the explicit-request override from GENERATION_INSTRUCTIONS', () => {
      const ctx = makeContext(
        makeSource({ type: 'code', content: 'x', lang: 'js' })
      );
      const msg = buildIterationUserMessage(ctx).toLowerCase();
      expect(msg).toContain('explicit');
    });

    test('all variants include the user instructions verbatim', () => {
      const ctx = makeContext(
        makeSource({ type: 'text', content: 'orig' }),
        [],
        'VERY-SPECIFIC-MARKER-STRING-xyz123'
      );
      expect(buildIterationUserMessage(ctx)).toContain('VERY-SPECIFIC-MARKER-STRING-xyz123');
    });

    test('all variants tell Claude to emit ONLY the target type, not other mediums', () => {
      const ctx = makeContext(
        makeSource({ type: 'code', content: 'x', lang: 'js' })
      );
      const msg = buildIterationUserMessage(ctx).toLowerCase();
      // Must communicate "single node only" somehow
      expect(msg).toMatch(/single|only|exactly one|not emit|do not/);
    });

    // ---------- Multi-source merge ----------

    test('multi-source: includes primary section AND additional sources section', () => {
      const primary = makeSource({
        type: 'code',
        content: 'function counter() {}',
        lang: 'javascript',
      });
      const additional = [
        makeSource({
          type: 'code',
          content: 'function debounce() {}',
          lang: 'typescript',
          node: makeNode('ai2'),
        }),
      ];
      const ctx = makeContext(primary, additional, 'combine these into a debounced counter');
      const msg = buildIterationUserMessage(ctx);
      expect(msg.toLowerCase()).toContain('primary');
      expect(msg.toLowerCase()).toContain('additional');
      expect(msg).toContain('function counter()');
      expect(msg).toContain('function debounce()');
      expect(msg).toContain('combine these into a debounced counter');
    });

    test('multi-source: each additional source labeled with its type', () => {
      const primary = makeSource({
        type: 'code',
        content: 'code body',
        lang: 'js',
      });
      const additional = [
        makeSource({
          type: 'text',
          content: 'text body',
          node: makeNode('ai2'),
        }),
        makeSource({
          type: 'mermaid',
          content: 'graph TD\nX-->Y',
          node: makeNode('ai3'),
        }),
      ];
      const ctx = makeContext(primary, additional, 'synthesize');
      const msg = buildIterationUserMessage(ctx);
      expect(msg).toContain('text body');
      expect(msg).toContain('graph TD');
      // Each additional source's type surfaces somewhere (label, header, or block tag)
      expect(msg).toContain('text');
      expect(msg).toContain('mermaid');
    });

    test('multi-source still specifies a SINGLE target type matching primary', () => {
      const primary = makeSource({
        type: 'mermaid',
        content: 'graph TD\nX-->Y',
      });
      const additional = [
        makeSource({
          type: 'code',
          content: 'some code',
          lang: 'python',
          node: makeNode('ai2'),
        }),
      ];
      const ctx = makeContext(primary, additional, 'merge');
      const msg = buildIterationUserMessage(ctx);
      expect(msg).toContain('<node type="mermaid">');
      // Should not ask for a code output since primary is mermaid
      expect(msg).not.toContain('<node type="code"');
    });

    // ---------- Cache discipline ----------

    test('buildIterationUserMessage does not affect buildSystemPrompt output (cache preserved)', () => {
      const before = buildSystemPrompt('taste content', 'spatial narrative');
      const ctx = makeContext(
        makeSource({ type: 'code', content: 'x', lang: 'js' })
      );
      buildIterationUserMessage(ctx);
      const after = buildSystemPrompt('taste content', 'spatial narrative');
      expect(after[0].text).toBe(before[0].text);
      expect(after[1].text).toBe(before[1].text);
      expect(after[0].cache_control).toEqual(before[0].cache_control);
    });
  });

  // Gap closure #2 for Phase 5 manual verification:
  //   User typed "Image of A warm sand-to-clay gradient jersey built from
  //   three distinct fabrics..." Claude emitted a text node of commentary
  //   first, then an image node whose prompt was "three fabric swatches
  //   showing the transitions" — an illustration of Claude's own text,
  //   not the jersey the user asked for.
  //
  // Root cause:
  //   1. No ordering rule: text node was emitted first, so the image
  //      description was generated in a context dominated by Claude's
  //      own prior commentary.
  //   2. Image guidance said "vivid, concrete visual description" with
  //      no instruction to describe the SUBJECT THE USER NAMED.
  //   3. No warning against visualizing sub-components when the user
  //      asked for a complete object.
  describe('Image prompt fidelity (Phase 5 gap closure)', () => {
    test('instructs Claude that image content must describe the user-named subject', () => {
      const lower = GENERATION_INSTRUCTIONS.toLowerCase();
      // Must explicitly reference "the subject" or "what the user" in the
      // image rules, so Claude knows the image is anchored to the trigger.
      expect(
        lower.includes('subject the user named') ||
          lower.includes('subject the user asked') ||
          lower.includes("user's subject")
      ).toBe(true);
    });

    test('forbids illustrating Claude own text commentary for explicit image requests', () => {
      const lower = GENERATION_INSTRUCTIONS.toLowerCase();
      // The observed failure: text commentary generated first, then an
      // image of the commentary instead of the user's subject.
      expect(
        lower.includes('not an illustration of your') ||
          lower.includes('not illustrate your') ||
          lower.includes('not a study of') ||
          lower.includes('not substitute a sub-concept')
      ).toBe(true);
    });

    test('requires image node to be emitted FIRST for explicit image requests', () => {
      const lower = GENERATION_INSTRUCTIONS.toLowerCase();
      // Ordering rule: image before text commentary so the text cannot
      // warp the image prompt via streaming context dominance.
      expect(lower).toContain('image');
      expect(
        lower.includes('emit the image') ||
          lower.includes('output the image') ||
          lower.includes('image node first') ||
          lower.includes('image first')
      ).toBe(true);
    });

    test('warns against visualizing sub-components when user asked for a complete object', () => {
      const lower = GENERATION_INSTRUCTIONS.toLowerCase();
      // Concrete example of the failure mode — user asks for "a jersey",
      // Claude visualizes the fabric swatches.
      expect(
        lower.includes('complete object') ||
          lower.includes('finished') ||
          lower.includes('not the individual') ||
          lower.includes('not a study of its components')
      ).toBe(true);
    });

    test('tells Claude to paraphrase the user own concrete details', () => {
      const lower = GENERATION_INSTRUCTIONS.toLowerCase();
      // The image prompt to Runware must carry the user's actual words
      // (colors, materials, shapes) — not invent new concepts.
      expect(
        lower.includes("user's own") ||
          lower.includes('user own') ||
          lower.includes('user supplied') ||
          lower.includes('user-supplied')
      ).toBe(true);
    });
  });
});
