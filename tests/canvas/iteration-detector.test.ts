/**
 * Tests for the iteration-detector module (Phase 5 gap closure).
 *
 * The detector is a pure function: given the current trigger node, all
 * canvas nodes, all edges, and the aiNodeIds set, it determines whether
 * the trigger is an "iteration request" (has one or more incoming edges
 * from AI-created nodes) and, if so, returns a populated IterationContext.
 */

import {
  detectIterationContext,
  classifyAiNode,
  IterationContext,
  IterationSource,
} from '../../src/canvas/iteration-detector';
import type { CanvasNodeInfo } from '../../src/types/canvas';
import type { CanvasEdgeInfo } from '../../src/spatial/types';

// ---------- Test fixtures ----------

function makeNode(
  id: string,
  opts: Partial<CanvasNodeInfo> = {}
): CanvasNodeInfo {
  const node: CanvasNodeInfo = {
    id,
    type: 'text',
    x: 0,
    y: 0,
    width: 300,
    height: 200,
    content: '',
    ...opts,
  };
  return node;
}

function makeEdge(id: string, fromNode: string, toNode: string): CanvasEdgeInfo {
  return { id, fromNode, toNode };
}

const CODE_TS_CONTENT = '```typescript\nconst x: number = 1;\nconsole.log(x);\n```';
const CODE_HTML_CONTENT = '```html\n<!DOCTYPE html>\n<html></html>\n```';
const CODE_NOLANG_CONTENT = '```\nplain code without lang\n```';
const MERMAID_CONTENT = '```mermaid\ngraph TD\n  A --> B\n```';
const TEXT_CONTENT = 'This is a plain markdown paragraph with no fences.';

// ---------- classifyAiNode ----------

describe('classifyAiNode', () => {
  test('returns null when node is not in aiNodeIds', () => {
    const node = makeNode('n1', { content: CODE_TS_CONTENT });
    const aiNodeIds = new Set<string>(); // empty
    expect(classifyAiNode(node, aiNodeIds)).toBeNull();
  });

  test('classifies a fenced TypeScript code block as type=code with lang', () => {
    const node = makeNode('n1', { content: CODE_TS_CONTENT });
    const aiNodeIds = new Set<string>(['n1']);
    const result = classifyAiNode(node, aiNodeIds);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('code');
    expect(result!.lang).toBe('typescript');
    expect(result!.content).toContain('const x: number = 1;');
    expect(result!.content).not.toContain('```');
  });

  test('classifies a fenced HTML code block as type=code lang=html', () => {
    const node = makeNode('n1', { content: CODE_HTML_CONTENT });
    const aiNodeIds = new Set<string>(['n1']);
    const result = classifyAiNode(node, aiNodeIds);
    expect(result!.type).toBe('code');
    expect(result!.lang).toBe('html');
  });

  test('classifies a fenced code block with no lang marker as type=code lang=undefined', () => {
    const node = makeNode('n1', { content: CODE_NOLANG_CONTENT });
    const aiNodeIds = new Set<string>(['n1']);
    const result = classifyAiNode(node, aiNodeIds);
    expect(result!.type).toBe('code');
    expect(result!.lang).toBeUndefined();
    expect(result!.content).toContain('plain code without lang');
  });

  test('classifies a fenced mermaid block as type=mermaid (not code)', () => {
    const node = makeNode('n1', { content: MERMAID_CONTENT });
    const aiNodeIds = new Set<string>(['n1']);
    const result = classifyAiNode(node, aiNodeIds);
    expect(result!.type).toBe('mermaid');
    expect(result!.lang).toBeUndefined();
    expect(result!.content).toContain('graph TD');
    expect(result!.content).not.toContain('```');
  });

  test('classifies a file node with .png extension as type=image', () => {
    const node = makeNode('n1', {
      type: 'file',
      content: 'canvas-ai-images/2026-04-05_a1b2c3.png',
    });
    const aiNodeIds = new Set<string>(['n1']);
    const result = classifyAiNode(node, aiNodeIds);
    expect(result!.type).toBe('image');
    expect(result!.content).toBe('canvas-ai-images/2026-04-05_a1b2c3.png');
  });

  test('classifies file nodes with other image extensions (.jpg, .jpeg, .webp)', () => {
    const aiNodeIds = new Set<string>(['n1']);
    for (const ext of ['jpg', 'jpeg', 'webp', 'gif']) {
      const node = makeNode('n1', { type: 'file', content: `foo/bar.${ext}` });
      const result = classifyAiNode(node, aiNodeIds);
      expect(result?.type).toBe('image');
    }
  });

  test('classifies a plain markdown node (no fences) as type=text', () => {
    const node = makeNode('n1', { content: TEXT_CONTENT });
    const aiNodeIds = new Set<string>(['n1']);
    const result = classifyAiNode(node, aiNodeIds);
    expect(result!.type).toBe('text');
    expect(result!.lang).toBeUndefined();
    expect(result!.content).toBe(TEXT_CONTENT);
  });

  test('classifies file node with non-image extension as type=text (fallback)', () => {
    const node = makeNode('n1', { type: 'file', content: 'notes/some.md' });
    const aiNodeIds = new Set<string>(['n1']);
    const result = classifyAiNode(node, aiNodeIds);
    // .md is not an image; fall through to text
    expect(result?.type).toBe('text');
  });
});

