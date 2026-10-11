/**
 * Groq's OpenAI-compatible chat API, called with plain fetch so no SDK ships in the app.
 * Base URL is overridable for tests, which point it at a local fake.
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** An error worth showing to the user as is, already in the chat's language. */
export class GroqError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = "GroqError";
  }
}

export const defaultGroqBaseUrl = "https://api.groq.com/openai/v1";
/** Groq's production pick after llama-3.3-70b-versatile was retired for free and developer tiers. */
export const defaultGroqModel = "openai/gpt-oss-120b";
const requestTimeoutMs = 60_000;

/** Speech, moderation and agent systems are listed too; only plain chat models make sense here. */
export function isChatModel(id: string): boolean {
  return !/whisper|tts|orpheus|playai|guard|compound|distil/i.test(id);
}

function friendlyError(status: number, body: string, retryAfter: string | null): GroqError {
  if (status === 401 || status === 403) {
    return new GroqError("API key Groq ditolak. Cek lagi key-nya di Menu > Groq API key.", status);
  }
  if (status === 429) {
    const wait = retryAfter === null ? "" : ` Coba lagi sekitar ${retryAfter} detik lagi.`;
    return new GroqError(`Batas pemakaian gratis Groq lagi kena.${wait}`, status);
  }
  if (status === 404 || /model_not_found|decommissioned/i.test(body)) {
    return new GroqError(
      "Model ini nggak ada atau udah dipensiunin Groq. Pilih model lain lewat tombol Model.",
      status,
    );
  }
  return new GroqError(`Groq lagi error (kode ${status}). Coba lagi bentar.`, status);
}

export class GroqClient {
  constructor(
    private readonly apiKey: () => string | null,
    private readonly baseUrl: string = defaultGroqBaseUrl,
  ) {}

  private key(): string {
    const key = this.apiKey();
    if (key === null || key === "") {
      throw new GroqError("Belum ada API key Groq. Isi dulu di form di chat atau lewat Menu > Groq API key.", null);
    }
    return key;
  }

  private async request(path: string, init: RequestInit): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: { authorization: `Bearer ${this.key()}`, "content-type": "application/json" },
        signal: init.signal ?? AbortSignal.timeout(requestTimeoutMs),
      });
    } catch (error) {
      if (error instanceof GroqError) {
        throw error;
      }
      console.error("[twob] Groq request failed", error);
      throw new GroqError("Nggak bisa nyambung ke Groq. Cek koneksi internet lo.", null);
    }
    const body = await response.text();
    if (!response.ok) {
      console.error(`[twob] Groq answered ${response.status}`, body.slice(0, 300));
      throw friendlyError(response.status, body, response.headers.get("retry-after"));
    }
    try {
      return JSON.parse(body) as unknown;
    } catch (error) {
      console.error("[twob] Groq sent a non-JSON body", error);
      throw new GroqError("Balasan Groq nggak kebaca. Coba lagi bentar.", response.status);
    }
  }

  /** Chat model ids on this account, sorted. */
  async listModels(): Promise<string[]> {
    const json = (await this.request("/models", { method: "GET" })) as { data?: { id?: unknown }[] };
    return (json.data ?? [])
      .flatMap((model) => (typeof model.id === "string" && isChatModel(model.id) ? [model.id] : []))
      .sort();
  }

  async chat(model: string, messages: readonly ChatMessage[], signal?: AbortSignal): Promise<string> {
    const body: Record<string, unknown> = { model, messages, temperature: 0.8, max_completion_tokens: 600 };
    if (model.startsWith("openai/gpt-oss")) {
      // Reasoning models think before answering; a companion chat needs quick, short replies.
      body.reasoning_effort = "low";
    }
    const json = (await this.request("/chat/completions", {
      method: "POST",
      body: JSON.stringify(body),
      ...(signal === undefined ? {} : { signal }),
    })) as { choices?: { message?: { content?: unknown } }[] };
    const content = json.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.trim() === "") {
      throw new GroqError("Groq ngasih balasan kosong. Coba kirim lagi.", null);
    }
    return content;
  }
}
