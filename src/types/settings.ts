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

  // Phase 4: Image save location (D-07)
  imageSavePath: string;
}

/**
 * Canvas color values accepted by Obsidian's node setData({ color }) API.
 *
 * Obsidian accepts: '1' through '6' (preset colors), '' (theme default),
 * or a '#rrggbb' hex string. White is implemented as an explicit hex
 * '#ffffff' (not '') so it renders consistently regardless of the user's
 * Obsidian theme.
 *
 * Note on ordering: JavaScript objects sort numeric-string keys ('1'..'6')
 * before non-numeric keys ('#ffffff'), so using a Record for dropdown
 * construction would silently reorder the list. We use an ordered array
 * as the canonical source and build the dropdown by calling addOption in
 * a loop. NODE_COLOR_OPTIONS (the Record form) is kept for `in`-based
 * validation of stored values — its iteration order is not load-bearing.
 */
export interface NodeColorOption {
  value: string;
  label: string;
}

export const NODE_COLOR_OPTIONS_ORDER: NodeColorOption[] = [
  { value: '#ffffff', label: 'White (default)' },
  { value: '1', label: 'Red' },
  { value: '2', label: 'Orange' },
  { value: '3', label: 'Yellow' },
  { value: '4', label: 'Green' },
  { value: '5', label: 'Cyan' },
  { value: '6', label: 'Purple' },
];

export const NODE_COLOR_OPTIONS: Record<string, string> = Object.fromEntries(
  NODE_COLOR_OPTIONS_ORDER.map(({ value, label }) => [value, label])
);

/** Default AI node color. Fresh installs get white; existing users keep their saved value. */
export const DEFAULT_NODE_COLOR = '#ffffff';

export const DEFAULT_SETTINGS: CanvasAISettings = {
  claudeApiKey: '',
  runwareApiKey: '',
  debounceDelay: 3,
  debugMode: false,
  disabledCanvases: [],
  dailyTokenBudget: 500000,
  aiNodeColor: DEFAULT_NODE_COLOR,
  tasteProfilePath: '.obsidian/plugins/canvas-ai/taste-profile.md',
  imageSavePath: 'canvas-ai-images',
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
