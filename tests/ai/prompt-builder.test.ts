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
});
