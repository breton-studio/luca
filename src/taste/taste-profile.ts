/**
 * Taste profile module (TAST-01, TAST-02, TAST-03, TAST-06).
 *
 * Manages the global taste profile: a markdown file with nested YAML
 * frontmatter stored at .obsidian/plugins/canvas-ai/taste-profile.md (D-09).
 *
 * Phase 5 (D-01, D-02, D-03, TAST-06): The profile is split into two groups,
 * `style` (how to communicate — tone, voice, formatting) and `substance`
 * (what to communicate — depth, domains, thinking_approach). The parser
 * still accepts the pre-Phase-5 flat format (tone/depth/visual_preference/
 * thinking_style) and migrates it into the nested shape (D-03) so existing
 * profiles load without data loss.
 *
 * Nested format:
 * ---
 * style:
 *   tone: Restrained, considered, unhurried.
 *   voice: Measured and declarative.
 *   formatting: Monochromatic default.
 * substance:
 *   depth: Deep structural analysis.
 *   domains: Architecture, design systems.
 *   thinking_approach: Swiss rational tradition.
 * ---
 * ## Style Philosophy
 * [freeform style body]
 *
 * ## Substance Philosophy
 * [freeform substance body]
 *
 * TAST-04 (per-member profiles) is DEFERRED in Phase 5 per D-08.
 * This module supports a single global profile only. Future phases may
 * add per-member profile switching; if/when that happens, the parser
 * and interface remain unchanged — only the file-path resolution and
 * settings UI would need to branch on the active user identity.
 */

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

/**
 * Default taste profile content seeded on first run (D-10).
 *
 * Nested format preserving the Swiss rational voice from the Phase 3 default.
 */
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

const EMPTY_FIELDS: TasteProfileFields = {
  style: { tone: '', voice: '', formatting: '' },
  substance: { depth: '', domains: '', thinking_approach: '' },
};

function cloneEmptyFields(): TasteProfileFields {
  return {
    style: { ...EMPTY_FIELDS.style },
    substance: { ...EMPTY_FIELDS.substance },
  };
}

const LEGACY_KEYS = ['tone', 'depth', 'visual_preference', 'thinking_style'] as const;
const STYLE_KEYS: ReadonlySet<string> = new Set(['tone', 'voice', 'formatting']);
const SUBSTANCE_KEYS: ReadonlySet<string> = new Set(['depth', 'domains', 'thinking_approach']);

/**
 * Detect whether a frontmatter block uses the legacy flat format.
 *
 * Per RESEARCH.md Pitfall 1: only consider TOP-LEVEL keys (no leading whitespace).
 * If any of the four legacy keys appears at column 0 of the frontmatter, treat
 * the whole block as legacy. This prevents nested frontmatter that happens to
 * contain an indented `tone:` sub-key from being misclassified.
 */
function isLegacyFrontmatter(frontmatterBlock: string): boolean {
  const lines = frontmatterBlock.split('\n');
  for (const line of lines) {
    if (line.startsWith(' ') || line.startsWith('\t')) continue;
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;
    const key = line.substring(0, colonIndex).trim();
    if ((LEGACY_KEYS as readonly string[]).includes(key)) {
      return true;
    }
  }
  return false;
}

/**
 * Migrate a flat legacy frontmatter block into the nested TasteProfileFields
 * shape per D-03.
 *
 * Legacy mapping:
 *   flat.tone              -> nested.style.tone
 *   flat.depth             -> nested.substance.depth
 *   flat.visual_preference -> nested.style.formatting   (NOT style.voice — visual
 *                                                        preference is a formatting
 *                                                        concern, not a vocal tone)
 *   flat.thinking_style    -> nested.substance.thinking_approach
 *
 * Unmapped nested fields (style.voice, substance.domains) are left empty so
 * users can fill them in when they next edit the profile.
 */
function migrateFlatToNested(frontmatterBlock: string): TasteProfileFields {
  const fields = cloneEmptyFields();
  const lines = frontmatterBlock.split('\n');
  for (const line of lines) {
    if (line.startsWith(' ') || line.startsWith('\t')) continue;
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;
    const key = line.substring(0, colonIndex).trim();
    const value = line.substring(colonIndex + 1).trim();
    switch (key) {
      case 'tone':
        fields.style.tone = value;
        break;
      case 'depth':
        fields.substance.depth = value;
        break;
      case 'visual_preference':
        fields.style.formatting = value;
        break;
      case 'thinking_style':
        fields.substance.thinking_approach = value;
        break;
      default:
        // Unknown legacy key — ignore (forward compatibility).
        break;
    }
  }
  return fields;
}

