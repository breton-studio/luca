import { DEFAULT_SETTINGS, CanvasAISettings } from '../src/types/settings';

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
});
