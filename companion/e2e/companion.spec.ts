import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { memberIds } from "../src/shared/team.js";

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

  test("lets the keyboard reach and steer the 3D camera", async ({ page }) => {
    // Arrange
    const errors = collectErrors(page);
    await openPage(page, "/office/");
    const scene = page.locator("#scene");

    // Act
    await page.keyboard.press("Tab");
    await expect(scene).toBeFocused();
    for (const key of ["ArrowLeft", "ArrowUp", "+", "-", "0"]) {
      await page.keyboard.press(key);
    }
    await page.waitForTimeout(300);

    // Assert
    expect(await scene.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe("solid");
    expect(errors).toEqual([]);
  });

  test("shows a close-up of the member a subagent hook names", async ({ page }) => {
    // Arrange
    await openPage(page, "/office/");
    const caption = page.locator("#closeup-caption");
    await expect(caption).toBeHidden();

    // Act
    // Agents are named after the cast now; the old role names (used in other tests) still map.
    await postHook(page, { hook_event_name: "SubagentStart", agent_id: "r1", agent_type: "erza" });
    await postHook(page, { hook_event_name: "PreToolUse", agent_id: "r1", agent_type: "erza", tool_name: "Bash" });

    // Assert
    await expect(caption).toContainText("Erza · Reviewer");
    await expect(caption).toContainText("(Bash)");
    await expect(caption).toContainText("layar simulasi");
  });

  test("hides the close-up on its own a few seconds after the member finishes", async ({ page }) => {
    // Arrange
    await openPage(page, "/office/");
    const caption = page.locator("#closeup-caption");
    await postHook(page, { hook_event_name: "SubagentStart", agent_id: "d1", agent_type: "data-engineer" });
    await expect(caption).toContainText("Asuna");

    // Act
    await postHook(page, { hook_event_name: "SubagentStop", agent_id: "d1", agent_type: "data-engineer" });

    // Assert: still showing right after, so the finish is visible, then gone.
    await expect(caption).toBeVisible();
    await expect(caption).toBeHidden({ timeout: 10_000 });
  });

  test("turns the close-up off from the model dialog with the keyboard", async ({ page }) => {
    // Arrange
    await openPage(page, "/office/");
    await page.getByRole("button", { name: "Model" }).click();
    const setting = page.getByRole("checkbox", { name: "Close-up pas ada yang kerja" });
    await expect(setting).toBeChecked();

    // Act
    await setting.focus();
    await page.keyboard.press("Space");
    await expect(setting).not.toBeChecked();
    await page.keyboard.press("Escape");
    await postHook(page, { hook_event_name: "SubagentStart", agent_id: "e1", agent_type: "reviewer" });

    // Assert
    await page.waitForTimeout(800);
    await expect(page.locator("#closeup-caption")).toBeHidden();
  });

  test("shows the team conversation in the top right, clear of the close-up", async ({ page }) => {
    // Arrange
    await openPage(page, "/office/");
    const dialog = page.locator("#office-dialog");
    const caption = page.locator("#closeup-caption");

    // Act
    await postHook(page, {
      hook_event_name: "PreToolUse",
      tool_name: "Agent",
      subagent_type: "reviewer",
      task_description: "cek diff",
    });
    await postHook(page, { hook_event_name: "SubagentStart", agent_id: "e2", agent_type: "reviewer" });

    // Assert
    await expect(dialog).toContainText("2B");
    await expect(dialog).toContainText("Erza, tolong bantu ya.");
    await expect(caption).toBeVisible();
    const dialogBox = await dialog.boundingBox();
    const captionBox = await caption.boundingBox();
    expect(dialogBox).not.toBeNull();
    expect(captionBox).not.toBeNull();
    const viewport = page.viewportSize() ?? { width: 0, height: 0 };
    expect((dialogBox?.x ?? 0) + (dialogBox?.width ?? 0)).toBeGreaterThan(viewport.width - 40);
    expect(dialogBox?.y ?? viewport.height).toBeLessThan(viewport.height / 2);
    // Opposite corners: the close-up stays bottom left, the dialog never sits on it.
    expect(
      (dialogBox?.x ?? 0) >= (captionBox?.x ?? 0) + (captionBox?.width ?? 0) ||
        (dialogBox?.y ?? 0) + (dialogBox?.height ?? 0) <= (captionBox?.y ?? 0),
    ).toBe(true);
  });

  test("opens the model dialog and closes it with Escape", async ({ page }) => {
    // Arrange
    await openPage(page, "/office/");

    // Act
    await page.getByRole("button", { name: "Model" }).click();

    // Assert
    const dialog = page.getByRole("dialog", { name: "Pilih model .vrm" });
    await expect(dialog).toBeVisible();
    // One button per member plus the close button.
    await expect(dialog.getByRole("button")).toHaveCount(memberIds.length + 1);
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
    await expect(page.getByRole("status")).toContainText("Model Asuna gagal dimuat, pakai model cadangan");
    await expect(page.getByRole("status")).toHaveAttribute("data-tone", "error");
  });
});

test.describe("team overlay", () => {
  test("shows the empty note and a keyboard-operable content toggle", async ({ page }) => {
    // Arrange
    const errors = collectErrors(page);
    await openPage(page, "/team-overlay/");
    await expect(page.getByText("Belum ada percakapan")).toBeVisible();

    // Act
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");

    // Assert
    const toggle = page.getByRole("button", { name: "Isi asli: nyala" });
    await expect(toggle).toBeFocused();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(errors).toEqual([]);
  });

  test("shows a simulated line by default when 2B delegates", async ({ page }) => {
    // Arrange
    await openPage(page, "/team-overlay/");

    // Act
    await postHook(page, {
      hook_event_name: "PreToolUse",
      tool_name: "Agent",
      subagent_type: "reviewer",
      task_description: "Review diff orders",
    });

    // Assert
    await expect(page.locator("#dialog-name")).toContainText("2B");
    await expect(page.locator("#dialog-text")).toHaveText("Erza, tolong bantu ya.", { timeout: 15_000 });
    await expect(page.locator("#dialog-tag")).toBeVisible();
  });

  test("shows the real task title once real content is turned on", async ({ page }) => {
    // Arrange
    await openPage(page, "/team-overlay/");
    await page.getByRole("button", { name: "Isi asli: mati" }).click();

    // Act
    await postHook(page, {
      hook_event_name: "PreToolUse",
      tool_name: "Agent",
      subagent_type: "reviewer",
      task_description: "Review diff orders",
    });

    // Assert
    await expect(page.locator("#dialog-text")).toHaveText("Erza, tolong: Review diff orders", { timeout: 15_000 });
    await expect(page.locator("#dialog-tag")).toBeHidden();
  });
  test("reads a finished report out one sentence at a time", async ({ page }) => {
    // Arrange
    await openPage(page, "/team-overlay/");
    await page.getByRole("button", { name: "Isi asli: mati" }).click();

    // Act
    await postHook(page, {
      hook_event_name: "SubagentStop",
      agent_id: "agent-e2e",
      agent_type: "erza",
      last_assistant_message: "## Verdict: PASS\n\n- Semua test lulus.\n- Sebaiknya tambah test untuk input kosong.",
    });

    // Assert
    await expect(page.locator("#dialog-name")).toContainText("Erza");
    await expect(page.locator("#dialog-text")).toHaveText("Verdict: PASS", { timeout: 15_000 });
    await expect(page.locator("#dialog-text")).toHaveText("Semua test lulus.", { timeout: 15_000 });
    await expect(page.locator("#dialog-tag")).toBeHidden();
  });
});
