import {
  detectCompanionContentType,
  createHtmlCompanionContent,
  buildMermaidCompanionContent,
  buildSvgCompanionContent,
  computeCompanionPlacement,
  COMPANION_GAP,
  injectHtmlPreview,
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
    expect(
      detectCompanionContentType('<svg xmlns="http://www.w3.org/2000/svg"><circle r="10"/></svg>', '')
    ).toBe('svg');
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
    expect(buildMermaidCompanionContent('graph\n  A\n  \n')).toBe('```mermaid\ngraph\n  A\n```');
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

// ─── injectHtmlPreview DOM injection (D-13, D-14) ─────────────────────
//
// The test environment is `node`, so we hand-roll the minimum DOM surface
// injectHtmlPreview touches: querySelector, appendChild, empty(), setAttribute,
// and a stand-in `document` with createElement that returns a mock iframe.
//
// Regression coverage for Phase 5 verification: the bug was that when the
// companion node had empty text, `.markdown-rendered` did not exist inside
// nodeEl, so the old fallback created an orphan div at the top of nodeEl and
// the iframe was clipped by Obsidian's canvas CSS. The fix requires the
// caller to seed the node with placeholder text first so Obsidian's markdown
// renderer materializes `.markdown-rendered` before injection.

type MockIframe = {
  tag: string;
  attributes: Record<string, string>;
  srcdoc: string;
  style: { cssText: string };
};

function makeMockEnv() {
  const appended: MockIframe[] = [];

  const container = {
    children: [] as MockIframe[],
    empty: jest.fn(function (this: any) {
      this.children = [];
    }),
    appendChild: jest.fn(function (this: any, child: MockIframe) {
      this.children.push(child);
      appended.push(child);
    }),
  };

  const nodeEl = {
    querySelector: jest.fn((sel: string) =>
      sel === '.markdown-rendered' ? container : null
    ),
  };

  const companionNode = { nodeEl };

  const originalDocument = (global as any).document;
  (global as any).document = {
    createElement: jest.fn((tag: string) => {
      const iframe: MockIframe = {
        tag,
        attributes: {},
        srcdoc: '',
        style: { cssText: '' },
      };
      (iframe as any).setAttribute = (k: string, v: string) => {
        iframe.attributes[k] = v;
      };
      return iframe;
    }),
  };

  const restoreDocument = () => {
    (global as any).document = originalDocument;
  };

  return { companionNode, container, nodeEl, appended, restoreDocument };
}

describe('injectHtmlPreview (D-13, D-14 — security + DOM)', () => {
  test('appends an iframe with sandbox="allow-scripts" when .markdown-rendered exists', () => {
    const env = makeMockEnv();
    injectHtmlPreview(env.companionNode, '<html><body>hi</body></html>');
    // injection is deferred via rAF in the real flow but is synchronous on the
    // first attempt if the container is already present — no rAF needed here.
    expect(env.appended.length).toBe(1);
    const iframe = env.appended[0];
    expect(iframe.tag).toBe('iframe');
    expect(iframe.attributes.sandbox).toBe('allow-scripts');
    expect(iframe.attributes.sandbox).not.toContain('allow-same-origin');
    expect(iframe.srcdoc).toBe('<html><body>hi</body></html>');
    env.restoreDocument();
  });

  test('empties the container before appending to avoid stacking iframes', () => {
    const env = makeMockEnv();
    injectHtmlPreview(env.companionNode, '<html></html>');
    expect(env.container.empty).toHaveBeenCalled();
    env.restoreDocument();
  });

  test('aborts silently when companionNode.nodeEl is missing', () => {
    const env = makeMockEnv();
    const noNodeEl = { nodeEl: undefined };
    expect(() => injectHtmlPreview(noNodeEl, '<html></html>')).not.toThrow();
    expect(env.appended.length).toBe(0);
    env.restoreDocument();
  });

  test('does NOT create an orphan .markdown-rendered div when container is missing (regression)', () => {
    // Repro of the Phase 5 verification bug: when companion has empty text,
    // Obsidian has not rendered `.markdown-rendered` yet. The old fallback
    // created an orphan via nodeEl.createDiv(), which lived at the wrong DOM
    // level and was clipped. Correct behavior: abort injection (the caller is
    // expected to seed placeholder text + defer). The retry path is exercised
    // in the real flow via rAF polling and is not asserted here.
    const appended: MockIframe[] = [];
    const orphanCreateDiv = jest.fn();
    const companionNode = {
      nodeEl: {
        querySelector: jest.fn(() => null),
        createDiv: orphanCreateDiv,
      },
    };
    const originalDocument = (global as any).document;
    (global as any).document = {
      createElement: jest.fn(() => ({
        setAttribute: () => {},
        style: { cssText: '' },
      })),
    };
    injectHtmlPreview(companionNode, '<html></html>');
    expect(orphanCreateDiv).not.toHaveBeenCalled();
    expect(appended.length).toBe(0);
    (global as any).document = originalDocument;
  });
});
