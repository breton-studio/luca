/**
 * Claude client wrapper for Electron environment (GENP-01, GENP-02).
 *
 * Initializes the Anthropic SDK with settings appropriate for Obsidian's
 * Electron context. Provides error classification and retry delay computation
 * for the generation pipeline (GENP-12).
 */

import Anthropic from '@anthropic-ai/sdk';

export type ApiErrorType = 'auth' | 'rate_limit' | 'server' | 'network' | 'unknown';

/**
 * Create a Claude client configured for Electron (GENP-01, GENP-02).
 * Uses dangerouslyAllowBrowser since Electron is browser-like.
 * SDK auto-detects Node.js fetch in Electron context.
 */
export function createClaudeClient(apiKey: string): Anthropic {
  return new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
    maxRetries: 2,
    timeout: 60_000,
  });
}

/**
 * Classify an API error for appropriate recovery (GENP-12).
 * Returns error type determining retry strategy.
 */
export function classifyApiError(error: unknown): ApiErrorType {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: number }).status;
    if (status === 401 || status === 403) return 'auth';
    if (status === 429) return 'rate_limit';
    if (status >= 500) return 'server';
    return 'unknown';
  }
  // No status property -- likely a network error
  return 'network';
}

/**
 * Compute retry delay based on error type and attempt number (GENP-12).
 * - auth: 0 (no retry)
 * - rate_limit: Retry-After header or 60s default
 * - server/network: exponential backoff 1s, 2s, 4s (max 3 retries)
 */
export function getRetryDelay(
  errorType: ApiErrorType,
  attempt: number,
  retryAfterHeader?: string
): number {
  if (errorType === 'auth') return 0;
  if (errorType === 'rate_limit') {
    if (retryAfterHeader) {
      const seconds = parseInt(retryAfterHeader, 10);
      if (!isNaN(seconds)) return seconds * 1000;
    }
    return 60_000; // 60s default for rate limits
  }
  // server, network, unknown: exponential backoff
  return 1000 * Math.pow(2, attempt);
}

/**
 * Max retry attempts per error type.
 */
export function getMaxRetries(errorType: ApiErrorType): number {
  if (errorType === 'auth') return 0;
  if (errorType === 'rate_limit') return 1;
  return 3; // server, network, unknown
}