// ---------- detectIterationContext ----------

describe('detectIterationContext', () => {
  // -- Non-iteration cases (must return null) --

  test('returns null when trigger node is not found in nodes array', () => {
    const result = detectIterationContext({
      triggerNodeId: 'missing',
      nodes: [makeNode('n1', { content: 'hello' })],
      edges: [],
      aiNodeIds: new Set(['n1']),
    });
    expect(result).toBeNull();
  });

  test('returns null when trigger is itself in aiNodeIds (defense-in-depth)', () => {
    const result = detectIterationContext({
      triggerNodeId: 'ai1',
      nodes: [makeNode('ai1', { content: 'some content' })],
      edges: [],
      aiNodeIds: new Set(['ai1']),
    });
    expect(result).toBeNull();
  });

  test('returns null when trigger content is empty', () => {
    const trigger = makeNode('t1', { content: '' });
    const ai = makeNode('ai1', { content: CODE_TS_CONTENT });
    const result = detectIterationContext({
      triggerNodeId: 't1',
      nodes: [trigger, ai],
      edges: [makeEdge('e1', 'ai1', 't1')],
      aiNodeIds: new Set(['ai1']),
    });
    expect(result).toBeNull();
  });

  test('returns null when trigger content is whitespace-only', () => {
    const trigger = makeNode('t1', { content: '   \n\t  ' });
    const ai = makeNode('ai1', { content: CODE_TS_CONTENT });
    const result = detectIterationContext({
      triggerNodeId: 't1',
      nodes: [trigger, ai],
      edges: [makeEdge('e1', 'ai1', 't1')],
      aiNodeIds: new Set(['ai1']),
    });
    expect(result).toBeNull();
  });

  test('returns null when trigger has zero incoming edges', () => {
    const trigger = makeNode('t1', { content: 'refine please' });
    const ai = makeNode('ai1', { content: CODE_TS_CONTENT });
    const result = detectIterationContext({
      triggerNodeId: 't1',
      nodes: [trigger, ai],
      edges: [], // no edges
      aiNodeIds: new Set(['ai1']),
    });
    expect(result).toBeNull();
  });

  test('returns null when incoming edge source is not in aiNodeIds (user-to-user edge)', () => {
    const trigger = makeNode('t1', { content: 'refine' });
    const userNode = makeNode('u1', { content: 'some user content' });
    const result = detectIterationContext({
      triggerNodeId: 't1',
      nodes: [trigger, userNode],
      edges: [makeEdge('e1', 'u1', 't1')],
      aiNodeIds: new Set(), // u1 is NOT AI
    });
    expect(result).toBeNull();
  });

  test('ignores outgoing edges from the trigger (only uses incoming)', () => {
    const trigger = makeNode('t1', { content: 'refine' });
    const ai = makeNode('ai1', { content: CODE_TS_CONTENT });
    // Edge direction: trigger → ai (outgoing), NOT ai → trigger
    const result = detectIterationContext({
      triggerNodeId: 't1',
      nodes: [trigger, ai],
      edges: [makeEdge('e1', 't1', 'ai1')],
      aiNodeIds: new Set(['ai1']),
    });
    expect(result).toBeNull();
  });

  // -- Single-source positive cases --

  test('returns IterationContext for single AI code source', () => {
    const trigger = makeNode('t1', { content: 'make the function async' });
    const ai = makeNode('ai1', {
      content: CODE_TS_CONTENT,
      x: 100,
      y: 100,
      width: 400,
      height: 250,
    });
    const result = detectIterationContext({
      triggerNodeId: 't1',
      nodes: [trigger, ai],
      edges: [makeEdge('e1', 'ai1', 't1')],
      aiNodeIds: new Set(['ai1']),
    });
    expect(result).not.toBeNull();
    expect(result!.primarySource.type).toBe('code');
    expect(result!.primarySource.lang).toBe('typescript');
    expect(result!.primarySource.node.id).toBe('ai1');
    expect(result!.additionalSources).toEqual([]);
    expect(result!.triggerTextNode.id).toBe('t1');
    expect(result!.userInstructions).toBe('make the function async');
    expect(result!.targetType).toBe('code');
    expect(result!.targetLang).toBe('typescript');
  });

  test('returns IterationContext for single AI mermaid source', () => {
    const trigger = makeNode('t1', { content: 'add a cache node' });
    const ai = makeNode('ai1', { content: MERMAID_CONTENT });
    const result = detectIterationContext({
      triggerNodeId: 't1',
      nodes: [trigger, ai],
      edges: [makeEdge('e1', 'ai1', 't1')],
      aiNodeIds: new Set(['ai1']),
    });
    expect(result!.targetType).toBe('mermaid');
    expect(result!.targetLang).toBeUndefined();
  });

  test('returns IterationContext for single AI text source', () => {
    const trigger = makeNode('t1', { content: 'rewrite in the style of X' });
    const ai = makeNode('ai1', { content: TEXT_CONTENT });
    const result = detectIterationContext({
      triggerNodeId: 't1',
      nodes: [trigger, ai],
      edges: [makeEdge('e1', 'ai1', 't1')],
      aiNodeIds: new Set(['ai1']),
    });
    expect(result!.targetType).toBe('text');
  });

  test('returns IterationContext for single AI image source', () => {
    const trigger = makeNode('t1', { content: 'make it at dusk' });
    const ai = makeNode('ai1', {
      type: 'file',
      content: 'canvas-ai-images/img.png',
    });
    const result = detectIterationContext({
      triggerNodeId: 't1',
      nodes: [trigger, ai],
      edges: [makeEdge('e1', 'ai1', 't1')],
      aiNodeIds: new Set(['ai1']),
    });
    expect(result!.targetType).toBe('image');
    expect(result!.primarySource.content).toBe('canvas-ai-images/img.png');
  });

  test('trims userInstructions whitespace', () => {
    const trigger = makeNode('t1', { content: '\n  refine this \t\n' });
    const ai = makeNode('ai1', { content: CODE_TS_CONTENT });
    const result = detectIterationContext({
      triggerNodeId: 't1',
      nodes: [trigger, ai],
      edges: [makeEdge('e1', 'ai1', 't1')],
      aiNodeIds: new Set(['ai1']),
    });
    expect(result!.userInstructions).toBe('refine this');
  });

  // -- Multi-source merge cases --

  test('multi-source: picks MOST RECENTLY created AI node as primary (aiNodeIds insertion order)', () => {
    const trigger = makeNode('t1', { content: 'combine these' });
    const older = makeNode('ai1', { content: CODE_TS_CONTENT });
    const newer = makeNode('ai2', { content: CODE_HTML_CONTENT });
    // Insertion order in aiNodeIds: ai1 first, ai2 second → ai2 is most recent
    const aiNodeIds = new Set(['ai1', 'ai2']);
    const result = detectIterationContext({
      triggerNodeId: 't1',
      nodes: [trigger, older, newer],
      edges: [
        makeEdge('e1', 'ai1', 't1'),
        makeEdge('e2', 'ai2', 't1'),
      ],
      aiNodeIds,
    });
    expect(result!.primarySource.node.id).toBe('ai2');
    expect(result!.primarySource.lang).toBe('html');
    expect(result!.additionalSources).toHaveLength(1);
    expect(result!.additionalSources[0].node.id).toBe('ai1');
    expect(result!.additionalSources[0].lang).toBe('typescript');
  });

  test('multi-source mixed types: primary is most recent regardless of type', () => {
    const trigger = makeNode('t1', { content: 'synthesize' });
    const codeAi = makeNode('ai1', { content: CODE_TS_CONTENT });
    const textAi = makeNode('ai2', { content: TEXT_CONTENT });
    const mermaidAi = makeNode('ai3', { content: MERMAID_CONTENT });
    // Insertion order: code (oldest), text, mermaid (newest)
    const aiNodeIds = new Set(['ai1', 'ai2', 'ai3']);
    const result = detectIterationContext({
      triggerNodeId: 't1',
      nodes: [trigger, codeAi, textAi, mermaidAi],
      edges: [
        makeEdge('e1', 'ai1', 't1'),
        makeEdge('e2', 'ai2', 't1'),
        makeEdge('e3', 'ai3', 't1'),
      ],
      aiNodeIds,
    });
    expect(result!.primarySource.type).toBe('mermaid');
    expect(result!.targetType).toBe('mermaid');
    expect(result!.additionalSources).toHaveLength(2);
    // Additional sources ordered most-recent-first: text then code
    expect(result!.additionalSources[0].type).toBe('text');
    expect(result!.additionalSources[1].type).toBe('code');
  });

  test('skips edges where the source node is not found in nodes array', () => {
    const trigger = makeNode('t1', { content: 'iterate' });
    const ai = makeNode('ai1', { content: CODE_TS_CONTENT });
    const aiNodeIds = new Set(['ai1', 'ghost']); // ghost is in set but not in nodes
    const result = detectIterationContext({
      triggerNodeId: 't1',
      nodes: [trigger, ai],
      edges: [
        makeEdge('e1', 'ai1', 't1'),
        makeEdge('e2', 'ghost', 't1'),
      ],
      aiNodeIds,
    });
    // ghost is silently skipped; ai1 is still the primary
    expect(result).not.toBeNull();
    expect(result!.primarySource.node.id).toBe('ai1');
    expect(result!.additionalSources).toHaveLength(0);
  });

  // Companion redirection: when the user draws an edge from a Phase 5
  // companion render node (the rendered visual), the iteration should
  // target the UNDERLYING code node the companion belongs to. The
  // companion's `companionOf` marker points at its code source.
  describe('companion-to-code redirection', () => {
    test('redirects HTML companion source to the underlying code node', () => {
      const trigger = makeNode('t1', { content: 'make the circle red' });
      const codeNode = makeNode('code1', {
        content: CODE_HTML_CONTENT,
        x: 0,
        y: 0,
        width: 400,
        height: 250,
      });
      // HTML companion: text is NBSP (empty-ish), marker points at code1
      const companionNode = makeNode('comp1', {
        content: '\u00a0',
        x: 424,
        y: 0,
        width: 400,
        height: 250,
        companionOf: 'code1',
      });
      const result = detectIterationContext({
        triggerNodeId: 't1',
        nodes: [trigger, codeNode, companionNode],
        edges: [makeEdge('e1', 'comp1', 't1')], // edge FROM companion
        aiNodeIds: new Set(['code1', 'comp1']),
      });
      expect(result).not.toBeNull();
      // Primary source should be the CODE node, not the companion
      expect(result!.primarySource.node.id).toBe('code1');
      expect(result!.primarySource.type).toBe('code');
      expect(result!.primarySource.lang).toBe('html');
      expect(result!.targetType).toBe('code');
    });

    test('redirects mermaid companion source to the underlying code node', () => {
      // Mermaid companion's text IS a mermaid fence; without redirection it
      // would misclassify as a mermaid iteration. With redirection, the
      // underlying code (with lang=mermaid or a flow description) iterates.
      const trigger = makeNode('t1', { content: 'add a cache node' });
      const codeNode = makeNode('code1', {
        content: '```mermaid\ngraph TD\n  A --> B\n```',
      });
      const companionNode = makeNode('comp1', {
        content: '```mermaid\ngraph TD\n  A --> B\n```',
        companionOf: 'code1',
      });
      const result = detectIterationContext({
        triggerNodeId: 't1',
        nodes: [trigger, codeNode, companionNode],
        edges: [makeEdge('e1', 'comp1', 't1')],
        aiNodeIds: new Set(['code1', 'comp1']),
      });
      expect(result!.primarySource.node.id).toBe('code1');
      expect(result!.primarySource.type).toBe('mermaid');
    });

    test('redirects SVG companion source to the underlying code node', () => {
      const trigger = makeNode('t1', { content: 'make the gear bigger' });
      const codeNode = makeNode('code1', {
        content: '```svg\n<svg><circle r="10"/></svg>\n```',
      });
      const companionNode = makeNode('comp1', {
        content: '<svg><circle r="10"/></svg>',
        companionOf: 'code1',
      });
      const result = detectIterationContext({
        triggerNodeId: 't1',
        nodes: [trigger, codeNode, companionNode],
        edges: [makeEdge('e1', 'comp1', 't1')],
        aiNodeIds: new Set(['code1', 'comp1']),
      });
      expect(result!.primarySource.node.id).toBe('code1');
      expect(result!.primarySource.type).toBe('code');
      expect(result!.primarySource.lang).toBe('svg');
    });

    test('edge from companion OR edge from underlying code produce same iteration target', () => {
      const trigger = makeNode('t1', { content: 'iterate' });
      const codeNode = makeNode('code1', { content: CODE_HTML_CONTENT });
      const companionNode = makeNode('comp1', {
        content: '\u00a0',
        companionOf: 'code1',
      });
      const fromCompanion = detectIterationContext({
        triggerNodeId: 't1',
        nodes: [trigger, codeNode, companionNode],
        edges: [makeEdge('e1', 'comp1', 't1')],
        aiNodeIds: new Set(['code1', 'comp1']),
      });
      const fromCode = detectIterationContext({
        triggerNodeId: 't1',
        nodes: [trigger, codeNode, companionNode],
        edges: [makeEdge('e2', 'code1', 't1')],
        aiNodeIds: new Set(['code1', 'comp1']),
      });
      expect(fromCompanion!.primarySource.node.id).toBe('code1');
      expect(fromCode!.primarySource.node.id).toBe('code1');
      expect(fromCompanion!.primarySource.lang).toBe(fromCode!.primarySource.lang);
      expect(fromCompanion!.targetType).toBe(fromCode!.targetType);
    });

    test('redirects before multi-source deduplication: edges from code AND its companion do not produce two sources', () => {
      const trigger = makeNode('t1', { content: 'iterate' });
      const codeNode = makeNode('code1', { content: CODE_HTML_CONTENT });
      const companionNode = makeNode('comp1', {
        content: '\u00a0',
        companionOf: 'code1',
      });
      const result = detectIterationContext({
        triggerNodeId: 't1',
        nodes: [trigger, codeNode, companionNode],
        edges: [
          makeEdge('e1', 'code1', 't1'), // direct edge
          makeEdge('e2', 'comp1', 't1'), // edge via companion (redirects to code1)
        ],
        aiNodeIds: new Set(['code1', 'comp1']),
      });
      // Both edges point at code1 after redirection → single source
      expect(result).not.toBeNull();
      expect(result!.primarySource.node.id).toBe('code1');
      expect(result!.additionalSources).toHaveLength(0);
    });

    test('falls back to the companion node when its source code is no longer present', () => {
      // User deleted the code node but kept the companion. The redirection
      // should fall back to treating the companion itself as the source
      // (it is still in aiNodeIds) rather than dropping the edge entirely.
      const trigger = makeNode('t1', { content: 'iterate' });
      const companionNode = makeNode('comp1', {
        content: '\u00a0',
        companionOf: 'code1', // code1 no longer in the nodes array
      });
      const result = detectIterationContext({
        triggerNodeId: 't1',
        nodes: [trigger, companionNode],
        edges: [makeEdge('e1', 'comp1', 't1')],
        aiNodeIds: new Set(['comp1']),
      });
      // Companion content is NBSP which classifies as text
      expect(result).not.toBeNull();
      expect(result!.primarySource.node.id).toBe('comp1');
    });
  });
});
