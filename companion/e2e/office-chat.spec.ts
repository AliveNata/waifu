import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { type ElectronApplication, _electron as electron, expect, type Page, test } from "@playwright/test";

/*
 * The office chat lives in Electron only, so these tests launch the real app with a
 * fake `claude` (e2e/fixtures/fake-claude.mjs). Linux CI without a display skips
 * them; run `xvfb-run npx playwright test e2e/office-chat.spec.ts` there instead.
 */
test.skip(process.platform === "linux" && process.env.DISPLAY === undefined, "Electron needs a display");

const fakeClaude = resolve(import.meta.dirname, "fixtures/fake-claude.mjs");

/** A stored Claude Code session the office can list and resume. */
const storedSessionId = "0b5c2f7e-1d2a-4c3b-9e8f-5a6b7c8d9e0f";

async function launchOffice(
  extraEnv: Record<string, string> = {},
): Promise<{ app: ElectronApplication; office: Page; projectDir: string }> {
  const userData = await mkdtemp(join(tmpdir(), "office-chat-e2e-"));
  const projectDir = await mkdtemp(join(tmpdir(), "office-chat-project-"));
  const claudeConfig = await mkdtemp(join(tmpdir(), "office-chat-claude-"));
  const sessionsDir = join(claudeConfig, "projects", projectDir.replace(/[^a-zA-Z0-9]/g, "-"));
  await mkdir(sessionsDir, { recursive: true });
  await writeFile(
    join(sessionsDir, `${storedSessionId}.jsonl`),
    [
      { type: "user", message: { role: "user", content: "rapihin README" }, cwd: projectDir },
      { type: "assistant", message: { content: [{ type: "text", text: "README udah aku rapihin." }] } },
    ]
      .map((entry) => JSON.stringify(entry))
      .join("\n"),
  );
  await writeFile(
    join(userData, "companion-settings.json"),
    JSON.stringify({ officeOpen: true, chatEnabled: true, chatProjectDir: projectDir }),
  );
  const app = await electron.launch({
    // Software WebGL, like the browser tests: CI machines have no GPU.
    args: [
      resolve(import.meta.dirname, "../dist/node/main/main.js"),
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
    env: {
      ...process.env,
      WAIFU_USER_DATA_DIR: userData,
      WAIFU_COMPANION_PORT: "47933",
      WAIFU_CLAUDE_COMMAND: fakeClaude,
      CLAUDE_CONFIG_DIR: claudeConfig,
      // Sesi 2B must never fall back to a real key from the machine running the tests.
      GROQ_API_KEY: "",
      ...extraEnv,
      WAIFU_BASE_MODEL_PATH: "e2e-no-base-model.vrm",
    },
  });
  // The office can open before a "window" listener attaches, so look through open windows too.
  let office: Page | undefined;
  await expect
    .poll(
      () => {
        office = app.windows().find((page) => page.url().includes("/office/"));
        return office !== undefined;
      },
      { timeout: 30_000 },
    )
    .toBe(true);
  if (office === undefined) {
    throw new Error("office window never opened");
  }
  await expect(office.getByRole("heading", { name: "Chat ke 2B" })).toBeVisible();
  return { app, office, projectDir };
}

test.describe("office chat", () => {
  test("sends a task, shows the permission card, and streams the reply after Izinkan", async () => {
    // Arrange
    const { app, office } = await launchOffice();
    const input = office.getByLabel(/Pesan buat 2B/);
    await expect(input).toBeEnabled();

    // Act
    await input.fill("jalanin tes");
    await input.press("Enter");
    const card = office.locator(".chat-permission");
    await expect(card).toContainText("2B minta izin pakai Bash");
    await expect(card.locator("pre")).toHaveText("npm test");
    await card.getByRole("button", { name: "Izinkan" }).click();

    // Assert
    const log = office.getByRole("list", { name: "Isi obrolan" });
    // The tool call splits the reply: text before it, the answered card, then the rest.
    await expect(log.locator("li")).toHaveText([
      "Lojalanin tes",
      "2BSiap. Tugas: jalanin tes.",
      "Bash: npm test",
      "Diizinkan, Bash: npm test",
      "2BTes lulus.",
    ]);
    await expect(office.getByRole("button", { name: "Kirim" })).toBeVisible();
    await app.close();
  });

  test("denies from the keyboard and hides the chat with the toggle", async () => {
    // Arrange
    const { app, office } = await launchOffice();
    const input = office.getByLabel(/Pesan buat 2B/);
    await expect(input).toBeEnabled();

    // Act: Tab from the card's first button to Tolak and press Enter.
    await input.fill("hapus build");
    await input.press("Enter");
    const allow = office.locator(".chat-permission").getByRole("button", { name: "Izinkan" });
    await allow.focus();
    await office.keyboard.press("Tab");
    await expect(office.getByRole("button", { name: "Tolak" })).toBeFocused();
    await office.keyboard.press("Enter");

    // Assert
    await expect(office.getByRole("list", { name: "Isi obrolan" })).toContainText("Nggak jadi: Ditolak dari kantor");
    const toggle = office.getByRole("button", { name: "Tutup chat" });
    await toggle.click();
    await expect(office.locator("#chat")).toBeHidden();
    await expect(office.getByRole("button", { name: "Buka chat" })).toHaveAttribute("aria-expanded", "false");
    await app.close();
  });

  test("stops a long run", async () => {
    // Arrange
    const { app, office } = await launchOffice();
    const input = office.getByLabel(/Pesan buat 2B/);
    await expect(input).toBeEnabled();

    // Act
    await input.fill("tugas lama");
    await input.press("Enter");
    await expect(office.getByText("Siap. Tugas: tugas lama.")).toBeVisible();
    await office.getByRole("button", { name: "Stop" }).click();

    // Assert
    await expect(office.getByRole("list", { name: "Isi obrolan" })).toContainText("Dihentikan.");
    await expect(office.getByRole("button", { name: "Kirim" })).toBeVisible();
    await app.close();
  });
});

test.describe("stored sessions", () => {
  test("lists this folder's sessions, shows the picked one and carries it on", async () => {
    // Arrange
    const { app, office } = await launchOffice();
    const input = office.getByLabel(/Pesan buat 2B/);
    await expect(input).toBeEnabled();

    // Act
    await office.getByRole("button", { name: "Sesi" }).click();
    const dialog = office.getByRole("dialog", { name: "Lanjutin sesi" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: /rapihin README/ }).click();

    // Assert: the old conversation is in the log, and the next message resumes that session.
    await expect(dialog).toBeHidden();
    const log = office.getByRole("list", { name: "Isi obrolan" });
    await expect(log).toContainText("rapihin README");
    await expect(log).toContainText("README udah aku rapihin.");
    await input.fill("lanjut");
    await input.press("Enter");
    await expect(log).toContainText(`Siap (lanjut ${storedSessionId}). Tugas: lanjut.`);
    await office.locator(".chat-permission").getByRole("button", { name: "Tolak" }).click();
    await app.close();
  });

  test("closes the session list with Escape", async () => {
    // Arrange
    const { app, office } = await launchOffice();
    await expect(office.getByLabel(/Pesan buat 2B/)).toBeEnabled();
    await office.getByRole("button", { name: "Sesi" }).click();
    const dialog = office.getByRole("dialog", { name: "Lanjutin sesi" });
    await expect(dialog.getByRole("button", { name: /rapihin README/ })).toBeFocused();

    // Act
    await office.keyboard.press("Escape");

    // Assert
    await expect(dialog).toBeHidden();
    await app.close();
  });
});

test.describe("cast mentions", () => {
  test("picks a teammate from the @ list and sends the subagent mention to Claude", async () => {
    // Arrange
    const { app, office } = await launchOffice();
    const input = office.getByLabel(/Pesan buat 2B/);
    await expect(input).toBeEnabled();

    // Act
    await input.click();
    await input.pressSequentially("@er");
    const list = office.getByRole("listbox", { name: "Anggota tim" });
    await expect(list.getByRole("option")).toHaveText(["ErzaReviewer"]);
    await input.press("Enter");
    await expect(input).toHaveValue("@Erza ");
    await input.pressSequentially("cek tes");
    await input.press("Enter");

    // Assert: the log keeps what was typed, the fake CLI echoes what Claude received.
    const log = office.getByRole("list", { name: "Isi obrolan" });
    await expect(log).toContainText("@Erza cek tes");
    await expect(log).toContainText("Siap. Tugas: @agent-erza cek tes.");
    await office.locator(".chat-permission").getByRole("button", { name: "Tolak" }).click();
    await app.close();
  });
});

test.describe("office HUD", () => {
  test("hides and shows 2B's desktop window from the office", async () => {
    // Arrange
    const { app, office } = await launchOffice();
    const overlayVisible = () =>
      app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows().some((window) => window.getTitle() === "2B" && window.isVisible()),
      );
    await expect.poll(overlayVisible).toBe(true);

    // Act
    await office.getByRole("button", { name: "Sembunyiin 2B" }).click();

    // Assert
    await expect.poll(overlayVisible).toBe(false);
    await office.getByRole("button", { name: "Tampilin 2B" }).click();
    await expect.poll(overlayVisible).toBe(true);
    await app.close();
  });

  test("keeps the desktop team overlay out of the way while the office shows the conversation", async () => {
    // Arrange
    const { app, office } = await launchOffice();
    const teamOverlayVisible = () =>
      app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows().some((window) => window.getTitle() === "AlyxLabs Team" && window.isVisible()),
      );

    // Act
    const response = await office.request.post("http://127.0.0.1:47933/hook", {
      data: { hook_event_name: "SubagentStart", agent_id: "e2e-team", agent_type: "erza" },
      headers: { "content-type": "application/json" },
    });

    // Assert: the office shows the line itself, the desktop overlay stays hidden.
    expect(response.status()).toBe(202);
    await expect(office.locator("#office-dialog")).toContainText("Erza");
    expect(await teamOverlayVisible()).toBe(false);
    // Guards the check above: the window exists, it is just kept hidden.
    const teamOverlayExists = await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().some((window) => window.getTitle() === "AlyxLabs Team"),
    );
    expect(teamOverlayExists).toBe(true);
    await app.close();
  });
});

