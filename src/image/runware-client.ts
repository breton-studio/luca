import { Runware } from '@runware/sdk-js';

const RIVERFLOW_MODEL = 'sourceful:riverflow-2.0@pro';
const DEFAULT_IMAGE_SIZE = 1024;
const IMAGE_TIMEOUT_MS = 30_000;

/**
 * Wrapper around the Runware SDK for image generation via Riverflow 2.0 Pro.
 *
 * Key design decisions:
 * - Lazy initialization: SDK client is created on first generateImage call, not in constructor (Pitfall 7)
 * - Graceful error handling: Returns undefined on failure, never throws to callers
 * - Timeout protection: 30s timeout prevents hanging on network issues
 * - API key hot-swap: updateApiKey() forces re-initialization on next request
 */
export class RunwareImageClient {
  private client: Runware | null = null;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /** Update the API key (e.g., when user changes it in settings) */
  updateApiKey(apiKey: string): void {
    if (apiKey !== this.apiKey) {
      this.apiKey = apiKey;
      this.client = null; // Force re-init on next request
    }
  }

  /**
   * Generate an image from a text prompt using Riverflow 2.0 Pro.
   * Lazily initializes the Runware SDK on first call (Pitfall 7).
   * Returns the SDK response array, or undefined on error.
   */
  async generateImage(prompt: string): Promise<Array<{ imageBase64Data?: string }> | undefined> {
    try {
      const client = await this.ensureClient();
      const results = await Promise.race([
        client.requestImages({
          positivePrompt: prompt,
          model: RIVERFLOW_MODEL,
          width: DEFAULT_IMAGE_SIZE,
          height: DEFAULT_IMAGE_SIZE,
          outputType: 'base64Data',
          outputFormat: 'PNG',
          numberResults: 1,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Runware timeout')), IMAGE_TIMEOUT_MS)
        ),
      ]);
      return results as Array<{ imageBase64Data?: string }>;
    } catch (err) {
      console.error('[Canvas AI] Runware image generation failed:', err);
      return undefined;
    }
  }

  /** Disconnect the WebSocket client. Safe to call when not initialized. */
  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.disconnect();
      } catch {
        // Silently catch -- connection may already be closed
      }
      this.client = null;
    }
  }

  private async ensureClient(): Promise<Runware> {
    if (!this.client) {
      this.client = new Runware({ apiKey: this.apiKey });
      await this.client.ensureConnection();
    }
    return this.client;
  }
}
