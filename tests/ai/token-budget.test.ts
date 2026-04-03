import { TokenUsageData } from '../../src/types/settings';
import { isBudgetExceeded, trackTokens, getOrResetUsage, _internals } from '../../src/ai/token-budget';

describe('token-budget', () => {
  describe('isBudgetExceeded', () => {
    test('returns false when inputTokens + outputTokens < dailyLimit', () => {
      const usage: TokenUsageData = {
        date: '2026-04-03',
        inputTokens: 100000,
        outputTokens: 100000,
        budgetOverride: false,
      };
      expect(isBudgetExceeded(usage, 500000)).toBe(false);
    });

    test('returns true when inputTokens + outputTokens >= dailyLimit', () => {
      const usage: TokenUsageData = {
        date: '2026-04-03',
        inputTokens: 300000,
        outputTokens: 200000,
        budgetOverride: false,
      };
      expect(isBudgetExceeded(usage, 500000)).toBe(true);
    });

    test('returns false when budget exceeded but budgetOverride is true', () => {
      const usage: TokenUsageData = {
        date: '2026-04-03',
        inputTokens: 300000,
        outputTokens: 200000,
        budgetOverride: true,
      };
      expect(isBudgetExceeded(usage, 500000)).toBe(false);
    });
  });

  describe('trackTokens', () => {
    test('adds response usage to current totals', () => {
      _internals.getTodayDateString = () => '2026-04-03';
      const current: TokenUsageData = {
        date: '2026-04-03',
        inputTokens: 1000,
        outputTokens: 500,
        budgetOverride: false,
      };
      const result = trackTokens(current, { input_tokens: 200, output_tokens: 100 });
      expect(result.inputTokens).toBe(1200);
      expect(result.outputTokens).toBe(600);
      expect(result.date).toBe('2026-04-03');
    });

    test('resets to zero when date changes (new day)', () => {
      _internals.getTodayDateString = () => '2026-04-04';
      const current: TokenUsageData = {
        date: '2026-04-03',
        inputTokens: 50000,
        outputTokens: 30000,
        budgetOverride: false,
      };
      const result = trackTokens(current, { input_tokens: 200, output_tokens: 100 });
      expect(result.inputTokens).toBe(200);
      expect(result.outputTokens).toBe(100);
      expect(result.date).toBe('2026-04-04');
    });

    test('resets budgetOverride to false on new day', () => {
      _internals.getTodayDateString = () => '2026-04-04';
      const current: TokenUsageData = {
        date: '2026-04-03',
        inputTokens: 50000,
        outputTokens: 30000,
        budgetOverride: true,
      };
      const result = trackTokens(current, { input_tokens: 200, output_tokens: 100 });
      expect(result.budgetOverride).toBe(false);
    });
  });

  describe('getOrResetUsage', () => {
    test('returns existing usage when date matches today', () => {
      _internals.getTodayDateString = () => '2026-04-03';
      const stored: TokenUsageData = {
        date: '2026-04-03',
        inputTokens: 5000,
        outputTokens: 3000,
        budgetOverride: true,
      };
      const result = getOrResetUsage(stored);
      expect(result).toEqual(stored);
    });

    test('returns fresh DEFAULT_TOKEN_USAGE with today date when date differs', () => {
      _internals.getTodayDateString = () => '2026-04-04';
      const stored: TokenUsageData = {
        date: '2026-04-03',
        inputTokens: 5000,
        outputTokens: 3000,
        budgetOverride: true,
      };
      const result = getOrResetUsage(stored);
      expect(result.date).toBe('2026-04-04');
      expect(result.inputTokens).toBe(0);
      expect(result.outputTokens).toBe(0);
      expect(result.budgetOverride).toBe(false);
    });
  });

  afterEach(() => {
    // Restore the original getTodayDateString
    const { getTodayDateString } = require('../../src/ai/token-budget');
    _internals.getTodayDateString = getTodayDateString;
  });
});