test.describe("companion overlay", () => {
  test("moves 2B's window when dragged, without a CSS drag region", async () => {
    // Arrange
    const { app } = await launchOffice();
    let overlay: Page | undefined;
    await expect
      .poll(() => {
        overlay = app.windows().find((page) => page.url().includes("/overlay/"));
        return overlay !== undefined;
      })
      .toBe(true);
    if (overlay === undefined) {
      throw new Error("overlay window never opened");
    }
    const position = () =>
      app.evaluate(({ BrowserWindow }) => {
        const window = BrowserWindow.getAllWindows().find((candidate) => candidate.getTitle() === "2B");
        return window?.getPosition() ?? [0, 0];
      });
    const before = await position();

    // Act: press near the top-left corner, clear of the model panel and the Menu button.
    await overlay.mouse.move(20, 60);
    await overlay.mouse.down();
    // One step: Playwright derives screen coordinates from the window's current position, so after
    // the window moves, later steps would report a bigger offset than a real mouse does.
    await overlay.mouse.move(50, 80, { steps: 1 });
    await overlay.mouse.up();

    // Assert
    await expect.poll(position).toEqual([(before[0] ?? 0) + 30, (before[1] ?? 0) + 20]);
    // The size stays what the window was created with: dragging must never grow her.
    const size = await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((candidate) => candidate.getTitle() === "2B")
        ?.getSize(),
    );
    expect(size).toEqual([340, 440]);
    await app.close();
  });
});

