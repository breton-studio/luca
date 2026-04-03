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
    test('contains "<node>" delimiter instruction for multi-node output', () => {
      expect(GENERATION_INSTRUCTIONS).toContain('<node>');
      expect(GENERATION_INSTRUCTIONS).toContain('</node>');
    });

    test('contains "1-3 text nodes" instruction', () => {
      expect(GENERATION_INSTRUCTIONS).toContain('1-3 text nodes');
    });
  });

  describe('buildUserMessage', () => {
    test('returns the user prompt string', () => {
      const message = buildUserMessage();
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
      expect(message).toContain('<node>');
    });
  });
});
