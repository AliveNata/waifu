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

async function postHook(page: Page, body: Record<string, string>): Promise<void> {
  const response = await page.request.post("/hook", { data: body, headers: { "content-type": "application/json" } });
  expect(response.status()).toBe(202);
}

for (const path of ["/overlay/", "/office/"]) {
  test.describe(path, () => {
    test("shows the empty state with a keyboard-reachable picker", async ({ page }) => {
      // Arrange
      const errors = collectErrors(page);

      // Act
      await page.goto(path);
      await expect(page.locator("#panel-title")).toHaveText("Belum ada model");
      await page.keyboard.press("Tab");

      // Assert
      const picker = page.getByRole("button", { name: "Pilih file .vrm" });
      await expect(picker).toBeFocused();
      const outline = await picker.evaluate((element) => getComputedStyle(element).outlineStyle);
      expect(outline).toBe("solid");
      expect(errors).toEqual([]);
    });

    test("updates the status chip from hook events", async ({ page }) => {
      // Arrange
      await page.goto(path);
      const status = page.getByRole("status");
      await expect(status).toBeHidden();

      // Act + Assert
      await postHook(page, { hook_event_name: "PreToolUse", tool_name: "Bash" });
      await expect(status).toHaveText("Ngerjain: Bash");
      await expect(status).toHaveAttribute("data-tone", "neutral");

      await postHook(page, { hook_event_name: "Notification", message: "Claude needs your permission to use Bash" });
      await expect(status).toHaveText("Claude needs your permission to use Bash");
      await expect(status).toHaveAttribute("data-tone", "attention");

      await postHook(page, { hook_event_name: "SessionEnd" });
      await expect(status).toBeHidden();
    });

    test("shows an error state for a file that is not a VRM", async ({ page }) => {
      // Arrange
      await page.goto(path);
      const chooser = page.waitForEvent("filechooser");

      // Act
      await page.getByRole("button", { name: "Pilih file .vrm" }).click();
      await (await chooser).setFiles({ name: "rusak.vrm", mimeType: "model/gltf-binary", buffer: Buffer.from("bukan glb") });

      // Assert
      await expect(page.locator("#panel-title")).toHaveText("Model gagal dimuat");
      await expect(page.getByRole("button", { name: "Pilih file lain" })).toBeVisible();
    });

    test("loads a real VRM", async ({ page }) => {
      test.skip(sampleModelPath === undefined, "set WAIFU_SAMPLE_VRM to a .vrm file to run this test");
      // Arrange
      const errors = collectErrors(page);
      await page.goto(path);
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
      await expect(page.getByRole("button", { name: "Ganti model" })).toBeVisible();
      expect(errors).toEqual([]);
    });
  });
}
