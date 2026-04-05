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

/** Recognizable Mermaid diagram openers used for implicit detection. */
const MERMAID_OPENERS = [
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

/**
 * Detect whether code content should produce a companion render node, and of what type.
 *
 * SVG: lang === 'svg' OR content trimmed starts with <svg (content wins over lang)
 * Mermaid: lang === 'mermaid' OR recognizable mermaid diagram opener
 * HTML: lang in ['html','htm'] OR content trimmed starts with <!DOCTYPE / <html
 * Otherwise: null (no companion)
 *
 * Content-based SVG detection is prioritized over lang-based HTML detection so
 * a mislabeled svg-in-html payload still renders correctly.
 */
export function detectCompanionContentType(
  content: string,
  lang: string | undefined
): CompanionContentType {
  const trimmed = (content ?? '').trim();
  if (!trimmed) return null;
  const normalizedLang = (lang ?? '').toLowerCase();

  // SVG: explicit lang OR markup starts with <svg (content wins over mislabeled lang)
  if (normalizedLang === 'svg' || trimmed.startsWith('<svg')) {
    return 'svg';
  }

  // Mermaid: explicit lang OR recognizable diagram opener
  if (normalizedLang === 'mermaid') return 'mermaid';
  if (MERMAID_OPENERS.some((opener) => trimmed.startsWith(opener))) {
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

  // Already a full HTML document -- leave unchanged
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
  if (!trimmed.trim()) return '';
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
 *  - sandbox = "allow-scripts" ONLY (never allow-same-origin -- defeats the sandbox)
 *  - srcdoc set via DOM property, NOT HTML attribute (avoids escaping pitfalls)
 *
 * NOT unit-tested: depends on a live canvas node DOM. Verified manually in Plan 06.
 */
export function injectHtmlPreview(companionNode: any, htmlContent: string): void {
  const nodeEl = companionNode?.nodeEl;
  if (!nodeEl) return;

  // Find the markdown-rendered container or create one as fallback
  const existing = nodeEl.querySelector?.('.markdown-rendered');
  const container =
    existing ?? (typeof nodeEl.createDiv === 'function' ? nodeEl.createDiv({ cls: 'markdown-rendered' }) : null);
  if (!container) return;
  if (typeof container.empty === 'function') container.empty();
  else container.innerHTML = '';

  const iframe = document.createElement('iframe');
  iframe.setAttribute('sandbox', 'allow-scripts'); // CRITICAL: never allow-same-origin
  iframe.setAttribute('aria-label', 'Code preview');
  // srcdoc via DOM property -- handles escaping internally (Pitfall 3)
  iframe.srcdoc = htmlContent;
  iframe.style.cssText =
    'width:100%;height:100%;border:none;background:var(--background-primary);';

  container.appendChild(iframe);
}