/** A stand-in for Groq's chat API that records what it was sent. */
async function fakeGroq(): Promise<{ server: Server; baseUrl: string; prompts: string[] }> {
  const prompts: string[] = [];
  const server = createServer((request, response) => {
    let raw = "";
    request.on("data", (chunk: Buffer) => {
      raw += chunk.toString("utf8");
    });
    request.on("end", () => {
      response.writeHead(200, { "content-type": "application/json" });
      if (request.url?.endsWith("/models") === true) {
        response.end(JSON.stringify({ data: [{ id: "openai/gpt-oss-120b" }, { id: "openai/gpt-oss-20b" }] }));
        return;
      }
      const body = JSON.parse(raw) as { messages: { role: string; content: string }[] };
      const last = body.messages.at(-1)?.content ?? "";
      prompts.push(last);
      response.end(
        JSON.stringify({ choices: [{ message: { content: `[mood:warm] [pose:wave] Aku dengerin: ${last}` } }] }),
      );
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${port}/openai/v1`, prompts };
}

test.describe("Sesi 2B", () => {
  test("talks to 2B through Groq, never Claude, handles poses locally, and forgets on end", async () => {
    // Arrange
    const groq = await fakeGroq();
    const { app, office } = await launchOffice({ WAIFU_GROQ_BASE_URL: groq.baseUrl, GROQ_API_KEY: "gsk_e2e_fake_key" });
    const input = office.getByLabel(/Pesan buat 2B/);
    await expect(input).toBeEnabled();

    // Act: pick 2B from the @ list and send a first message.
    await input.click();
    await input.pressSequentially("@2");
    await expect(office.getByRole("listbox", { name: "Anggota tim" }).getByRole("option").first()).toHaveText(
      "2BSesi 2B, tanpa Claude",
    );
    await input.press("Enter");
    await input.pressSequentially("hari ini capek");
    await input.press("Enter");

    // Assert: the mode shows, Groq answered, Claude's log stayed empty.
    await expect(office.getByRole("heading", { name: "Sesi 2B" })).toBeVisible();
    await expect(office.getByText("Tanpa Claude", { exact: true })).toBeVisible();
    const twobLog = office.getByRole("list", { name: "Isi obrolan Sesi 2B" });
    await expect(twobLog).toContainText("Aku dengerin: hari ini capek");
    expect(groq.prompts).toEqual(["hari ini capek"]);
    // 2B on the desktop says the first sentence of her reply in her bubble.
    const overlay = app.windows().find((page) => page.url().includes("/overlay/"));
    await expect(overlay?.locator("#touch-line") ?? office.locator("#missing-overlay")).toHaveText(
      "Aku dengerin: hari ini capek",
    );
    await expect(office.getByRole("list", { name: "Isi obrolan", exact: true })).toBeHidden();

    // A pose request stays local: no call to Groq.
    await input.fill("angkat tangan");
    await input.press("Enter");
    await expect(twobLog).toContainText("2B angkat tangan di desktop.");
    expect(groq.prompts).toHaveLength(1);

    // Words about self-harm bring up where to get help, written by the app.
    await input.fill("kadang aku pengen mati aja");
    await input.press("Enter");
    await expect(twobLog).toContainText("119 ekstensi 8");

    // Ending the session clears it and says the next message goes to Claude.
    await office.getByRole("button", { name: "Akhiri sesi 2B" }).click();
    await expect(office.getByRole("heading", { name: "Chat ke 2B" })).toBeVisible();
    await expect(twobLog).toBeHidden();
    await expect(office.getByRole("list", { name: "Isi obrolan", exact: true })).toContainText(
      "Pesan berikutnya ke Claude.",
    );
    await app.close();
    await new Promise<void>((resolve) => groq.server.close(() => resolve()));
  });

  test("asks for a Groq key first when there is none", async () => {
    // Arrange
    const { app, office } = await launchOffice();
    const input = office.getByLabel(/Pesan buat 2B/);
    await expect(input).toBeEnabled();

    // Act
    await input.fill("@2B halo");
    await input.press("Enter");

    // Assert: the key form, and on a machine without a keyring an honest refusal to store it.
    const form = office.getByLabel("API key Groq");
    await expect(form).toBeFocused();
    await form.fill("gsk_e2e_fake_key_123");
    await office.getByRole("button", { name: "Simpan key" }).click();
    await expect(office.getByRole("alert")).toContainText(/GROQ_API_KEY|Penyimpanan aman/);
    await app.close();
  });

  test("picks another Groq model from the account's own list", async () => {
    // Arrange
    const groq = await fakeGroq();
    const { app, office } = await launchOffice({ WAIFU_GROQ_BASE_URL: groq.baseUrl, GROQ_API_KEY: "gsk_e2e_fake_key" });
    const input = office.getByLabel(/Pesan buat 2B/);
    await expect(input).toBeEnabled();
    await input.fill("@2B");
    // The first Enter picks 2B from the @ list, the second sends.
    await input.press("Enter");
    await input.press("Enter");
    await expect(office.getByRole("heading", { name: "Sesi 2B" })).toBeVisible();

    // Act
    await office.getByRole("button", { name: "Model" }).click();
    const dialog = office.getByRole("dialog", { name: "Model Groq buat 2B" });
    await dialog.getByRole("button", { name: "openai/gpt-oss-20b" }).click();

    // Assert
    await expect(dialog).toBeHidden();
    await expect(office.getByRole("list", { name: "Isi obrolan Sesi 2B" })).toContainText(
      "Model ganti ke openai/gpt-oss-20b.",
    );
    await app.close();
    await new Promise<void>((resolve) => groq.server.close(() => resolve()));
  });
});
