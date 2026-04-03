// Minimal Obsidian API mocks for unit testing
export class Plugin {
  app: any = {};
  loadData = jest.fn().mockResolvedValue({});
  saveData = jest.fn().mockResolvedValue(undefined);
  addSettingTab = jest.fn();
  addStatusBarItem = jest.fn().mockReturnValue({
    addClass: jest.fn(),
    setText: jest.fn(),
    style: {},
  });
  addCommand = jest.fn();
  registerEvent = jest.fn();
  registerDomEvent = jest.fn();
  register = jest.fn();
}

export class PluginSettingTab {
  app: any;
  plugin: any;
  containerEl: any = { empty: jest.fn() };
  constructor(app: any, plugin: any) {
    this.app = app;
    this.plugin = plugin;
  }
}

export class Setting {
  constructor(_containerEl: any) {}
  setName = jest.fn().mockReturnThis();
  setDesc = jest.fn().mockReturnThis();
  setHeading = jest.fn().mockReturnThis();
  addText = jest.fn().mockReturnThis();
  addSlider = jest.fn().mockReturnThis();
  addToggle = jest.fn().mockReturnThis();
  descEl: any = { empty: jest.fn(), setText: jest.fn(), addClass: jest.fn(), removeClass: jest.fn() };
}

export class Notice {
  constructor(_message: string) {}
}

export class Menu {
  addItem = jest.fn().mockReturnThis();
  addSeparator = jest.fn().mockReturnThis();
  showAtMouseEvent = jest.fn();
}

export function debounce(fn: Function, delay: number, _resetTimer?: boolean) {
  return fn;
}
