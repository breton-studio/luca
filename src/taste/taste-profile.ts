/**
 * Taste profile module (TAST-01, TAST-02, TAST-03).
 *
 * Manages the global taste profile: a markdown file with YAML frontmatter
 * stored at .obsidian/plugins/canvas-ai/taste-profile.md (D-09).
 *
 * Format (D-08):
 * ---
 * tone: Restrained, considered, unhurried. Direct without being blunt.
 * depth: Deep structural analysis. First-principles thinking.
 * visual_preference: Monochromatic default. Color used surgically.
 * thinking_style: Swiss rational tradition. Systematic over intuitive.
 * ---
 * [freeform body]
 */

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

/**
 * Default taste profile content seeded on first run (D-10).
 */
export const DEFAULT_TASTE_PROFILE = `---
tone: Restrained, considered, unhurried. Direct without being blunt.
depth: Deep structural analysis. First-principles thinking. Justify in terms of spatial relationships and logic.
visual_preference: Monochromatic default. Color used surgically -- single accent, low saturation. No trends, no named movements.
thinking_style: Swiss rational tradition. Systematic thinking over intuition. Soft mathematical ratios over rigid alignment. Space as primary material.
---

We believe design begins with restraint. Every element must earn its place through structural necessity, not decoration. Space is not empty -- it is the primary material that gives form its meaning.

Typography serves structure: grotesque typefaces at considered scales, never decorative. Color is used surgically -- a single accent at low saturation, as if mixed with concrete. The palette is monochromatic by default; color arrives only when it carries specific meaning.

We think in systems, not artifacts. A grid is not a cage but a foundation for rational relationships. Proportions follow soft mathematical ratios rather than rigid geometric alignment. The work should feel inevitable -- as if no other solution were possible.

Timelessness over novelty. If a solution would have worked in 1957 and will work in 2057, it is likely correct. We do not chase movements or name our approach. The work speaks through its structural soundness and considered restraint.`;

const EMPTY_FIELDS: TasteProfileFields = {
  tone: '',
  depth: '',
  visual_preference: '',
  thinking_style: '',
};

/**
 * Parse a taste profile markdown file with YAML frontmatter.
 * Uses simple string splitting -- no YAML library needed.
 *
 * Format:
 * ---
 * key: value
 * ---
 * body content
 */
export function parseTasteProfileFrontmatter(content: string): TasteProfile {
  const trimmed = content.trim();

  // Check for frontmatter delimiters
  if (!trimmed.startsWith('---')) {
    return {
      fields: { ...EMPTY_FIELDS },
      body: trimmed,
      raw: content,
    };
  }

  // Find the closing --- delimiter (skip the opening one)
  const secondDelimiter = trimmed.indexOf('---', 3);
  if (secondDelimiter === -1) {
    return {
      fields: { ...EMPTY_FIELDS },
      body: trimmed,
      raw: content,
    };
  }

  const frontmatterBlock = trimmed.substring(3, secondDelimiter).trim();
  const body = trimmed.substring(secondDelimiter + 3).trim();

  // Parse key-value pairs from frontmatter
  const fields: TasteProfileFields = { ...EMPTY_FIELDS };
  const lines = frontmatterBlock.split('\n');

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.substring(0, colonIndex).trim();
    const value = line.substring(colonIndex + 1).trim();

    if (key in fields) {
      (fields as Record<string, string>)[key] = value;
    }
  }

  return { fields, body, raw: content };
}

/**
 * Format a parsed taste profile for injection into Claude's system prompt.
 *
 * Output format:
 * Tone: {tone}
 * Depth: {depth}
 * Visual Preference: {visual_preference}
 * Thinking Style: {thinking_style}
 *
 * {body}
 */
export function formatTasteForPrompt(profile: TasteProfile): string {
  const { fields, body } = profile;
  const parts: string[] = [];

  if (fields.tone) parts.push(`Tone: ${fields.tone}`);
  if (fields.depth) parts.push(`Depth: ${fields.depth}`);
  if (fields.visual_preference) parts.push(`Visual Preference: ${fields.visual_preference}`);
  if (fields.thinking_style) parts.push(`Thinking Style: ${fields.thinking_style}`);

  if (body) {
    parts.push('');
    parts.push(body);
  }

  return parts.join('\n');
}

/**
 * Vault adapter interface for reading taste profiles.
 */
interface ReadAdapter {
  exists: (path: string) => Promise<boolean>;
  read: (path: string) => Promise<string>;
}

/**
 * Vault adapter interface for seeding taste profiles.
 */
interface WriteAdapter {
  exists: (path: string) => Promise<boolean>;
  write: (path: string, content: string) => Promise<void>;
  mkdir: (path: string) => Promise<void>;
}

/**
 * Read the taste profile from the vault.
 * If the file doesn't exist, returns the parsed DEFAULT_TASTE_PROFILE.
 */
export async function readTasteProfile(
  vaultAdapter: ReadAdapter,
  path: string
): Promise<TasteProfile> {
  const exists = await vaultAdapter.exists(path);
  if (!exists) {
    return parseTasteProfileFrontmatter(DEFAULT_TASTE_PROFILE);
  }
  const content = await vaultAdapter.read(path);
  return parseTasteProfileFrontmatter(content);
}

/**
 * Seed the taste profile file with DEFAULT_TASTE_PROFILE if it doesn't exist.
 * Creates parent directories as needed.
 */
export async function seedTasteProfile(
  vaultAdapter: WriteAdapter,
  path: string
): Promise<void> {
  const exists = await vaultAdapter.exists(path);
  if (exists) return;

  // Ensure parent directory exists
  const parentDir = path.substring(0, path.lastIndexOf('/'));
  if (parentDir) {
    await vaultAdapter.mkdir(parentDir);
  }

  await vaultAdapter.write(path, DEFAULT_TASTE_PROFILE);
}
