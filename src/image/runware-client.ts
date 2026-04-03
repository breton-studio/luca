/**
 * Direct WebSocket client for Runware image generation via Riverflow 2.0 Pro.
 *
 * Bypasses the @runware/sdk-js package which has response-matching issues in
 * Electron/Obsidian. Based on the proven Nagare implementation that talks
 * directly to wss://ws-api.runware.ai/v1.
 *
 * Key design decisions:
 * - Direct WebSocket: No SDK — proven protocol from Nagare project
 * - URL-based: Gets imageURL from Runware, downloads separately (like Nagare)
 * - Lazy connection: WebSocket created on first generateImage call
 * - Graceful error handling: Returns undefined on failure, never throws
 * - API key hot-swap: updateApiKey() forces reconnect on next request
 */

const WS_ENDPOINT = 'wss://ws-api.runware.ai/v1';
const RIVERFLOW_MODEL = 'sourceful:riverflow-2.0@pro';
const DEFAULT_IMAGE_SIZE = 1024;
const TIMEOUT_MS = 120_000;

export class RunwareImageClient {
  private ws: WebSocket | null = null;
  private apiKey: string;
  private authenticated = false;
  private pendingResults = new Map<string, {
    resolve: (url: string) => void;
    reject: (err: Error) => void;
  }>();

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  updateApiKey(apiKey: string): void {
    if (apiKey !== this.apiKey) {
      this.apiKey = apiKey;
      this.disconnect();
    }
  }

  async generateImage(prompt: string): Promise<Array<{ imageBase64Data?: string }> | undefined> {
    try {
      console.log('[Canvas AI] Runware: connecting...');
      await this.ensureConnection();

      const taskUUID = crypto.randomUUID();
      console.log('[Canvas AI] Runware: sending imageInference, taskUUID=' + taskUUID);

      // Send image inference request (same format as Nagare)
      this.send([{
        taskType: 'imageInference',
        taskUUID,
        positivePrompt: prompt,
        width: DEFAULT_IMAGE_SIZE,
        height: DEFAULT_IMAGE_SIZE,
        model: RIVERFLOW_MODEL,
        numberResults: 1,
        outputFormat: 'PNG',
      }]);

      // Wait for result URL with timeout
      const imageURL = await this.waitForResult(taskUUID);
      console.log('[Canvas AI] Runware: got imageURL, downloading...');

      // Download image and convert to base64 (maintains existing interface)
      const response = await fetch(imageURL);
      if (!response.ok) throw new Error(`Image download failed: ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      const base64 = arrayBufferToBase64(arrayBuffer);

      console.log('[Canvas AI] Runware: image downloaded, base64Len=' + base64.length);
      return [{ imageBase64Data: base64 }];
    } catch (err) {
      console.error('[Canvas AI] Runware image generation failed:', err);
      return undefined;
    }
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      try { this.ws.close(); } catch { /* ignore */ }
      this.ws = null;
    }
    this.authenticated = false;
    // Fail any pending requests
    for (const [, pending] of this.pendingResults) {
      pending.reject(new Error('Connection closed'));
    }
    this.pendingResults.clear();
  }

  // -- Private --

  private async ensureConnection(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.authenticated) {
      return;
    }
    // Close stale connection
    if (this.ws) {
      try { this.ws.close(); } catch { /* ignore */ }
    }

    this.authenticated = false;
    this.ws = await this.connectWebSocket();
    this.setupMessageHandler();
    await this.authenticate();
  }

  private connectWebSocket(): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(WS_ENDPOINT);
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('WebSocket connection timeout'));
      }, 15_000);

      ws.onopen = () => {
        clearTimeout(timeout);
        console.log('[Canvas AI] Runware: WebSocket connected');
        resolve(ws);
      };
      ws.onerror = (e) => {
        clearTimeout(timeout);
        reject(new Error('WebSocket connection failed'));
      };
    });
  }

  private setupMessageHandler(): void {
    if (!this.ws) return;

    this.ws.onmessage = (event: MessageEvent) => {
      let json: any;
      try {
        json = JSON.parse(typeof event.data === 'string' ? event.data : '');
      } catch {
        console.warn('[Canvas AI] Runware: unparseable message');
        return;
      }

      // Handle errors
      if (json.errors && Array.isArray(json.errors)) {
        const err = json.errors[0];
        const msg = err?.message || 'Unknown Runware error';
        console.error('[Canvas AI] Runware API error:', msg);
        if (err?.taskUUID && this.pendingResults.has(err.taskUUID)) {
          this.pendingResults.get(err.taskUUID)!.reject(new Error(msg));
          this.pendingResults.delete(err.taskUUID);
        }
        return;
      }
      if (json.error) {
        const msg = json.error.message || 'Unknown Runware error';
        console.error('[Canvas AI] Runware error:', msg);
        return;
      }

      // Handle data responses
      if (json.data && Array.isArray(json.data)) {
        for (const result of json.data) {
          const taskUUID = result.taskUUID as string | undefined;
          if (!taskUUID) continue;

          // Skip auth responses
          if (result.taskType === 'authentication') continue;

          const imageURL = result.imageURL as string | undefined;
          if (imageURL && this.pendingResults.has(taskUUID)) {
            console.log('[Canvas AI] Runware: received result for task ' + taskUUID);
            this.pendingResults.get(taskUUID)!.resolve(imageURL);
            this.pendingResults.delete(taskUUID);
          }
        }
      }
    };

    this.ws.onclose = () => {
      console.log('[Canvas AI] Runware: WebSocket closed');
      this.authenticated = false;
      for (const [, pending] of this.pendingResults) {
        pending.reject(new Error('WebSocket closed'));
      }
      this.pendingResults.clear();
    };
  }

  private async authenticate(): Promise<void> {
    const sessionUUID = crypto.randomUUID();
    this.send([{
      taskType: 'authentication',
      apiKey: this.apiKey,
      connectionSessionUUID: sessionUUID,
    }]);

    // Wait for auth response
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Auth timeout')), 15_000);

      const originalHandler = this.ws!.onmessage;
      this.ws!.onmessage = (event: MessageEvent) => {
        let json: any;
        try {
          json = JSON.parse(typeof event.data === 'string' ? event.data : '');
        } catch { return; }

        if (json.data?.[0]?.taskType === 'authentication') {
          clearTimeout(timeout);
          this.authenticated = true;
          this.ws!.onmessage = originalHandler;
          console.log('[Canvas AI] Runware: authenticated');
          resolve();
          return;
        }

        if (json.error || json.errors) {
          clearTimeout(timeout);
          this.ws!.onmessage = originalHandler;
          reject(new Error('Runware authentication failed'));
          return;
        }
      };
    });
  }

  private send(payload: object[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }
    this.ws.send(JSON.stringify(payload));
  }

  private waitForResult(taskUUID: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingResults.delete(taskUUID);
        reject(new Error('Runware image generation timeout (120s)'));
      }, TIMEOUT_MS);

      this.pendingResults.set(taskUUID, {
        resolve: (url: string) => { clearTimeout(timeout); resolve(url); },
        reject: (err: Error) => { clearTimeout(timeout); reject(err); },
      });
    });
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
