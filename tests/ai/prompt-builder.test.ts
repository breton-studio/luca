import {
  buildSystemPrompt,
  buildUserMessage,
  GENERATION_INSTRUCTIONS,
  SystemPromptBlock,
} from '../../src/ai/prompt-builder';

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
});
