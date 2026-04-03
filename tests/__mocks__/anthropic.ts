/**
 * Mock Anthropic SDK for unit tests.
 *
 * Provides MockAnthropicClient and MockStream to simulate
 * Claude API streaming behavior without network calls.
 */

type TextHandler = (text: string) => void;
type MessageHandler = (message: MockMessage) => void;
type ErrorHandler = (error: Error) => void;
type EventHandler = TextHandler | MessageHandler | ErrorHandler;

export interface MockMessage {
  id: string;
  type: 'message';
  role: 'assistant';
  content: Array<{ type: 'text'; text: string }>;
  usage: { input_tokens: number; output_tokens: number };
}

/**
 * Simulates the Anthropic SDK streaming response.
 * Supports .on('text', cb), .on('message', cb), .on('error', cb),
 * and .finalMessage() for getting usage data.
 */
export class MockStream {
  private handlers: Map<string, EventHandler[]> = new Map();
  private accumulated = '';
  private _finalMessage: MockMessage;
  private _aborted = false;

  constructor(
    private responses: string[] = [],
    private usage: { input_tokens: number; output_tokens: number } = {
      input_tokens: 100,
      output_tokens: 50,
    }
  ) {
    this._finalMessage = {
      id: 'mock-msg-001',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: '' }],
      usage: this.usage,
    };
  }

  on(event: string, handler: EventHandler): this {
    const handlers = this.handlers.get(event) || [];
    handlers.push(handler);
    this.handlers.set(event, handlers);
    return this;
  }

  /**
   * Emit a text delta to registered handlers.
   * Used by tests to simulate streaming text arrival.
   */
  emitText(text: string): void {
    if (this._aborted) return;
    this.accumulated += text;
    const handlers = this.handlers.get('text') || [];
    for (const handler of handlers) {
      (handler as TextHandler)(text);
    }
  }

  /**
   * Emit an error to registered handlers.
   */
  emitError(error: Error): void {
    const handlers = this.handlers.get('error') || [];
    for (const handler of handlers) {
      (handler as ErrorHandler)(error);
    }
  }

  /**
   * Simulate streaming all configured responses as text deltas.
   */
  async simulateStream(): Promise<void> {
    for (const text of this.responses) {
      if (this._aborted) break;
      this.emitText(text);
    }
  }

  /**
   * Mark stream as aborted (simulates AbortSignal).
   */
  abort(): void {
    this._aborted = true;
  }

  /**
   * Returns the final message with usage data.
   * Called after stream completes.
   */
  async finalMessage(): Promise<MockMessage> {
    this._finalMessage.content[0].text = this.accumulated;
    return this._finalMessage;
  }

  /**
   * Set custom usage data.
   */
  setUsage(usage: { input_tokens: number; output_tokens: number }): void {
    this.usage = usage;
    this._finalMessage.usage = usage;
  }
}

/**
 * Mock Anthropic client matching the SDK's interface.
 */
export class MockAnthropicClient {
  apiKey: string;
  _options: Record<string, unknown>;
  messages: {
    stream: jest.Mock;
  };

  private _mockStream: MockStream | null = null;

  constructor(options: Record<string, unknown> = {}) {
    this.apiKey = (options.apiKey as string) || 'test-key';
    this._options = options;
    this.messages = {
      stream: jest.fn().mockImplementation(() => {
        if (this._mockStream) return this._mockStream;
        return new MockStream();
      }),
    };
  }

  /**
   * Configure the mock stream that will be returned by messages.stream().
   */
  setMockStream(stream: MockStream): void {
    this._mockStream = stream;
    this.messages.stream.mockImplementation(() => stream);
  }
}

/**
 * Create a pre-configured mock client with a mock stream.
 */
export function createMockClientWithStream(
  responses: string[] = [],
  usage: { input_tokens: number; output_tokens: number } = {
    input_tokens: 100,
    output_tokens: 50,
  }
): { client: MockAnthropicClient; stream: MockStream } {
  const stream = new MockStream(responses, usage);
  const client = new MockAnthropicClient();
  client.setMockStream(stream);
  return { client, stream };
}
