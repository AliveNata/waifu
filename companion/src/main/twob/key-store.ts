import { chmod, readFile, rm, writeFile } from "node:fs/promises";

/**
 * Keeps the Groq API key on disk only encrypted by the OS (DPAPI on Windows, Keychain on
 * macOS, the keyring on Linux). Never in settings, the repo or a log.
 */
export interface Encryptor {
  isEncryptionAvailable(): boolean;
  /** Linux only: "basic_text" means no keyring, so "encrypted" would just be obfuscated. */
  getSelectedStorageBackend?(): string;
  encryptString(plain: string): Buffer;
  decryptString(encrypted: Buffer): string;
}

export class KeyStore {
  private cached: string | null | undefined;

  constructor(
    private readonly path: string,
    private readonly encryptor: Encryptor,
    private readonly platform: NodeJS.Platform = process.platform,
  ) {}

  /** Null when nothing is saved. A file that no longer decrypts (another user, another machine) counts as nothing. */
  async load(): Promise<string | null> {
    if (this.cached !== undefined) {
      return this.cached;
    }
    let bytes: Buffer;
    try {
      bytes = await readFile(this.path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        this.cached = null;
        return null;
      }
      throw error;
    }
    try {
      this.cached = this.encryptor.decryptString(bytes);
    } catch (error) {
      console.error("[twob] the saved Groq key could not be decrypted; it has to be entered again", error);
      this.cached = null;
    }
    return this.cached;
  }

  /** Throws with a readable reason when the OS offers no real encryption. */
  async save(key: string): Promise<void> {
    const trimmed = key.trim();
    if (!/^[\x21-\x7e]{10,}$/.test(trimmed)) {
      throw new Error("Itu kelihatannya bukan API key Groq.");
    }
    const backend = this.encryptor.getSelectedStorageBackend?.();
    if (!this.encryptor.isEncryptionAvailable() || (this.platform === "linux" && backend === "basic_text")) {
      throw new Error(
        "Penyimpanan aman di sistem ini nggak tersedia. Set variabel GROQ_API_KEY aja sebelum npm start.",
      );
    }
    await writeFile(this.path, this.encryptor.encryptString(trimmed), { mode: 0o600 });
    await chmod(this.path, 0o600);
    this.cached = trimmed;
  }

  async clear(): Promise<void> {
    await rm(this.path, { force: true });
    this.cached = null;
  }
}
