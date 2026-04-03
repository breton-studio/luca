jest.mock('uuid', () => ({
  v4: jest.fn(() => 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
}));

import { ImageSaver } from '../../src/image/image-saver';

function createMockVault() {
  return {
    getAbstractFileByPath: jest.fn().mockReturnValue(null),
    createFolder: jest.fn().mockResolvedValue({}),
    createBinary: jest.fn().mockResolvedValue({}),
  };
}

describe('ImageSaver', () => {
  let vault: ReturnType<typeof createMockVault>;
  let saver: ImageSaver;

  beforeEach(() => {
    vault = createMockVault();
    saver = new ImageSaver(vault as any);
    // Mock Date to control filename
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-03T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('saveToVault', () => {
    it('creates folder if it does not exist', async () => {
      vault.getAbstractFileByPath.mockReturnValue(null);

      await saver.saveToVault('SGVsbG8='); // "Hello" in base64

      expect(vault.createFolder).toHaveBeenCalledWith('canvas-ai-images');
    });

    it('skips folder creation if folder already exists', async () => {
      vault.getAbstractFileByPath.mockReturnValue({ path: 'canvas-ai-images' });

      await saver.saveToVault('SGVsbG8=');

      expect(vault.createFolder).not.toHaveBeenCalled();
    });

    it('decodes base64 to ArrayBuffer and calls vault.createBinary', async () => {
      await saver.saveToVault('SGVsbG8='); // "Hello" in base64

      expect(vault.createBinary).toHaveBeenCalledTimes(1);
      const [filePath, buffer] = vault.createBinary.mock.calls[0];

      // Verify the buffer contains decoded "Hello"
      const decoded = new Uint8Array(buffer);
      const text = String.fromCharCode(...decoded);
      expect(text).toBe('Hello');
    });

    it('returns file path matching pattern {folder}/{date}_{uuid}.png', async () => {
      const result = await saver.saveToVault('SGVsbG8=');

      expect(result).toBe('canvas-ai-images/2026-04-03_a1b2c3d4.png');
    });

    it('uses configured folder path, not hardcoded', async () => {
      const customSaver = new ImageSaver(vault as any, 'my-images');

      await customSaver.saveToVault('SGVsbG8=');

      expect(vault.getAbstractFileByPath).toHaveBeenCalledWith('my-images');
      const [filePath] = vault.createBinary.mock.calls[0];
      expect(filePath).toMatch(/^my-images\//);
    });

    it('file path includes date from current time', async () => {
      jest.setSystemTime(new Date('2026-12-25T00:00:00Z'));

      const result = await saver.saveToVault('SGVsbG8=');

      expect(result).toMatch(/^canvas-ai-images\/2026-12-25_/);
    });
  });

  describe('updateFolderPath', () => {
    it('changes the folder used for subsequent saves', async () => {
      saver.updateFolderPath('new-folder');

      await saver.saveToVault('SGVsbG8=');

      expect(vault.getAbstractFileByPath).toHaveBeenCalledWith('new-folder');
      const [filePath] = vault.createBinary.mock.calls[0];
      expect(filePath).toMatch(/^new-folder\//);
    });
  });
});
