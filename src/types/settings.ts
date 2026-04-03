export interface CanvasAISettings {
  claudeApiKey: string;
  runwareApiKey: string;
  debounceDelay: number;
  debugMode: boolean;
  disabledCanvases: string[];
}

export const DEFAULT_SETTINGS: CanvasAISettings = {
  claudeApiKey: '',
  runwareApiKey: '',
  debounceDelay: 3,
  debugMode: false,
  disabledCanvases: [],
};
