import {
  DEFAULT_SETTINGS,
  CanvasAISettings,
  TokenUsageData,
  DEFAULT_TOKEN_USAGE,
  BUFFER_INTERVAL_MS,
  NODE_COLOR_OPTIONS,
  NODE_COLOR_OPTIONS_ORDER,
  DEFAULT_NODE_COLOR,
} from '../src/types/settings';

describe('CanvasAISettings', () => {
  test('DEFAULT_SETTINGS has expected defaults', () => {
    expect(DEFAULT_SETTINGS.claudeApiKey).toBe('');
    expect(DEFAULT_SETTINGS.runwareApiKey).toBe('');
    expect(DEFAULT_SETTINGS.debounceDelay).toBe(3);
    expect(DEFAULT_SETTINGS.debugMode).toBe(false);
    expect(DEFAULT_SETTINGS.disabledCanvases).toEqual([]);
  });

  test('DEFAULT_SETTINGS has all required fields', () => {
    const keys = Object.keys(DEFAULT_SETTINGS);
    expect(keys).toContain('claudeApiKey');
    expect(keys).toContain('runwareApiKey');
    expect(keys).toContain('debounceDelay');
    expect(keys).toContain('debugMode');
    expect(keys).toContain('disabledCanvases');
  });

  // Phase 3 settings fields
  test('CanvasAISettings has dailyTokenBudget of type number', () => {
    const settings: CanvasAISettings = { ...DEFAULT_SETTINGS };
    expect(typeof settings.dailyTokenBudget).toBe('number');
  });

  test('CanvasAISettings has aiNodeColor of type string', () => {
    const settings: CanvasAISettings = { ...DEFAULT_SETTINGS };
    expect(typeof settings.aiNodeColor).toBe('string');
  });

  test('CanvasAISettings has tasteProfilePath of type string', () => {
    const settings: CanvasAISettings = { ...DEFAULT_SETTINGS };
    expect(typeof settings.tasteProfilePath).toBe('string');
  });

  test('DEFAULT_SETTINGS.dailyTokenBudget equals 500000', () => {
    expect(DEFAULT_SETTINGS.dailyTokenBudget).toBe(500000);
  });

  test('DEFAULT_SETTINGS.aiNodeColor equals DEFAULT_NODE_COLOR', () => {
    expect(DEFAULT_SETTINGS.aiNodeColor).toBe(DEFAULT_NODE_COLOR);
  });

  test('DEFAULT_NODE_COLOR equals "#ffffff" (white)', () => {
    expect(DEFAULT_NODE_COLOR).toBe('#ffffff');
  });

  test('NODE_COLOR_OPTIONS contains white with label starting with "White"', () => {
    expect(NODE_COLOR_OPTIONS['#ffffff']).toBeDefined();
    expect(NODE_COLOR_OPTIONS['#ffffff']).toMatch(/^White/);
  });

  test('NODE_COLOR_OPTIONS preserves all 6 legacy preset options', () => {
    expect(NODE_COLOR_OPTIONS['1']).toBeDefined();
    expect(NODE_COLOR_OPTIONS['2']).toBeDefined();
    expect(NODE_COLOR_OPTIONS['3']).toBeDefined();
    expect(NODE_COLOR_OPTIONS['4']).toBeDefined();
    expect(NODE_COLOR_OPTIONS['5']).toBeDefined();
    expect(NODE_COLOR_OPTIONS['6']).toBeDefined();
  });

  test('NODE_COLOR_OPTIONS_ORDER lists White first (dropdown order)', () => {
    // JS objects re-order numeric keys, so ordering lives on the array form.
    // The settings UI iterates NODE_COLOR_OPTIONS_ORDER to build the dropdown.
    expect(NODE_COLOR_OPTIONS_ORDER[0].value).toBe('#ffffff');
    expect(NODE_COLOR_OPTIONS_ORDER[0].label).toMatch(/^White/);
  });

  test('NODE_COLOR_OPTIONS_ORDER and NODE_COLOR_OPTIONS stay in sync', () => {
    for (const { value, label } of NODE_COLOR_OPTIONS_ORDER) {
      expect(NODE_COLOR_OPTIONS[value]).toBe(label);
    }
    expect(Object.keys(NODE_COLOR_OPTIONS).length).toBe(NODE_COLOR_OPTIONS_ORDER.length);
  });

  test('DEFAULT_SETTINGS.tasteProfilePath equals expected path', () => {
    expect(DEFAULT_SETTINGS.tasteProfilePath).toBe('.obsidian/plugins/canvas-ai/taste-profile.md');
  });

  test('BUFFER_INTERVAL_MS equals 250', () => {
    expect(BUFFER_INTERVAL_MS).toBe(250);
  });
});

describe('TokenUsageData', () => {
  test('TokenUsageData interface has required fields', () => {
    const usage: TokenUsageData = {
      date: '2026-04-03',
      inputTokens: 100,
      outputTokens: 200,
      budgetOverride: false,
    };
    expect(typeof usage.date).toBe('string');
    expect(typeof usage.inputTokens).toBe('number');
    expect(typeof usage.outputTokens).toBe('number');
    expect(typeof usage.budgetOverride).toBe('boolean');
  });

  test('DEFAULT_TOKEN_USAGE has correct defaults', () => {
    expect(DEFAULT_TOKEN_USAGE.date).toBe('');
    expect(DEFAULT_TOKEN_USAGE.inputTokens).toBe(0);
    expect(DEFAULT_TOKEN_USAGE.outputTokens).toBe(0);
    expect(DEFAULT_TOKEN_USAGE.budgetOverride).toBe(false);
  });
});
