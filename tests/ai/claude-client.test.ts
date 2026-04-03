import { createClaudeClient, classifyApiError, getRetryDelay, getMaxRetries, ApiErrorType } from '../../src/ai/claude-client';

// Mock the Anthropic SDK constructor
jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation((options: Record<string, unknown>) => {
      return {
        apiKey: options.apiKey,
        _options: options,
        messages: { stream: jest.fn() },
      };
    }),
  };
});

describe('claude-client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createClaudeClient', () => {
    test('returns an Anthropic instance with dangerouslyAllowBrowser: true', () => {
      const Anthropic = require('@anthropic-ai/sdk').default;
      createClaudeClient('sk-ant-test-key');
      expect(Anthropic).toHaveBeenCalledWith(
        expect.objectContaining({ dangerouslyAllowBrowser: true })
      );
    });

    test('sets maxRetries to 2', () => {
      const Anthropic = require('@anthropic-ai/sdk').default;
      createClaudeClient('sk-ant-test-key');
      expect(Anthropic).toHaveBeenCalledWith(
        expect.objectContaining({ maxRetries: 2 })
      );
    });

    test('sets timeout to 60000', () => {
      const Anthropic = require('@anthropic-ai/sdk').default;
      createClaudeClient('sk-ant-test-key');
      expect(Anthropic).toHaveBeenCalledWith(
        expect.objectContaining({ timeout: 60_000 })
      );
    });

    test('passes the apiKey to the constructor', () => {
      const Anthropic = require('@anthropic-ai/sdk').default;
      createClaudeClient('sk-ant-my-api-key');
      expect(Anthropic).toHaveBeenCalledWith(
        expect.objectContaining({ apiKey: 'sk-ant-my-api-key' })
      );
    });
  });

  describe('classifyApiError', () => {
    test('returns "auth" for status 401', () => {
      const error = { status: 401, message: 'Unauthorized' };
      expect(classifyApiError(error)).toBe('auth');
    });

    test('returns "rate_limit" for status 429', () => {
      const error = { status: 429, message: 'Rate limited' };
      expect(classifyApiError(error)).toBe('rate_limit');
    });

    test('returns "server" for status 500', () => {
      const error = { status: 500, message: 'Internal server error' };
      expect(classifyApiError(error)).toBe('server');
    });

    test('returns "server" for status 502', () => {
      const error = { status: 502, message: 'Bad gateway' };
      expect(classifyApiError(error)).toBe('server');
    });

    test('returns "server" for status 503', () => {
      const error = { status: 503, message: 'Service unavailable' };
      expect(classifyApiError(error)).toBe('server');
    });

    test('returns "network" for errors without status', () => {
      const error = new Error('Network error');
      expect(classifyApiError(error)).toBe('network');
    });

    test('returns "unknown" for unrecognized status codes', () => {
      const error = { status: 418, message: "I'm a teapot" };
      expect(classifyApiError(error)).toBe('unknown');
    });
  });

  describe('getRetryDelay', () => {
    test('returns 0 for "auth" errors (no retry)', () => {
      expect(getRetryDelay('auth', 0)).toBe(0);
      expect(getRetryDelay('auth', 1)).toBe(0);
    });

    test('returns Retry-After header value for "rate_limit" errors', () => {
      expect(getRetryDelay('rate_limit', 0, '30')).toBe(30_000);
    });

    test('returns 60s default for "rate_limit" errors without Retry-After', () => {
      expect(getRetryDelay('rate_limit', 0)).toBe(60_000);
    });

    test('returns exponential backoff (1s, 2s, 4s) for "server" errors', () => {
      expect(getRetryDelay('server', 0)).toBe(1000);
      expect(getRetryDelay('server', 1)).toBe(2000);
      expect(getRetryDelay('server', 2)).toBe(4000);
    });

    test('returns exponential backoff for "network" errors', () => {
      expect(getRetryDelay('network', 0)).toBe(1000);
      expect(getRetryDelay('network', 1)).toBe(2000);
      expect(getRetryDelay('network', 2)).toBe(4000);
    });
  });

  describe('getMaxRetries', () => {
    test('returns 0 for "auth" errors', () => {
      expect(getMaxRetries('auth')).toBe(0);
    });

    test('returns 1 for "rate_limit" errors', () => {
      expect(getMaxRetries('rate_limit')).toBe(1);
    });

    test('returns 3 for "server" errors', () => {
      expect(getMaxRetries('server')).toBe(3);
    });

    test('returns 3 for "network" errors', () => {
      expect(getMaxRetries('network')).toBe(3);
    });
  });
});
