import { mkdtemp, writeFile } from "node:fs/promises";
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

async function launchOffice(): Promise<{ app: ElectronApplication; office: Page; projectDir: string }> {
  const userData = await mkdtemp(join(tmpdir(), "office-chat-e2e-"));
  const projectDir = await mkdtemp(join(tmpdir(), "office-chat-project-"));
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
});
