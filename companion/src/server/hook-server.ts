import { EventEmitter } from "node:events";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { basename, extname, join, normalize, resolve, sep } from "node:path";
import { parseHookPayload } from "../shared/hook-event.js";
import { type Reaction, reactionForHook } from "../shared/reaction.js";

const maxBodyBytes = 16 * 1024;

export interface WebModeOptions {
  /** Built renderer directory (dist/renderer). */
  staticDir: string;
  /** Optional .vrm served at GET /model so the browser pages can load it without a picker. */
  modelPath: string | null;
}

export interface HookServerOptions {
  host: string;
  port: number;
  now?: () => number;
  /** Only set by the browser fallback: Electron talks to renderers over IPC instead. */
  web?: WebModeOptions;
}

interface HookServerEvents {
  reaction: [Reaction];
}

export class HookServer extends EventEmitter<HookServerEvents> {
  private readonly server: Server;
  private readonly sseClients = new Set<ServerResponse>();
  private readonly now: () => number;

  constructor(private readonly options: HookServerOptions) {
    super();
    this.now = options.now ?? Date.now;
    this.server = createServer((request, response) => {
      this.route(request, response).catch((error: unknown) => {
        console.error("[hook-server] request failed", error);
        if (!response.headersSent) {
          sendJson(response, 500, { ok: false, error: "internal error" });
        } else {
          response.end();
        }
      });
    });
  }

  listen(): Promise<number> {
    return new Promise((resolvePromise, rejectPromise) => {
      const onError = (error: Error): void => {
        this.server.off("listening", onListening);
        rejectPromise(error);
      };
      const onListening = (): void => {
        this.server.off("error", onError);
        const address = this.server.address();
        if (address === null || typeof address === "string") {
          rejectPromise(new Error("hook server has no TCP address"));
          return;
        }
        resolvePromise(address.port);
      };
      this.server.once("error", onError);
      this.server.once("listening", onListening);
      this.server.listen(this.options.port, this.options.host);
    });
  }

  close(): Promise<void> {
    for (const client of this.sseClients) {
      client.end();
    }
    this.sseClients.clear();
    return new Promise((resolvePromise, rejectPromise) => {
      this.server.close((error) => (error ? rejectPromise(error) : resolvePromise()));
    });
  }

  private async route(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const url = new URL(request.url ?? "/", "http://localhost");

    if (request.method === "POST" && url.pathname === "/hook") {
      await this.handleHook(request, response);
      return;
    }
    if (request.method === "GET" && url.pathname === "/healthz") {
      sendJson(response, 200, { ok: true });
      return;
    }

    const web = this.options.web;
    if (web !== undefined && request.method === "GET") {
      if (url.pathname === "/events") {
        this.openEventStream(response);
        return;
      }
      if (url.pathname === "/model") {
        await serveModel(web.modelPath, response);
        return;
      }
      await serveStatic(web.staticDir, url.pathname, response);
      return;
    }

    sendJson(response, 404, { ok: false, error: "not found" });
  }

  private async handleHook(request: IncomingMessage, response: ServerResponse): Promise<void> {
    // Requiring a JSON content type forces a CORS preflight for cross-origin
    // browser requests, which this server never answers. That keeps random
    // websites from poking the companion through the user's browser.
    const contentType = request.headers["content-type"] ?? "";
    if (!contentType.startsWith("application/json")) {
      sendJson(response, 415, { ok: false, error: "content-type must be application/json" });
      return;
    }

    const body = await readBody(request, maxBodyBytes);
    if (body === null) {
      sendJson(response, 413, { ok: false, error: `body larger than ${maxBodyBytes} bytes` });
      return;
    }

    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch (error) {
      sendJson(response, 400, { ok: false, error: `invalid JSON: ${(error as Error).message}` });
      return;
    }

    const parsed = parseHookPayload(json);
    if (!parsed.ok) {
      sendJson(response, 400, { ok: false, error: parsed.error });
      return;
    }

    const reaction = reactionForHook(parsed.value, this.now());
    if (reaction !== null) {
      this.emit("reaction", reaction);
      this.broadcastSse(reaction);
    }
    sendJson(response, 202, { ok: true, mood: reaction?.mood ?? null });
  }

  private openEventStream(response: ServerResponse): void {
    response.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    response.write(": connected\n\n");
    this.sseClients.add(response);
    response.on("close", () => this.sseClients.delete(response));
  }

  private broadcastSse(reaction: Reaction): void {
    const frame = `event: reaction\ndata: ${JSON.stringify(reaction)}\n\n`;
    for (const client of this.sseClients) {
      client.write(frame);
    }
  }
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readBody(request: IncomingMessage, limit: number): Promise<string | null> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = chunk as Buffer;
    size += buffer.length;
    if (size > limit) {
      request.resume();
      return null;
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

const contentTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

async function serveStatic(staticDir: string, pathname: string, response: ServerResponse): Promise<void> {
  const root = resolve(staticDir);
  const relativePath = pathname.endsWith("/") ? `${pathname}index.html` : pathname;
  const filePath = normalize(join(root, decodeURIComponent(relativePath)));
  if (filePath !== root && !filePath.startsWith(root + sep)) {
    sendJson(response, 403, { ok: false, error: "forbidden" });
    return;
  }

  const fileStat = await stat(filePath).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") {
      return null;
    }
    throw error;
  });
  if (fileStat === null || !fileStat.isFile()) {
    sendJson(response, 404, { ok: false, error: "not found" });
    return;
  }

  response.writeHead(200, {
    "content-type": contentTypes[extname(filePath)] ?? "application/octet-stream",
    "content-length": fileStat.size,
  });
  createReadStream(filePath).pipe(response);
}

async function serveModel(modelPath: string | null, response: ServerResponse): Promise<void> {
  if (modelPath === null) {
    // 204 instead of 404: "no model yet" is a normal state, not an error worth a red console line.
    response.writeHead(204);
    response.end();
    return;
  }
  const bytes = await readFile(modelPath);
  response.writeHead(200, {
    "content-type": "model/gltf-binary",
    "content-length": bytes.length,
    "x-model-name": encodeURIComponent(basename(modelPath)),
  });
  response.end(bytes);
}
