import {
  parseTasteProfileFrontmatter,
  formatTasteForPrompt,
  readTasteProfile,
  seedTasteProfile,
  DEFAULT_TASTE_PROFILE,
  TasteProfile,
} from '../../src/taste/taste-profile';

describe('taste-profile', () => {
  describe('parseTasteProfileFrontmatter', () => {
    test('extracts tone, depth, visual_preference, thinking_style from YAML frontmatter', () => {
      const content = `---
tone: Direct and clear
depth: Surface level
visual_preference: Colorful
thinking_style: Intuitive
---

Some body content.`;
      const result = parseTasteProfileFrontmatter(content);
      expect(result.fields.tone).toBe('Direct and clear');
      expect(result.fields.depth).toBe('Surface level');
      expect(result.fields.visual_preference).toBe('Colorful');
      expect(result.fields.thinking_style).toBe('Intuitive');
    });

    test('returns body content after frontmatter', () => {
      const content = `---
tone: Direct
depth: Deep
visual_preference: Minimal
thinking_style: Systematic
---

Body paragraph one.

Body paragraph two.`;
      const result = parseTasteProfileFrontmatter(content);
      expect(result.body).toContain('Body paragraph one.');
      expect(result.body).toContain('Body paragraph two.');
    });

    test('handles file with no frontmatter (returns body only, empty fields)', () => {
      const content = 'Just some body content without frontmatter.';
      const result = parseTasteProfileFrontmatter(content);
      expect(result.fields.tone).toBe('');
      expect(result.fields.depth).toBe('');
      expect(result.fields.visual_preference).toBe('');
      expect(result.fields.thinking_style).toBe('');
      expect(result.body).toContain('Just some body content without frontmatter.');
    });
  });

  describe('DEFAULT_TASTE_PROFILE', () => {
    test('contains frontmatter with tone, depth, visual_preference, thinking_style', () => {
      expect(DEFAULT_TASTE_PROFILE).toContain('tone:');
      expect(DEFAULT_TASTE_PROFILE).toContain('depth:');
      expect(DEFAULT_TASTE_PROFILE).toContain('visual_preference:');
      expect(DEFAULT_TASTE_PROFILE).toContain('thinking_style:');
    });

    test('body contains "restraint" (seed content per D-10)', () => {
      expect(DEFAULT_TASTE_PROFILE).toContain('restraint');
    });
  });

  describe('formatTasteForPrompt', () => {
    test('returns combined frontmatter fields + body as a single string', () => {
      const profile: TasteProfile = {
        fields: {
          tone: 'Direct and clear',
          depth: 'Surface level',
          visual_preference: 'Colorful',
          thinking_style: 'Intuitive',
        },
        body: 'Some body content.',
        raw: '',
      };
      const result = formatTasteForPrompt(profile);
      expect(result).toContain('Tone: Direct and clear');
      expect(result).toContain('Depth: Surface level');
      expect(result).toContain('Visual Preference: Colorful');
      expect(result).toContain('Thinking Style: Intuitive');
      expect(result).toContain('Some body content.');
    });
  });

  describe('readTasteProfile', () => {
    test('reads and parses existing taste profile file', async () => {
      const mockAdapter = {
        exists: jest.fn().mockResolvedValue(true),
        read: jest.fn().mockResolvedValue(`---
tone: Test tone
depth: Test depth
visual_preference: Test visual
thinking_style: Test thinking
---

Test body.`),
      };
      const result = await readTasteProfile(mockAdapter, 'test/path.md');
      expect(mockAdapter.read).toHaveBeenCalledWith('test/path.md');
      expect(result.fields.tone).toBe('Test tone');
      expect(result.body).toContain('Test body.');
    });

    test('returns parsed DEFAULT_TASTE_PROFILE when file does not exist', async () => {
      const mockAdapter = {
        exists: jest.fn().mockResolvedValue(false),
        read: jest.fn(),
      };
      const result = await readTasteProfile(mockAdapter, 'test/path.md');
      expect(mockAdapter.read).not.toHaveBeenCalled();
      expect(result.fields.tone).toContain('Restrained');
      expect(result.body).toContain('restraint');
    });
  });

  describe('seedTasteProfile', () => {
    test('writes DEFAULT_TASTE_PROFILE when file does not exist', async () => {
      const mockAdapter = {
        exists: jest.fn().mockResolvedValue(false),
        write: jest.fn().mockResolvedValue(undefined),
        mkdir: jest.fn().mockResolvedValue(undefined),
      };
      await seedTasteProfile(mockAdapter, '.obsidian/plugins/canvas-ai/taste-profile.md');
      expect(mockAdapter.mkdir).toHaveBeenCalled();
      expect(mockAdapter.write).toHaveBeenCalledWith(
        '.obsidian/plugins/canvas-ai/taste-profile.md',
        DEFAULT_TASTE_PROFILE
      );
    });

    test('does not write when file already exists', async () => {
      const mockAdapter = {
        exists: jest.fn().mockResolvedValue(true),
        write: jest.fn(),
        mkdir: jest.fn(),
      };
      await seedTasteProfile(mockAdapter, '.obsidian/plugins/canvas-ai/taste-profile.md');
      expect(mockAdapter.write).not.toHaveBeenCalled();
    });
  });
});
