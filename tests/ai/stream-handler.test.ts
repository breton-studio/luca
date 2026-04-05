import {
  streamIntoNode,
  parseNodeContent,
  StreamCallbacks,
  StreamResult,
  MAX_OUTPUT_TOKENS,
} from '../../src/ai/stream-handler';
import type { TypedNodeMeta } from '../../src/types/generation';
import { MockStream, MockAnthropicClient, createMockClientWithStream } from '../__mocks__/anthropic';
import { BUFFER_INTERVAL_MS } from '../../src/types/settings';

// Mock the Anthropic SDK to avoid actual imports
jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: jest.fn(),
  };
});

describe('stream-handler', () => {
  let callbacks: StreamCallbacks & {
    textUpdates: Array<{ text: string; meta: TypedNodeMeta }>;
    boundaryEvents: Array<{ content: string; index: number; meta: TypedNodeMeta }>;
    firstTokenCalled: boolean;
    timeoutCalled: boolean;
  };

  beforeEach(() => {
    jest.useFakeTimers();
    callbacks = {
      textUpdates: [],
      boundaryEvents: [],
      firstTokenCalled: false,
      timeoutCalled: false,
      onFirstToken: jest.fn(() => {
        callbacks.firstTokenCalled = true;
      }),
      onTextUpdate: jest.fn((text: string, meta: TypedNodeMeta) => {
        callbacks.textUpdates.push({ text, meta });
      }),
      onTimeout: jest.fn(() => {
        callbacks.timeoutCalled = true;
      }),
      onNodeBoundary: jest.fn((content: string, index: number, meta: TypedNodeMeta) => {
        callbacks.boundaryEvents.push({ content, index, meta });
      }),
    };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('streamIntoNode', () => {
    test('accumulates text deltas into a single string', async () => {
      const { client, stream } = createMockClientWithStream(
        ['Hello', ' ', 'world'],
        { input_tokens: 10, output_tokens: 5 }
      );

      const signal = new AbortController().signal;

      // Start stream, simulate deltas, then resolve
      const resultPromise = streamIntoNode(
        client as any,
        [{ type: 'text', text: 'system prompt' }],
        'user message',
        signal,
        callbacks
      );

      // Emit text deltas
      stream.emitText('Hello');
      stream.emitText(' ');
      stream.emitText('world');

      // Advance timers for any buffer flush
      jest.advanceTimersByTime(BUFFER_INTERVAL_MS + 10);

      const result = await resultPromise;
      expect(result.text).toContain('Hello world');
    });

    test('calls onTextUpdate callback at BUFFER_INTERVAL_MS intervals (not on every delta)', async () => {
      const { client, stream } = createMockClientWithStream(
        [],
        { input_tokens: 10, output_tokens: 5 }
      );

      const signal = new AbortController().signal;

      const resultPromise = streamIntoNode(
        client as any,
        [{ type: 'text', text: 'system prompt' }],
        'user message',
        signal,
        callbacks
      );

      // Emit rapid deltas without advancing timers
      stream.emitText('<node>');
      stream.emitText('Hello');
      stream.emitText(' ');
      stream.emitText('world');

      // No timer advance yet - should not have called onTextUpdate for buffered content
      const callsBefore = (callbacks.onTextUpdate as jest.Mock).mock.calls.length;

      // Advance past buffer interval
      jest.advanceTimersByTime(BUFFER_INTERVAL_MS + 10);

      // Should have flushed
      const callsAfter = (callbacks.onTextUpdate as jest.Mock).mock.calls.length;
      expect(callsAfter).toBeGreaterThan(callsBefore);

      // Complete the stream
      stream.emitText('</node>');
      jest.advanceTimersByTime(BUFFER_INTERVAL_MS + 10);

      const result = await resultPromise;
      expect(result).toBeDefined();
    });

    test('calls onFirstToken callback exactly once on first text delta', async () => {
      const { client, stream } = createMockClientWithStream(
        [],
        { input_tokens: 10, output_tokens: 5 }
      );

      const signal = new AbortController().signal;

      const resultPromise = streamIntoNode(
        client as any,
        [{ type: 'text', text: 'system prompt' }],
        'user message',
        signal,
        callbacks
      );

      stream.emitText('First');
      stream.emitText(' delta');
      stream.emitText(' third');
      jest.advanceTimersByTime(BUFFER_INTERVAL_MS + 10);

      const result = await resultPromise;

      expect(callbacks.onFirstToken).toHaveBeenCalledTimes(1);
    });

    test('returns StreamResult with accumulated text and usage data', async () => {
      const usage = { input_tokens: 150, output_tokens: 75 };
      const { client, stream } = createMockClientWithStream([], usage);

      const signal = new AbortController().signal;

      const resultPromise = streamIntoNode(
        client as any,
        [{ type: 'text', text: 'system prompt' }],
        'user message',
        signal,
        callbacks
      );

      stream.emitText('<node>Some content</node>');
      jest.advanceTimersByTime(BUFFER_INTERVAL_MS + 10);

      const result = await resultPromise;

      expect(result.usage).toEqual(usage);
      expect(result.nodeContents).toEqual(['Some content']);
    });

    test('stops processing when signal.aborted is true', async () => {
      const { client, stream } = createMockClientWithStream(
        [],
        { input_tokens: 10, output_tokens: 5 }
      );

      const controller = new AbortController();
      const signal = controller.signal;

      const resultPromise = streamIntoNode(
        client as any,
        [{ type: 'text', text: 'system prompt' }],
        'user message',
        signal,
        callbacks
      );

      stream.emitText('before abort');
      controller.abort();
      stream.emitText(' after abort');
      jest.advanceTimersByTime(BUFFER_INTERVAL_MS + 10);

      const result = await resultPromise;

      // The text after abort should not be included
      expect(result.text).not.toContain('after abort');
    });

    test('watchdog timer calls onTimeout after 30000ms of no text deltas', async () => {
      const { client, stream } = createMockClientWithStream(
        [],
        { input_tokens: 10, output_tokens: 5 }
      );

      const signal = new AbortController().signal;

      // Don't await - we need to control timing
      const resultPromise = streamIntoNode(
        client as any,
        [{ type: 'text', text: 'system prompt' }],
        'user message',
        signal,
        callbacks
      );

      // Emit one delta to start the watchdog
      stream.emitText('start');

      // Advance to just before timeout
      jest.advanceTimersByTime(29_999);
      expect(callbacks.onTimeout).not.toHaveBeenCalled();

      // Advance past timeout
      jest.advanceTimersByTime(2);
      expect(callbacks.onTimeout).toHaveBeenCalledTimes(1);

      // Let the promise resolve
      jest.advanceTimersByTime(BUFFER_INTERVAL_MS + 10);
      const result = await resultPromise;
      expect(result).toBeDefined();
    });

    test('watchdog timer resets on each text delta', async () => {
      const { client, stream } = createMockClientWithStream(
        [],
        { input_tokens: 10, output_tokens: 5 }
      );

      const signal = new AbortController().signal;

      const resultPromise = streamIntoNode(
        client as any,
        [{ type: 'text', text: 'system prompt' }],
        'user message',
        signal,
        callbacks
      );

      stream.emitText('first');
      jest.advanceTimersByTime(20_000); // 20s elapsed

      // New delta resets watchdog
      stream.emitText(' second');
      jest.advanceTimersByTime(20_000); // 20s from last delta -- still under 30s

      expect(callbacks.onTimeout).not.toHaveBeenCalled();

      // Now wait full 30s from last delta
      jest.advanceTimersByTime(10_001);
      expect(callbacks.onTimeout).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(BUFFER_INTERVAL_MS + 10);
      const result = await resultPromise;
      expect(result).toBeDefined();
    });
  });

  describe('parseNodeContent', () => {
    test('splits response text on node delimiters into string array', () => {
      const text = '<node>First content</node>\n\n<node>Second content</node>';
      const result = parseNodeContent(text);
      expect(result).toEqual(['First content', 'Second content']);
    });

    test('returns single-element array when no delimiters present', () => {
      const text = 'Just plain text without any delimiters';
      const result = parseNodeContent(text);
      expect(result).toEqual(['Just plain text without any delimiters']);
    });

    test('trims whitespace from each node content', () => {
      const text = '<node>  \n  Content with whitespace  \n  </node>';
      const result = parseNodeContent(text);
      expect(result).toEqual(['Content with whitespace']);
    });
  });

  describe('node boundary detection', () => {
    test('onNodeBoundary is called when </node><node> boundary is detected mid-stream', async () => {
      const { client, stream } = createMockClientWithStream(
        [],
        { input_tokens: 10, output_tokens: 5 }
      );

      const signal = new AbortController().signal;

      const resultPromise = streamIntoNode(
        client as any,
        [{ type: 'text', text: 'system prompt' }],
        'user message',
        signal,
        callbacks
      );

      // Simulate multi-node streaming
      stream.emitText('<node>');
      stream.emitText('First content');
      stream.emitText('</node>');
      jest.advanceTimersByTime(BUFFER_INTERVAL_MS + 10);

      stream.emitText('\n\n');
      stream.emitText('<node>');
      stream.emitText('Second content');
      stream.emitText('</node>');
      jest.advanceTimersByTime(BUFFER_INTERVAL_MS + 10);

      const result = await resultPromise;

      expect(callbacks.onNodeBoundary).toHaveBeenCalledWith('First content', 0, expect.objectContaining({ type: 'text' }));
      expect(callbacks.boundaryEvents[0]).toEqual(expect.objectContaining({ content: 'First content', index: 0 }));
    });

    test('onTextUpdate receives only the current node visible content (tags stripped)', async () => {
      const { client, stream } = createMockClientWithStream(
        [],
        { input_tokens: 10, output_tokens: 5 }
      );

      const signal = new AbortController().signal;

      const resultPromise = streamIntoNode(
        client as any,
        [{ type: 'text', text: 'system prompt' }],
        'user message',
        signal,
        callbacks
      );

      stream.emitText('<node>visible text');
      jest.advanceTimersByTime(BUFFER_INTERVAL_MS + 10);

      // Check that the flushed text does not contain <node> tags
      const lastUpdate = callbacks.textUpdates[callbacks.textUpdates.length - 1];
      expect(lastUpdate.text).not.toContain('<node>');
      expect(lastUpdate.text).not.toContain('</node>');
      expect(lastUpdate.text).toContain('visible text');

      stream.emitText('</node>');
      jest.advanceTimersByTime(BUFFER_INTERVAL_MS + 10);

      const result = await resultPromise;
      expect(result).toBeDefined();
    });

    test('after a node boundary, onTextUpdate flushes text for the NEW node', async () => {
      const { client, stream } = createMockClientWithStream(
        [],
        { input_tokens: 10, output_tokens: 5 }
      );

      const signal = new AbortController().signal;

      const resultPromise = streamIntoNode(
        client as any,
        [{ type: 'text', text: 'system prompt' }],
        'user message',
        signal,
        callbacks
      );

      // First node
      stream.emitText('<node>First node content</node>');
      jest.advanceTimersByTime(BUFFER_INTERVAL_MS + 10);

      // Second node
      stream.emitText('\n\n<node>Second node content');
      jest.advanceTimersByTime(BUFFER_INTERVAL_MS + 10);

      // The most recent text update should contain second node content, not first
      const lastUpdate = callbacks.textUpdates[callbacks.textUpdates.length - 1];
      expect(lastUpdate.text).toContain('Second node content');
      expect(lastUpdate.text).not.toContain('First node content');

      stream.emitText('</node>');
      jest.advanceTimersByTime(BUFFER_INTERVAL_MS + 10);

      const result = await resultPromise;
      expect(result).toBeDefined();
    });
  });

  describe('typed node parsing', () => {
    describe('parseNodeContent with typed tags', () => {
      test('parses <node type="text"> content', () => {
        const text = '<node type="text">hello</node>';
        const result = parseNodeContent(text);
        expect(result).toEqual(['hello']);
      });

      test('parses <node type="code" lang="typescript"> content', () => {
        const text = '<node type="code" lang="typescript">const x = 1;</node>';
        const result = parseNodeContent(text);
        expect(result).toEqual(['const x = 1;']);
      });

      test('parses <node type="mermaid"> content', () => {
        const text = '<node type="mermaid">graph TD\n  A-->B</node>';
        const result = parseNodeContent(text);
        expect(result).toEqual(['graph TD\n  A-->B']);
      });

      test('parses <node type="image"> content', () => {
        const text = '<node type="image">a sunset over mountains</node>';
        const result = parseNodeContent(text);
        expect(result).toEqual(['a sunset over mountains']);
      });

      test('parses mixed types and returns all contents in order', () => {
        const text = [
          '<node type="text">Some explanation</node>',
          '<node type="code" lang="python">print("hello")</node>',
          '<node type="mermaid">graph LR\n  A-->B</node>',
        ].join('\n\n');
        const result = parseNodeContent(text);
        expect(result).toEqual([
          'Some explanation',
          'print("hello")',
          'graph LR\n  A-->B',
        ]);
      });

      test('backward compat: untyped <node> tags still work', () => {
        const text = '<node>First content</node>\n\n<node>Second content</node>';
        const result = parseNodeContent(text);
        expect(result).toEqual(['First content', 'Second content']);
      });

      test('backward compat: no tags returns [entireText]', () => {
        const text = 'Just plain text without any delimiters';
        const result = parseNodeContent(text);
        expect(result).toEqual(['Just plain text without any delimiters']);
      });
    });

    describe('onNodeBoundary with typed metadata', () => {
      test('receives TypedNodeMeta { type: "code", lang: "typescript" } for code nodes', async () => {
        const { client, stream } = createMockClientWithStream(
          [],
          { input_tokens: 10, output_tokens: 5 }
        );

        const signal = new AbortController().signal;

        const resultPromise = streamIntoNode(
          client as any,
          [{ type: 'text', text: 'system prompt' }],
          'user message',
          signal,
          callbacks
        );

        stream.emitText('<node type="code" lang="typescript">const x = 1;</node>');
        jest.advanceTimersByTime(BUFFER_INTERVAL_MS + 10);

        const result = await resultPromise;

        expect(callbacks.boundaryEvents.length).toBeGreaterThanOrEqual(1);
        expect(callbacks.boundaryEvents[0].meta).toEqual({ type: 'code', lang: 'typescript' });
      });

      test('receives TypedNodeMeta { type: "mermaid" } (no lang) for mermaid nodes', async () => {
        const { client, stream } = createMockClientWithStream(
          [],
          { input_tokens: 10, output_tokens: 5 }
        );

        const signal = new AbortController().signal;

        const resultPromise = streamIntoNode(
          client as any,
          [{ type: 'text', text: 'system prompt' }],
          'user message',
          signal,
          callbacks
        );

        stream.emitText('<node type="mermaid">graph TD\n  A-->B</node>');
        jest.advanceTimersByTime(BUFFER_INTERVAL_MS + 10);

        const result = await resultPromise;

        expect(callbacks.boundaryEvents.length).toBeGreaterThanOrEqual(1);
        expect(callbacks.boundaryEvents[0].meta).toEqual({ type: 'mermaid' });
      });

      test('receives TypedNodeMeta { type: "image" } for image nodes', async () => {
        const { client, stream } = createMockClientWithStream(
          [],
          { input_tokens: 10, output_tokens: 5 }
        );

        const signal = new AbortController().signal;

        const resultPromise = streamIntoNode(
          client as any,
          [{ type: 'text', text: 'system prompt' }],
          'user message',
          signal,
          callbacks
        );

        stream.emitText('<node type="image">a sunset over mountains</node>');
        jest.advanceTimersByTime(BUFFER_INTERVAL_MS + 10);

        const result = await resultPromise;

        expect(callbacks.boundaryEvents.length).toBeGreaterThanOrEqual(1);
        expect(callbacks.boundaryEvents[0].meta).toEqual({ type: 'image' });
      });

      test('mixed types produce correct meta for each boundary', async () => {
        const { client, stream } = createMockClientWithStream(
          [],
          { input_tokens: 10, output_tokens: 5 }
        );

        const signal = new AbortController().signal;

        const resultPromise = streamIntoNode(
          client as any,
          [{ type: 'text', text: 'system prompt' }],
          'user message',
          signal,
          callbacks
        );

        stream.emitText('<node type="text">explanation</node>');
        jest.advanceTimersByTime(BUFFER_INTERVAL_MS + 10);
        stream.emitText('\n\n<node type="code" lang="python">print("hi")</node>');
        jest.advanceTimersByTime(BUFFER_INTERVAL_MS + 10);

        const result = await resultPromise;

        expect(callbacks.boundaryEvents.length).toBe(2);
        expect(callbacks.boundaryEvents[0].meta).toEqual({ type: 'text' });
        expect(callbacks.boundaryEvents[1].meta).toEqual({ type: 'code', lang: 'python' });
      });
    });

    describe('onTextUpdate with typed metadata', () => {
      test('receives TypedNodeMeta so caller knows current node type', async () => {
        const { client, stream } = createMockClientWithStream(
          [],
          { input_tokens: 10, output_tokens: 5 }
        );

        const signal = new AbortController().signal;

        const resultPromise = streamIntoNode(
          client as any,
          [{ type: 'text', text: 'system prompt' }],
          'user message',
          signal,
          callbacks
        );

        stream.emitText('<node type="code" lang="typescript">const x = 1;');
        jest.advanceTimersByTime(BUFFER_INTERVAL_MS + 10);

        // Should have received at least one text update with code meta
        const codeUpdates = callbacks.textUpdates.filter(u => u.meta.type === 'code');
        expect(codeUpdates.length).toBeGreaterThan(0);
        expect(codeUpdates[0].meta).toEqual({ type: 'code', lang: 'typescript' });

        stream.emitText('</node>');
        jest.advanceTimersByTime(BUFFER_INTERVAL_MS + 10);

        const result = await resultPromise;
        expect(result).toBeDefined();
      });
    });

    describe('extractCurrentNodeVisibleText strips typed opening tags', () => {
      test('typed opening tags are stripped from visible text', async () => {
        const { client, stream } = createMockClientWithStream(
          [],
          { input_tokens: 10, output_tokens: 5 }
        );

        const signal = new AbortController().signal;

        const resultPromise = streamIntoNode(
          client as any,
          [{ type: 'text', text: 'system prompt' }],
          'user message',
          signal,
          callbacks
        );

        stream.emitText('<node type="code" lang="typescript">visible code');
        jest.advanceTimersByTime(BUFFER_INTERVAL_MS + 10);

        const lastUpdate = callbacks.textUpdates[callbacks.textUpdates.length - 1];
        expect(lastUpdate.text).not.toContain('<node');
        expect(lastUpdate.text).not.toContain('type=');
        expect(lastUpdate.text).toContain('visible code');

        stream.emitText('</node>');
        jest.advanceTimersByTime(BUFFER_INTERVAL_MS + 10);

        const result = await resultPromise;
        expect(result).toBeDefined();
      });
    });

    describe('partial typed tag detection', () => {
      test('partial typed tag at end of chunk does not leak into visible text', async () => {
        const { client, stream } = createMockClientWithStream(
          [],
          { input_tokens: 10, output_tokens: 5 }
        );

        const signal = new AbortController().signal;

        const resultPromise = streamIntoNode(
          client as any,
          [{ type: 'text', text: 'system prompt' }],
          'user message',
          signal,
          callbacks
        );

        // First node completes, then a partial typed tag arrives
        stream.emitText('<node type="text">first content</node>');
        jest.advanceTimersByTime(BUFFER_INTERVAL_MS + 10);

        // Partial tag: '<node t' without closing '>'
        stream.emitText('\n\n<node t');
        jest.advanceTimersByTime(BUFFER_INTERVAL_MS + 10);

        // None of the text updates after the boundary should contain '<node t'
        for (const update of callbacks.textUpdates) {
          expect(update.text).not.toContain('<node t');
        }

        // Complete the tag
        stream.emitText('ype="code" lang="python">x = 1</node>');
        jest.advanceTimersByTime(BUFFER_INTERVAL_MS + 10);

        const result = await resultPromise;
        expect(result).toBeDefined();
      });
    });

    // Phase 5 gap closure: the prior max_tokens: 4096 cap truncated long
    // code outputs mid-stream. A tachometer dashboard request produced
    // ~10,079 chars of code (~3,500-4,000 output tokens) before hitting
    // the cap; `</node>` never arrived, `onNodeBoundary` never fired,
    // and no companion node was created. Opus 4.6 standard supports up
    // to 32,768 output tokens — 16,384 gives ~60k char budget, comfortably
    // handling realistic code outputs.
    describe('MAX_OUTPUT_TOKENS (Phase 5 gap closure)', () => {
      test('MAX_OUTPUT_TOKENS is at least 16384', () => {
        expect(MAX_OUTPUT_TOKENS).toBeGreaterThanOrEqual(16384);
      });

      test('stream call passes MAX_OUTPUT_TOKENS as max_tokens to the Anthropic API', async () => {
        const { client, stream } = createMockClientWithStream(
          ['hi'],
          { input_tokens: 10, output_tokens: 1 }
        );
        const signal = new AbortController().signal;
        const resultPromise = streamIntoNode(
          client as any,
          [{ type: 'text', text: 'system prompt' }],
          'user message',
          signal,
          callbacks
        );
        stream.emitText('hi');
        jest.advanceTimersByTime(BUFFER_INTERVAL_MS + 10);
        await resultPromise;

        // Anthropic SDK's messages.stream is a jest.fn — first arg is the
        // request params, second arg is the options (signal, etc.).
        expect(client.messages.stream).toHaveBeenCalled();
        const callArgs = (client.messages.stream as jest.Mock).mock.calls[0][0];
        expect(callArgs.max_tokens).toBe(MAX_OUTPUT_TOKENS);
      });
    });
  });
});