/**
 * Parse a nested frontmatter block (style:/substance: groups with indented
 * sub-fields) into TasteProfileFields.
 */
function parseNestedFrontmatter(frontmatterBlock: string): TasteProfileFields {
  const fields = cloneEmptyFields();
  const lines = frontmatterBlock.split('\n');
  let currentGroup: 'style' | 'substance' | null = null;

  for (const line of lines) {
    if (line.trim() === '') continue;
    const isIndented = line.startsWith(' ') || line.startsWith('\t');
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.substring(0, colonIndex).trim();
    const value = line.substring(colonIndex + 1).trim();

    if (!isIndented) {
      // Top-level key. An empty value signals a group header (style:/substance:).
      if (key === 'style' && value === '') {
        currentGroup = 'style';
      } else if (key === 'substance' && value === '') {
        currentGroup = 'substance';
      } else {
        // Unknown or malformed top-level key — reset group to prevent leakage.
        currentGroup = null;
      }
      continue;
    }

    // Indented sub-field. Assign to the current group if recognized.
    if (currentGroup === 'style' && STYLE_KEYS.has(key)) {
      fields.style[key as keyof TasteStyleFields] = value;
    } else if (currentGroup === 'substance' && SUBSTANCE_KEYS.has(key)) {
      fields.substance[key as keyof TasteSubstanceFields] = value;
    }
  }

  return fields;
}

/**
 * Extract the Style Philosophy and Substance Philosophy body sections
 * from the full body. Returns `{ stylePhilosophy, substancePhilosophy }`.
 *
 * If neither header is present, both return empty strings (the caller keeps
 * the full body in `profile.body` and formatTasteForPrompt falls back to
 * rendering it as a combined trailing block for backward compatibility).
 */
function extractPhilosophySections(body: string): {
  stylePhilosophy: string;
  substancePhilosophy: string;
} {
  const styleHeader = '## Style Philosophy';
  const substanceHeader = '## Substance Philosophy';
  const styleIdx = body.indexOf(styleHeader);
  const substanceIdx = body.indexOf(substanceHeader);

  if (styleIdx === -1 && substanceIdx === -1) {
    return { stylePhilosophy: '', substancePhilosophy: '' };
  }

  let stylePhilosophy = '';
  let substancePhilosophy = '';

  if (styleIdx !== -1) {
    const styleStart = styleIdx + styleHeader.length;
    const styleEnd = substanceIdx !== -1 && substanceIdx > styleIdx ? substanceIdx : body.length;
    stylePhilosophy = body.substring(styleStart, styleEnd).trim();
  }

  if (substanceIdx !== -1) {
    const substanceStart = substanceIdx + substanceHeader.length;
    const substanceEnd = styleIdx !== -1 && styleIdx > substanceIdx ? styleIdx : body.length;
    substancePhilosophy = body.substring(substanceStart, substanceEnd).trim();
  }

  return { stylePhilosophy, substancePhilosophy };
}

/**
 * Parse a taste profile markdown file with YAML frontmatter.
 *
 * Accepts both the nested format (style:/substance: groups) and the legacy
 * flat format (tone/depth/visual_preference/thinking_style). Legacy input is
 * migrated into the nested shape per D-03.
 */
export function parseTasteProfileFrontmatter(content: string): TasteProfile {
  const trimmed = content.trim();

  // No frontmatter — return empty nested fields and treat the whole thing as body.
  if (!trimmed.startsWith('---')) {
    return {
      fields: cloneEmptyFields(),
      body: trimmed,
      stylePhilosophy: '',
      substancePhilosophy: '',
      raw: content,
    };
  }

  const secondDelimiter = trimmed.indexOf('---', 3);
  if (secondDelimiter === -1) {
    return {
      fields: cloneEmptyFields(),
      body: trimmed,
      stylePhilosophy: '',
      substancePhilosophy: '',
      raw: content,
    };
  }

  const frontmatterBlock = trimmed.substring(3, secondDelimiter).trim();
  const body = trimmed.substring(secondDelimiter + 3).trim();

  const fields = isLegacyFrontmatter(frontmatterBlock)
    ? migrateFlatToNested(frontmatterBlock)
    : parseNestedFrontmatter(frontmatterBlock);

  const { stylePhilosophy, substancePhilosophy } = extractPhilosophySections(body);

  return {
    fields,
    body,
    stylePhilosophy,
    substancePhilosophy,
    raw: content,
  };
}

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
 * non-empty, appends body as a combined trailing block for backward compat
 * (covers legacy profiles migrated via D-03 that have unstructured freeform
 * bodies).
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
  if (fields.substance.thinking_approach) {
    parts.push(`Thinking Approach: ${fields.substance.thinking_approach}`);
  }
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
