import { defineConfig } from "@playwright/test";

const port = 47910;

export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  // Every page listens to the same hook server, so parallel tests would see each other's hooks.
  workers: 1,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    launchOptions: {
      // Headless CI machines have no GPU. SwiftShader gives WebGL a software fallback.
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    },
  },
  webServer: {
    command: "node dist/node/server/web-server.js",
    url: `http://127.0.0.1:${port}/healthz`,
    // No base model: keeps the empty states deterministic and the suite fast on GPU-less machines.
    env: {
      WAIFU_COMPANION_PORT: String(port),
      WAIFU_BASE_MODEL_PATH: "e2e-no-base-model.vrm",
      // The office under test is the repo's, without the courier or local-only props in models/.
      WAIFU_IGNORE_LOCAL_MODELS: "1",
    },
    reuseExistingServer: false,
  },
});
