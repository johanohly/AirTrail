import { env } from '$env/dynamic/private';
import * as fs from 'fs';
import * as path from 'path';

export const ALLOWED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/svg+xml',
  'image/webp',
];
export const ALLOWED_IMAGE_EXTENSIONS = ['.png', '.jpg', '.svg', '.webp'];
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

class UploadManager {
  #uploadLocation: string | null = null;
  #isConfigured: boolean = false;
  #isReady: boolean = false;

  async init(): Promise<void> {
    this.#uploadLocation = env.UPLOAD_LOCATION || null;

    if (!this.#uploadLocation) {
      console.warn('UPLOAD_LOCATION not set. File uploads will be disabled.');
      return;
    }

    this.#isConfigured = true;

    try {
      // Check if directory exists
      if (!fs.existsSync(this.#uploadLocation)) {
        console.warn(
          `UPLOAD_LOCATION "${this.#uploadLocation}" does not exist. File uploads will fail.`,
        );
        return;
      }

      // Check read/write permissions by attempting to create and delete a test file
      const testFile = path.join(this.#uploadLocation, '.write_test');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);

      this.#isReady = true;
      console.log(`Upload location configured: ${this.#uploadLocation}`);
    } catch (err) {
      console.warn(
        `UPLOAD_LOCATION "${this.#uploadLocation}" is not readable/writable. File uploads will fail.`,
        err,
      );
    }
  }

  get isConfigured(): boolean {
    return this.#isConfigured;
  }

  get isReady(): boolean {
    return this.#isReady;
  }

  get uploadLocation(): string | null {
    return this.#uploadLocation;
  }

  getFilePath(relativePath: string): string | null {
    if (!this.#uploadLocation) return null;
    return path.join(this.#uploadLocation, relativePath);
  }

  async saveFile(
    relativePath: string,
    data: Buffer | Uint8Array,
  ): Promise<boolean> {
    if (!this.#isReady || !this.#uploadLocation) return false;

    const fullPath = path.join(this.#uploadLocation, relativePath);
    const dir = path.dirname(fullPath);

    // Ensure directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, data);
    return true;
  }

  async deleteFile(relativePath: string): Promise<boolean> {
    if (!this.#isReady || !this.#uploadLocation) return false;

    const fullPath = path.join(this.#uploadLocation, relativePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      return true;
    }
    return false;
  }

  fileExists(relativePath: string): boolean {
    if (!this.#uploadLocation) return false;
    return fs.existsSync(path.join(this.#uploadLocation, relativePath));
  }
}

export const uploadManager = new UploadManager();
