import type { Vault } from 'obsidian';
import { v4 as uuidv4 } from 'uuid';

/**
 * Saves generated images to the vault as PNG files.
 *
 * Naming convention: {date}_{uuid-short}.png per D-07.
 * Default folder: canvas-ai-images/ at vault root.
 * Creates the folder if it doesn't exist.
 *
 * Base64 decode uses atob + Uint8Array (fast for 1024x1024 PNGs, Pitfall 6).
 */
export class ImageSaver {
  constructor(
    private vault: Vault,
    private folderPath: string = 'canvas-ai-images'
  ) {}

  /** Update the save folder path (e.g., from settings change) */
  updateFolderPath(path: string): void {
    this.folderPath = path;
  }

  /**
   * Decode base64 image data and save to vault as a PNG file.
   * Creates the folder if it doesn't exist.
   * Returns the vault-relative file path.
   */
  async saveToVault(base64Data: string): Promise<string> {
    // Ensure folder exists
    if (!this.vault.getAbstractFileByPath(this.folderPath)) {
      await this.vault.createFolder(this.folderPath);
    }

    // Generate filename: {date}_{uuid-short}.png per D-07
    const date = new Date().toISOString().split('T')[0];
    const shortId = uuidv4().split('-')[0]; // First 8 chars
    const fileName = `${date}_${shortId}.png`;
    const filePath = `${this.folderPath}/${fileName}`;

    // Decode base64 to ArrayBuffer (Pitfall 6: fast for 1024x1024 PNGs)
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    await this.vault.createBinary(filePath, bytes.buffer);

    return filePath;
  }
}
