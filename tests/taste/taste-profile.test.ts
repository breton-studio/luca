import {
  parseTasteProfileFrontmatter,
  formatTasteForPrompt,
  readTasteProfile,
  seedTasteProfile,
  DEFAULT_TASTE_PROFILE,
  TasteProfile,
} from '../../src/taste/taste-profile';

describe('taste-profile', () => {
  describe('parseTasteProfileFrontmatter - nested format', () => {
    test('extracts style.tone, style.voice, style.formatting, substance.depth, substance.domains, substance.thinking_approach from nested YAML', () => {
      const content = `---
style:
  tone: Restrained
  voice: Direct
  formatting: Clean
substance:
  depth: Deep
  domains: Architecture
  thinking_approach: Swiss
---

Some body content.`;
      const result = parseTasteProfileFrontmatter(content);
      expect(result.fields.style.tone).toBe('Restrained');
      expect(result.fields.style.voice).toBe('Direct');
      expect(result.fields.style.formatting).toBe('Clean');
      expect(result.fields.substance.depth).toBe('Deep');
      expect(result.fields.substance.domains).toBe('Architecture');
      expect(result.fields.substance.thinking_approach).toBe('Swiss');
    });

    test('returns body content after nested frontmatter', () => {
      const content = `---
style:
  tone: A
  voice: B
  formatting: C
substance:
  depth: D
  domains: E
  thinking_approach: F
---

Body paragraph one.

Body paragraph two.`;
      const result = parseTasteProfileFrontmatter(content);
      expect(result.body).toContain('Body paragraph one.');
      expect(result.body).toContain('Body paragraph two.');
    });

    test('handles file with no frontmatter (returns body only, empty nested fields)', () => {
      const content = 'Just some body content without frontmatter.';
      const result = parseTasteProfileFrontmatter(content);
      expect(result.fields.style.tone).toBe('');
      expect(result.fields.style.voice).toBe('');
      expect(result.fields.style.formatting).toBe('');
      expect(result.fields.substance.depth).toBe('');
      expect(result.fields.substance.domains).toBe('');
      expect(result.fields.substance.thinking_approach).toBe('');
      expect(result.body).toContain('Just some body content without frontmatter.');
      expect(result.stylePhilosophy).toBe('');
      expect(result.substancePhilosophy).toBe('');
    });

    test('tolerates tabs for indentation of nested keys', () => {
      const content = `---
style:
\ttone: TabbedTone
\tvoice: TabbedVoice
\tformatting: TabbedFormatting
substance:
\tdepth: TabbedDepth
\tdomains: TabbedDomains
\tthinking_approach: TabbedApproach
---`;
      const result = parseTasteProfileFrontmatter(content);
      expect(result.fields.style.tone).toBe('TabbedTone');
      expect(result.fields.substance.depth).toBe('TabbedDepth');
    });
  });

  describe('parseTasteProfileFrontmatter - legacy migration (D-03)', () => {
    test('migrates flat tone/depth/visual_preference/thinking_style to nested shape', () => {
      const content = `---
tone: Direct and clear
depth: Surface level
visual_preference: Colorful
thinking_style: Intuitive
---

Some body content.`;
      const result = parseTasteProfileFrontmatter(content);
      expect(result.fields.style.tone).toBe('Direct and clear');
      expect(result.fields.substance.depth).toBe('Surface level');
      expect(result.fields.style.formatting).toBe('Colorful');
      expect(result.fields.substance.thinking_approach).toBe('Intuitive');
    });

    test('legacy migration leaves unmapped nested fields empty', () => {
      const content = `---
tone: T
depth: D
visual_preference: V
thinking_style: TS
---`;
      const result = parseTasteProfileFrontmatter(content);
      expect(result.fields.style.voice).toBe('');
      expect(result.fields.substance.domains).toBe('');
    });

    test('legacy migration still extracts body content', () => {
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
  });

  describe('parseTasteProfileFrontmatter - philosophy body extraction', () => {
    test('extracts content after ## Style Philosophy and ## Substance Philosophy headers', () => {
      const content = `---
style:
  tone: A
substance:
  depth: D
---

## Style Philosophy

We believe restraint is everything.

## Substance Philosophy

We think in systems, not artifacts.`;
      const result = parseTasteProfileFrontmatter(content);
      expect(result.stylePhilosophy).toContain('We believe restraint is everything.');
      expect(result.substancePhilosophy).toContain('We think in systems, not artifacts.');
    });

    test('returns empty stylePhilosophy/substancePhilosophy when headers missing', () => {
      const content = `---
style:
  tone: A
substance:
  depth: D
---

Just a plain body without section headers.`;
      const result = parseTasteProfileFrontmatter(content);
      expect(result.stylePhilosophy).toBe('');
      expect(result.substancePhilosophy).toBe('');
      expect(result.body).toContain('Just a plain body without section headers.');
    });

    test('extracts stylePhilosophy when only style header is present', () => {
      const content = `---
style:
  tone: A
---

## Style Philosophy

Style only body.`;
      const result = parseTasteProfileFrontmatter(content);
      expect(result.stylePhilosophy).toContain('Style only body.');
      expect(result.substancePhilosophy).toBe('');
    });
  });

  describe('DEFAULT_TASTE_PROFILE', () => {
    test('contains nested style: and substance: group headers', () => {
      expect(DEFAULT_TASTE_PROFILE).toContain('style:');
      expect(DEFAULT_TASTE_PROFILE).toContain('substance:');
    });

    test('contains all six nested field keys', () => {
      expect(DEFAULT_TASTE_PROFILE).toContain('tone:');
      expect(DEFAULT_TASTE_PROFILE).toContain('voice:');
      expect(DEFAULT_TASTE_PROFILE).toContain('formatting:');
      expect(DEFAULT_TASTE_PROFILE).toContain('depth:');
      expect(DEFAULT_TASTE_PROFILE).toContain('domains:');
      expect(DEFAULT_TASTE_PROFILE).toContain('thinking_approach:');
    });

    test('contains Style Philosophy and Substance Philosophy body headers', () => {
      expect(DEFAULT_TASTE_PROFILE).toContain('## Style Philosophy');
      expect(DEFAULT_TASTE_PROFILE).toContain('## Substance Philosophy');
    });

    test('body contains "restraint" (seed content per D-10 preserved)', () => {
      expect(DEFAULT_TASTE_PROFILE).toContain('restraint');
    });

    test('parses into non-empty nested fields via parseTasteProfileFrontmatter', () => {
      const parsed = parseTasteProfileFrontmatter(DEFAULT_TASTE_PROFILE);
      expect(parsed.fields.style.tone.length).toBeGreaterThan(0);
      expect(parsed.fields.style.voice.length).toBeGreaterThan(0);
      expect(parsed.fields.style.formatting.length).toBeGreaterThan(0);
      expect(parsed.fields.substance.depth.length).toBeGreaterThan(0);
      expect(parsed.fields.substance.domains.length).toBeGreaterThan(0);
      expect(parsed.fields.substance.thinking_approach.length).toBeGreaterThan(0);
    });
  });

  describe('formatTasteForPrompt', () => {
    test('emits ### Style (how to communicate) header', () => {
      const profile: TasteProfile = {
        fields: {
          style: { tone: 'A', voice: 'B', formatting: 'C' },
          substance: { depth: 'D', domains: 'E', thinking_approach: 'F' },
        },
        body: '',
        stylePhilosophy: '',
        substancePhilosophy: '',
        raw: '',
      };
      const result = formatTasteForPrompt(profile);
      expect(result).toContain('### Style (how to communicate)');
    });

    test('emits ### Substance (what to communicate) header', () => {
      const profile: TasteProfile = {
        fields: {
          style: { tone: 'A', voice: 'B', formatting: 'C' },
          substance: { depth: 'D', domains: 'E', thinking_approach: 'F' },
        },
        body: '',
        stylePhilosophy: '',
        substancePhilosophy: '',
        raw: '',
      };
      const result = formatTasteForPrompt(profile);
      expect(result).toContain('### Substance (what to communicate)');
    });

    test('emits Tone/Voice/Formatting under Style', () => {
      const profile: TasteProfile = {
        fields: {
          style: { tone: 'A', voice: 'B', formatting: 'C' },
          substance: { depth: '', domains: '', thinking_approach: '' },
        },
        body: '',
        stylePhilosophy: '',
        substancePhilosophy: '',
        raw: '',
      };
      const result = formatTasteForPrompt(profile);
      expect(result).toContain('Tone: A');
      expect(result).toContain('Voice: B');
      expect(result).toContain('Formatting: C');
    });

    test('emits Depth/Domains/Thinking Approach under Substance', () => {
      const profile: TasteProfile = {
        fields: {
          style: { tone: '', voice: '', formatting: '' },
          substance: { depth: 'X', domains: 'Y', thinking_approach: 'Z' },
        },
        body: '',
        stylePhilosophy: '',
        substancePhilosophy: '',
        raw: '',
      };
      const result = formatTasteForPrompt(profile);
      expect(result).toContain('Depth: X');
      expect(result).toContain('Domains: Y');
      expect(result).toContain('Thinking Approach: Z');
    });

    test('includes stylePhilosophy body content when present', () => {
      const profile: TasteProfile = {
        fields: {
          style: { tone: 'A', voice: '', formatting: '' },
          substance: { depth: '', domains: '', thinking_approach: '' },
        },
        body: '',
        stylePhilosophy: 'Style body text here',
        substancePhilosophy: '',
        raw: '',
      };
      const result = formatTasteForPrompt(profile);
      expect(result).toContain('Style body text here');
    });

    test('includes substancePhilosophy body content when present', () => {
      const profile: TasteProfile = {
        fields: {
          style: { tone: '', voice: '', formatting: '' },
          substance: { depth: 'D', domains: '', thinking_approach: '' },
        },
        body: '',
        stylePhilosophy: '',
        substancePhilosophy: 'Substance body text here',
        raw: '',
      };
      const result = formatTasteForPrompt(profile);
      expect(result).toContain('Substance body text here');
    });

    test('falls back to combined body when no philosophy sections', () => {
      const profile: TasteProfile = {
        fields: {
          style: { tone: 'A', voice: '', formatting: '' },
          substance: { depth: 'D', domains: '', thinking_approach: '' },
        },
        body: 'Legacy body content',
        stylePhilosophy: '',
        substancePhilosophy: '',
        raw: '',
      };
      const result = formatTasteForPrompt(profile);
      expect(result).toContain('Legacy body content');
    });

    test('omits empty field lines', () => {
      const profile: TasteProfile = {
        fields: {
          style: { tone: '', voice: '', formatting: '' },
          substance: { depth: 'D', domains: '', thinking_approach: '' },
        },
        body: '',
        stylePhilosophy: '',
        substancePhilosophy: '',
        raw: '',
      };
      const result = formatTasteForPrompt(profile);
      expect(result).not.toMatch(/Tone:\s*$/m);
      expect(result).not.toMatch(/Voice:\s*$/m);
      expect(result).not.toMatch(/Formatting:\s*$/m);
      expect(result).not.toMatch(/Domains:\s*$/m);
    });
  });

  describe('readTasteProfile', () => {
    test('reads and parses existing taste profile file (nested format)', async () => {
      const mockAdapter = {
        exists: jest.fn().mockResolvedValue(true),
        read: jest.fn().mockResolvedValue(`---
style:
  tone: Test tone
  voice: Test voice
  formatting: Test formatting
substance:
  depth: Test depth
  domains: Test domains
  thinking_approach: Test thinking
---

Test body.`),
      };
      const result = await readTasteProfile(mockAdapter, 'test/path.md');
      expect(mockAdapter.read).toHaveBeenCalledWith('test/path.md');
      expect(result.fields.style.tone).toBe('Test tone');
      expect(result.fields.substance.depth).toBe('Test depth');
      expect(result.body).toContain('Test body.');
    });

    test('returns parsed DEFAULT_TASTE_PROFILE when file does not exist', async () => {
      const mockAdapter = {
        exists: jest.fn().mockResolvedValue(false),
        read: jest.fn(),
      };
      const result = await readTasteProfile(mockAdapter, 'test/path.md');
      expect(mockAdapter.read).not.toHaveBeenCalled();
      expect(result.fields.style.tone).toContain('Restrained');
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
