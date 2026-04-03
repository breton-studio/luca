export interface CanvasAISettings {
  // Phase 1 fields
  claudeApiKey: string;
  runwareApiKey: string;
  debounceDelay: number;
  debugMode: boolean;
  disabledCanvases: string[];

  // Phase 3: Token budget (D-11)
  dailyTokenBudget: number;

  // Phase 3: AI node appearance (D-05, D-06)
  aiNodeColor: string;

  // Phase 3: Taste profile (D-09)
  tasteProfilePath: string;
}

export const DEFAULT_SETTINGS: CanvasAISettings = {
  claudeApiKey: '',
  runwareApiKey: '',
  debounceDelay: 3,
  debugMode: false,
  disabledCanvases: [],
  dailyTokenBudget: 500000,
  aiNodeColor: '6',
  tasteProfilePath: '.obsidian/plugins/canvas-ai/taste-profile.md',
};

export interface TokenUsageData {
  date: string;           // ISO date string "2026-04-03"
  inputTokens: number;    // Cumulative input tokens today
  outputTokens: number;   // Cumulative output tokens today
  budgetOverride: boolean; // User clicked "Continue anyway"
}

export const DEFAULT_TOKEN_USAGE: TokenUsageData = {
  date: '',
  inputTokens: 0,
  outputTokens: 0,
  budgetOverride: false,
};

/** Stream buffer interval in ms (200-300ms per D-04, GENP-04) */
export const BUFFER_INTERVAL_MS = 250;
