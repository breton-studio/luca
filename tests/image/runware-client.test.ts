jest.mock('@runware/sdk-js', () => ({
  Runware: jest.fn().mockImplementation(() => ({
    ensureConnection: jest.fn().mockResolvedValue(undefined),
    requestImages: jest.fn().mockResolvedValue([{ imageBase64Data: 'abc123==' }]),
    disconnect: jest.fn().mockResolvedValue(undefined),
  })),
}));

import { RunwareImageClient } from '../../src/image/runware-client';
import { Runware } from '@runware/sdk-js';

const MockRunware = Runware as jest.MockedClass<typeof Runware>;

describe('RunwareImageClient', () => {
  beforeEach(() => {
    MockRunware.mockClear();
  });

  describe('lazy initialization', () => {
    it('does not call Runware constructor on RunwareImageClient construction', () => {
      new RunwareImageClient('test-api-key');
      expect(MockRunware).not.toHaveBeenCalled();
    });

    it('calls Runware constructor on first generateImage call', async () => {
      const client = new RunwareImageClient('test-api-key');
      await client.generateImage('a cat');
      expect(MockRunware).toHaveBeenCalledWith({ apiKey: 'test-api-key' });
    });

    it('calls ensureConnection on first generateImage call', async () => {
      const client = new RunwareImageClient('test-api-key');
      await client.generateImage('a cat');
      const instance = MockRunware.mock.results[0].value;
      expect(instance.ensureConnection).toHaveBeenCalled();
    });

    it('reuses existing client on subsequent generateImage calls', async () => {
      const client = new RunwareImageClient('test-api-key');
      await client.generateImage('a cat');
      await client.generateImage('a dog');
      expect(MockRunware).toHaveBeenCalledTimes(1);
    });
  });

  describe('generateImage', () => {
    it('calls requestImages with correct Riverflow model and parameters', async () => {
      const client = new RunwareImageClient('test-api-key');
      await client.generateImage('a beautiful sunset');
      const instance = MockRunware.mock.results[0].value;
      expect(instance.requestImages).toHaveBeenCalledWith({
        positivePrompt: 'a beautiful sunset',
        model: 'sourceful:riverflow-2.0@pro',
        width: 1024,
        height: 1024,
        outputType: 'base64Data',
        outputFormat: 'PNG',
        numberResults: 1,
      });
    });

    it('passes the prompt as positivePrompt', async () => {
      const client = new RunwareImageClient('test-api-key');
      await client.generateImage('cyberpunk cityscape at night');
      const instance = MockRunware.mock.results[0].value;
      const call = instance.requestImages.mock.calls[0][0];
      expect(call.positivePrompt).toBe('cyberpunk cityscape at night');
    });

    it('returns the ITextToImage array from SDK', async () => {
      const client = new RunwareImageClient('test-api-key');
      const result = await client.generateImage('a cat');
      expect(result).toEqual([{ imageBase64Data: 'abc123==' }]);
    });

    it('returns undefined when SDK throws auth error', async () => {
      const client = new RunwareImageClient('test-api-key');
      // First call to set up the mock instance
      await client.generateImage('first');
      const instance = MockRunware.mock.results[0].value;
      instance.requestImages.mockRejectedValueOnce(new Error('Authentication failed: invalid API key'));

      const result = await client.generateImage('second');
      expect(result).toBeUndefined();
    });

    it('returns undefined when SDK throws network error', async () => {
      const client = new RunwareImageClient('test-api-key');
      await client.generateImage('first');
      const instance = MockRunware.mock.results[0].value;
      instance.requestImages.mockRejectedValueOnce(new Error('WebSocket connection failed'));

      const result = await client.generateImage('second');
      expect(result).toBeUndefined();
    });
  });

  describe('disconnect', () => {
    it('calls SDK disconnect when client is initialized', async () => {
      const client = new RunwareImageClient('test-api-key');
      await client.generateImage('a cat');
      const instance = MockRunware.mock.results[0].value;

      await client.disconnect();
      expect(instance.disconnect).toHaveBeenCalled();
    });

    it('is safe to call when client is not initialized', async () => {
      const client = new RunwareImageClient('test-api-key');
      // disconnect without ever calling generateImage
      await expect(client.disconnect()).resolves.not.toThrow();
    });
  });

  describe('updateApiKey', () => {
    it('forces re-initialization on next generateImage when key changes', async () => {
      const client = new RunwareImageClient('old-key');
      await client.generateImage('a cat');
      expect(MockRunware).toHaveBeenCalledTimes(1);

      client.updateApiKey('new-key');
      await client.generateImage('a dog');
      expect(MockRunware).toHaveBeenCalledTimes(2);
      expect(MockRunware).toHaveBeenLastCalledWith({ apiKey: 'new-key' });
    });

    it('does not re-initialize if key is unchanged', async () => {
      const client = new RunwareImageClient('same-key');
      await client.generateImage('a cat');
      client.updateApiKey('same-key');
      await client.generateImage('a dog');
      expect(MockRunware).toHaveBeenCalledTimes(1);
    });
  });
});
