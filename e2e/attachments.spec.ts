import { expect, test, type Page } from "@playwright/test";
import { addToDo, openList, openToDo, row } from "./helpers";

// The test:ui build keeps Attachment files in a fake Storage in memory
// (src/app/deviceFileStorage.ts), so no Supabase project is needed.

/** A 1×1 PNG. */
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

async function signIn(page: Page) {
  await openList(page, "settings");
  await page.getByTestId("account-email").fill("sam@example.com");
  await page.getByTestId("account-send-code").click();
  await page.getByTestId("account-code").fill("123456");
  await page.getByTestId("account-sign-in").click();
  await expect(page.getByTestId("account-status")).toHaveText("Signed in");
}

/** Chooses "Photo" or "File" under Add attachment and picks `file`. */
async function attach(
  page: Page,
  choice: "photo" | "file",
  file: { name: string; mimeType: string; buffer: Buffer },
) {
  await page.getByTestId("attachment-add").click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByTestId(`attachment-add-${choice}`).click();
  await (await chooser).setFiles(file);
}

test("attaches a photo and a text file to a To-do, then removes one", async ({ page }) => {
  await page.goto("/");
  await signIn(page);
  await openList(page, "inbox");
  await addToDo(page, "Plan the trip");
  await openToDo(page, "Plan the trip");

  await attach(page, "photo", { name: "map.png", mimeType: "image/png", buffer: png });
  const photo = page.locator('[data-testid^="attachment-thumbnail-"]');
  await expect(photo).toBeVisible();
  await expect(page.getByText("map.png")).toBeVisible();

  await attach(page, "file", {
    name: "packing list.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("socks\nhat\n"),
  });
  await expect(page.getByText("packing list.txt")).toBeVisible();
  await expect(page.getByText("10 bytes")).toBeVisible();
  await expect(page.locator('[data-testid^="attachment-icon-"]')).toHaveCount(1);
  await expect(page.getByTestId("attachment-uploading")).toHaveCount(0);

  // Remove the text file, after confirming.
  await page.getByRole("button", { name: "Remove packing list.txt" }).click();
  await page.getByTestId("attachment-remove-confirm").click();
  await expect(page.getByText("packing list.txt")).toBeHidden();
  await expect(page.getByText("map.png")).toBeVisible();

  // Tapping the photo opens it full screen.
  await page.getByRole("button", { name: "Open map.png" }).click();
  await expect(page.getByTestId("attachment-viewer")).toBeVisible();
  await page.getByTestId("attachment-viewer-close").click();
  await expect(page.getByTestId("attachment-viewer")).toBeHidden();

  // The row in the list shows a paperclip.
  await page.getByTestId("back").first().click();
  await expect(row(page, "Plan the trip").getByTestId("row-attachments")).toBeVisible();
});

test("asks you to sign in before adding attachments", async ({ page }) => {
  await page.goto("/");
  await openList(page, "inbox");
  await addToDo(page, "Signed out");
  await openToDo(page, "Signed out");
  await page.getByTestId("attachment-add").click();
  await expect(page.getByTestId("attachment-message")).toHaveText("Sign in to add attachments");
});
