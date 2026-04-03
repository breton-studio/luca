import { streamIntoNode, parseNodeContent, StreamCallbacks, StreamResult } from '../../src/ai/stream-handler';
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
    textUpdates: string[];
    boundaryEvents: Array<{ content: string; index: number }>;
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
      onTextUpdate: jest.fn((text: string) => {
        callbacks.textUpdates.push(text);
      }),
      onTimeout: jest.fn(() => {
        callbacks.timeoutCalled = true;
      }),
      onNodeBoundary: jest.fn((content: string, index: number) => {
        callbacks.boundaryEvents.push({ content, index });
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

      expect(callbacks.onNodeBoundary).toHaveBeenCalledWith('First content', 0);
      expect(callbacks.boundaryEvents[0]).toEqual({ content: 'First content', index: 0 });
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
      expect(lastUpdate).not.toContain('<node>');
      expect(lastUpdate).not.toContain('</node>');
      expect(lastUpdate).toContain('visible text');

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
      expect(lastUpdate).toContain('Second node content');
      expect(lastUpdate).not.toContain('First node content');

      stream.emitText('</node>');
      jest.advanceTimersByTime(BUFFER_INTERVAL_MS + 10);

      const result = await resultPromise;
      expect(result).toBeDefined();
    });
  });
});
