import { mkdtemp, readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { type ChatMessage, GroqClient, GroqError, isChatModel } from "../src/main/twob/groq-client.js";
import { type Encryptor, KeyStore } from "../src/main/twob/key-store.js";
import { TwobSession, twobSystemPrompt } from "../src/main/twob/twob-session.js";
import { poseNote } from "../src/renderer/office/twob-chat-panel.js";

interface Recorded {
  method: string;
  url: string;
  auth: string | undefined;
  body: Record<string, unknown> | null;
}

let server: Server | null = null;

async function fakeGroq(
  respond: (request: Recorded) => { status: number; body: unknown; headers?: Record<string, string> },
): Promise<{ baseUrl: string; requests: Recorded[] }> {
  const requests: Recorded[] = [];
  server = createServer((req: IncomingMessage, res) => {
    let raw = "";
    req.on("data", (chunk: Buffer) => {
      raw += chunk.toString("utf8");
    });
    req.on("end", () => {
      const recorded = {
        method: req.method ?? "",
        url: req.url ?? "",
        auth: req.headers.authorization,
        body: raw === "" ? null : (JSON.parse(raw) as Record<string, unknown>),
      };
      requests.push(recorded);
      const answer = respond(recorded);
      res.writeHead(answer.status, { "content-type": "application/json", ...answer.headers });
      res.end(JSON.stringify(answer.body));
    });
  });
  await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return { baseUrl: `http://127.0.0.1:${port}/openai/v1`, requests };
}

afterEach(async () => {
  await new Promise<void>((resolve) => (server === null ? resolve() : server.close(() => resolve())));
  server = null;
});

const reply = (content: string) => ({ status: 200, body: { choices: [{ message: { content } }] } });

describe("GroqClient", () => {
  it("lists only chat models, sorted, with the key as a bearer token", async () => {
    // Arrange
    const { baseUrl, requests } = await fakeGroq(() => ({
      status: 200,
      body: { data: [{ id: "whisper-large-v3" }, { id: "openai/gpt-oss-120b" }, { id: "openai/gpt-oss-20b" }] },
    }));
    const client = new GroqClient(() => "gsk_test_key_123", baseUrl);

    // Act
    const models = await client.listModels();

    // Assert
    expect(models).toEqual(["openai/gpt-oss-120b", "openai/gpt-oss-20b"]);
    expect(requests[0]?.auth).toBe("Bearer gsk_test_key_123");
  });

  it("asks gpt-oss models for low reasoning effort and returns the reply text", async () => {
    // Arrange
    const { baseUrl, requests } = await fakeGroq(() => reply("[mood:warm] Hai."));
    const client = new GroqClient(() => "gsk_test_key_123", baseUrl);

    // Act
    const text = await client.chat("openai/gpt-oss-120b", [{ role: "user", content: "halo" }]);

    // Assert
    expect(text).toBe("[mood:warm] Hai.");
    expect(requests[0]?.url).toBe("/openai/v1/chat/completions");
    expect(requests[0]?.body).toMatchObject({ model: "openai/gpt-oss-120b", reasoning_effort: "low" });
  });

  it.each([
    [401, {}, /API key Groq ditolak/],
    [429, { "retry-after": "12" }, /Batas pemakaian gratis Groq lagi kena\. Coba lagi sekitar 12 detik lagi\./],
    [404, {}, /udah dipensiunin/],
    [500, {}, /kode 500/],
  ] as const)("turns HTTP %d into a readable message", async (status, headers, message) => {
    // Arrange
    const { baseUrl } = await fakeGroq(() => ({ status, body: { error: { message: "x" } }, headers }));
    const client = new GroqClient(() => "gsk_test_key_123", baseUrl);

    // Act
    const failure = client.chat("m", [{ role: "user", content: "halo" }]);

    // Assert
    await expect(failure).rejects.toThrow(message);
  });

  it("refuses to call Groq without a key", async () => {
    // Arrange
    const client = new GroqClient(() => null, "http://127.0.0.1:9/openai/v1");

    // Act + Assert
    await expect(client.listModels()).rejects.toBeInstanceOf(GroqError);
  });

  it("leaves speech and guard models out", () => {
    // Act + Assert
    expect(isChatModel("openai/gpt-oss-20b")).toBe(true);
    expect(isChatModel("whisper-large-v3")).toBe(false);
    expect(isChatModel("meta-llama/llama-guard-4-12b")).toBe(false);
  });
});

/** Stands in for Electron's safeStorage: reversible, but never the plain key on disk. */
function fakeEncryptor(overrides: Partial<Encryptor> = {}): Encryptor {
  return {
    isEncryptionAvailable: () => true,
    getSelectedStorageBackend: () => "gnome_libsecret",
    encryptString: (plain) => Buffer.from(`enc:${Buffer.from(plain).toString("base64")}`),
    decryptString: (bytes) => {
      const text = bytes.toString("utf8");
      if (!text.startsWith("enc:")) {
        throw new Error("cannot decrypt");
      }
      return Buffer.from(text.slice(4), "base64").toString("utf8");
    },
    ...overrides,
  };
}

describe("KeyStore", () => {
  it("saves the key encrypted, loads it back, and forgets it on clear", async () => {
    // Arrange
    const path = join(await mkdtemp(join(tmpdir(), "groq-key-")), "groq-key.bin");
    const store = new KeyStore(path, fakeEncryptor(), "win32");

    // Act
    await store.save("  gsk_live_key_abcdef  ");
    const onDisk = await readFile(path, "utf8");
    const loaded = await new KeyStore(path, fakeEncryptor(), "win32").load();
    await store.clear();

    // Assert
    expect(onDisk).not.toContain("gsk_live_key_abcdef");
    expect(loaded).toBe("gsk_live_key_abcdef");
    expect(await new KeyStore(path, fakeEncryptor(), "win32").load()).toBeNull();
  });

  it("refuses to save when the OS only offers plain-text storage", async () => {
    // Arrange
    const path = join(await mkdtemp(join(tmpdir(), "groq-key-")), "groq-key.bin");
    const store = new KeyStore(path, fakeEncryptor({ getSelectedStorageBackend: () => "basic_text" }), "linux");

    // Act + Assert
    await expect(store.save("gsk_live_key_abcdef")).rejects.toThrow(/GROQ_API_KEY/);
  });

  it("rejects text that cannot be a key", async () => {
    // Arrange
    const path = join(await mkdtemp(join(tmpdir(), "groq-key-")), "groq-key.bin");
    const store = new KeyStore(path, fakeEncryptor(), "win32");

    // Act + Assert
    await expect(store.save("halo apa kabar")).rejects.toThrow(/bukan API key/);
  });
});

describe("TwobSession", () => {
  function fakeClient(answers: (string | Error)[]) {
    const calls: ChatMessage[][] = [];
    const client = {
      chat: async (_model: string, messages: readonly ChatMessage[]) => {
        calls.push([...messages]);
        const next = answers.shift();
        if (next instanceof Error || next === undefined) {
          throw next ?? new Error("no answer");
        }
        return next;
      },
    };
    return { client: client as unknown as GroqClient, calls };
  }

  it("sends the persona and the conversation so far, and parses her tags", async () => {
    // Arrange
    const { client, calls } = fakeClient(["[mood:concern] Capek ya. Mau cerita?", "[mood:warm] Aku dengerin."]);
    const session = new TwobSession(client, () => "openai/gpt-oss-120b");
    session.start();

    // Act
    const first = await session.send("hari ini capek banget");
    await session.send("iya");

    // Assert
    expect(first).toEqual({ text: "Capek ya. Mau cerita?", mood: "concern", pose: null });
    expect(calls[1]?.[0]).toEqual({ role: "system", content: twobSystemPrompt });
    expect(calls[1]?.map((message) => message.role)).toEqual(["system", "user", "assistant", "user"]);
  });

  it("drops a failed turn so sending again asks the same thing once", async () => {
    // Arrange
    const { client, calls } = fakeClient([new GroqError("limit", 429), "[mood:calm] Oke."]);
    const session = new TwobSession(client, () => "m");
    session.start();

    // Act
    await expect(session.send("halo")).rejects.toThrow("limit");
    await session.send("halo");

    // Assert
    expect(calls[1]?.filter((message) => message.role === "user")).toHaveLength(1);
  });

  it("forgets everything when the session ends", async () => {
    // Arrange
    const { client, calls } = fakeClient(["[mood:calm] A.", "[mood:calm] B."]);
    const session = new TwobSession(client, () => "m");
    session.start();
    await session.send("rahasia");

    // Act
    session.end();
    session.start();
    await session.send("halo");

    // Assert
    expect(JSON.stringify(calls[1])).not.toContain("rahasia");
  });

  it("refuses messages before the session starts", async () => {
    // Arrange
    const { client } = fakeClient([]);
    const session = new TwobSession(client, () => "m");

    // Act + Assert
    await expect(session.send("halo")).rejects.toThrow(/belum dimulai/);
  });
});

describe("poseNote", () => {
  it("says what 2B just did on the desktop", () => {
    // Act + Assert
    expect(poseNote({ pose: "raise-hand", face: null })).toBe("2B angkat tangan di desktop.");
    expect(poseNote({ pose: "wave", face: "smile" })).toBe("2B dadah, senyum di desktop.");
  });
});
