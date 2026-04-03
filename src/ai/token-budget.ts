import { TokenUsageData, DEFAULT_TOKEN_USAGE } from '../types/settings';

/**
 * Check if daily token budget is exceeded (D-11, D-12).
 * Returns false if budgetOverride is true (user clicked "Continue anyway").
 */
export function isBudgetExceeded(usage: TokenUsageData, dailyLimit: number): boolean {
  if (usage.budgetOverride) return false;
  return (usage.inputTokens + usage.outputTokens) >= dailyLimit;
}

/**
 * Track token usage from a Claude API response (D-13, GENP-09).
 * Auto-resets counters when date changes (midnight rollover).
 */
export function trackTokens(
  current: TokenUsageData,
  responseUsage: { input_tokens: number; output_tokens: number }
): TokenUsageData {
  const today = _internals.getTodayDateString();
  if (current.date !== today) {
    return {
      date: today,
      inputTokens: responseUsage.input_tokens,
      outputTokens: responseUsage.output_tokens,
      budgetOverride: false,
    };
  }
  return {
    ...current,
    inputTokens: current.inputTokens + responseUsage.input_tokens,
    outputTokens: current.outputTokens + responseUsage.output_tokens,
  };
}

/**
 * Get current usage, resetting if the date has changed.
 * Called on plugin load to handle overnight resets.
 */
export function getOrResetUsage(stored: TokenUsageData): TokenUsageData {
  const today = _internals.getTodayDateString();
  if (stored.date !== today) {
    return { ...DEFAULT_TOKEN_USAGE, date: today };
  }
  return stored;
}

/**
 * Get today's date as ISO date string (YYYY-MM-DD).
 * Extracted for testability -- tests can mock _internals.getTodayDateString.
 */
export function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Internal references for testability.
 * Tests can mock _internals.getTodayDateString to control date-dependent logic.
 */
export const _internals = {
  getTodayDateString,
};
