import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";

const sampleModelPath = process.env.WAIFU_SAMPLE_VRM;

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  return errors;
}

async function openPage(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page.locator("html")).toHaveAttribute("data-events", "connected");
}

async function postHook(page: Page, body: Record<string, string>): Promise<void> {
  const response = await page.request.post("/hook", { data: body, headers: { "content-type": "application/json" } });
  expect(response.status()).toBe(202);
}

test.describe("overlay", () => {
  test("shows the empty state with a keyboard-reachable picker", async ({ page }) => {
    // Arrange
    const errors = collectErrors(page);

    // Act
    await openPage(page, "/overlay/");
    await expect(page.locator("#panel-title")).toHaveText("Belum ada model");
    await page.keyboard.press("Tab");

    // Assert
    const picker = page.getByRole("button", { name: "Pilih file .vrm" });
    await expect(picker).toBeFocused();
    expect(await picker.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe("solid");
    expect(errors).toEqual([]);
  });

  test("updates the status chip from main-session hooks only", async ({ page }) => {
    // Arrange
    await openPage(page, "/overlay/");
    const status = page.getByRole("status");

    // Act + Assert
    await postHook(page, { hook_event_name: "PreToolUse", tool_name: "Bash" });
    await expect(status).toHaveText("Ngerjain: Bash");

    await postHook(page, { hook_event_name: "PreToolUse", tool_name: "Edit", agent_id: "a", agent_type: "reviewer" });
    await expect(status).toHaveText("Ngerjain: Bash");

    await postHook(page, { hook_event_name: "Notification", message: "Claude needs your permission to use Bash" });
    await expect(status).toHaveAttribute("data-tone", "attention");

    await postHook(page, { hook_event_name: "SessionEnd" });
    await expect(status).toBeHidden();
  });

  test("shows an error state for a file that is not a VRM", async ({ page }) => {
    // Arrange
    await openPage(page, "/overlay/");
    const chooser = page.waitForEvent("filechooser");

    // Act
    await page.getByRole("button", { name: "Pilih file .vrm" }).click();
    await (await chooser).setFiles({
      name: "rusak.vrm",
      mimeType: "model/gltf-binary",
      buffer: Buffer.from("bukan glb"),
    });

    // Assert
    await expect(page.locator("#panel-title")).toHaveText("Model gagal dimuat");
    await expect(page.getByRole("button", { name: "Pilih file lain" })).toBeVisible();
  });

  test("loads a real VRM", async ({ page }) => {
    test.skip(sampleModelPath === undefined, "set WAIFU_SAMPLE_VRM to a .vrm file to run this test");
    // Arrange
    const errors = collectErrors(page);
    await openPage(page, "/overlay/");
    const chooser = page.waitForEvent("filechooser");

    // Act
    await page.getByRole("button", { name: "Pilih file .vrm" }).click();
    await (await chooser).setFiles({
      name: "sample.vrm",
      mimeType: "model/gltf-binary",
      buffer: readFileSync(sampleModelPath as string),
    });

    // Assert
    await expect(page.locator("#panel")).toBeHidden({ timeout: 90_000 });
    expect(errors).toEqual([]);
  });
});

test.describe("office", () => {
  test("renders the team with placeholders and no errors", async ({ page }) => {
    // Arrange
    const errors = collectErrors(page);

    // Act
    await openPage(page, "/office/");
    await page.waitForTimeout(1500);

    // Assert
    await expect(page.locator("#scene")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("shows a close-up of the member a subagent hook names", async ({ page }) => {
    // Arrange
    await openPage(page, "/office/");
    const caption = page.locator("#closeup-caption");
    await expect(caption).toBeHidden();

    // Act
    await postHook(page, { hook_event_name: "SubagentStart", agent_id: "r1", agent_type: "reviewer" });
    await postHook(page, { hook_event_name: "PreToolUse", agent_id: "r1", agent_type: "reviewer", tool_name: "Bash" });

    // Assert
    await expect(caption).toContainText("Erza · Reviewer");
    await expect(caption).toContainText("(Bash)");
    await expect(caption).toContainText("layar simulasi");
  });

  test("toggles the close-up from the keyboard", async ({ page }) => {
    // Arrange
    await openPage(page, "/office/");
    await postHook(page, { hook_event_name: "SubagentStart", agent_id: "d1", agent_type: "data-engineer" });
    const caption = page.locator("#closeup-caption");
    await expect(caption).toContainText("Asuna");
    const toggle = page.getByRole("button", { name: "Sembunyikan close-up" });

    // Act
    await toggle.focus();
    await page.keyboard.press("Enter");

    // Assert
    await expect(caption).toBeHidden();
    await expect(page.getByRole("button", { name: "Tampilkan close-up" })).toHaveAttribute("aria-pressed", "false");
  });

  test("opens the model dialog and closes it with Escape", async ({ page }) => {
    // Arrange
    await openPage(page, "/office/");

    // Act
    await page.getByRole("button", { name: "Model" }).click();

    // Assert
    const dialog = page.getByRole("dialog", { name: "Pilih model .vrm" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button")).toHaveCount(8);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("falls back to the placeholder when a picked model is broken", async ({ page }) => {
    // Arrange
    await openPage(page, "/office/");
    await page.getByRole("button", { name: "Model" }).click();
    const chooser = page.waitForEvent("filechooser");

    // Act
    await page.getByRole("button", { name: "Asuna (Data Engineer)" }).click();
    await (await chooser).setFiles({ name: "rusak.vrm", mimeType: "model/gltf-binary", buffer: Buffer.from("x") });

    // Assert
    await expect(page.getByRole("status")).toContainText("Model Asuna gagal dimuat, pakai placeholder");
    await expect(page.getByRole("status")).toHaveAttribute("data-tone", "error");
  });
});
