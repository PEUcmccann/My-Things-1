import { expect, test, type Page } from "@playwright/test";
import { addToDo, openList } from "./helpers";

// The test:ui build syncs through a fake remote kept in localStorage
// (src/app/deviceRemote.ts), so two pages of one browser context sync like two devices.

async function signIn(page: Page, email: string) {
  await openList(page, "settings");
  await page.getByTestId("account-email").fill(email);
  await page.getByTestId("account-send-code").click();
  await page.getByTestId("account-code").fill("123456");
  await page.getByTestId("account-sign-in").click();
  await expect(page.getByTestId("account-status")).toHaveText("Signed in");
}

/** Makes every send to the fake remote fail with `message` ("Failed to fetch": offline). */
async function breakRemote(page: Page, message: string) {
  await page.evaluate((text) => {
    const w = window as unknown as { originalSetItem?: Storage["setItem"] };
    w.originalSetItem ??= Storage.prototype.setItem;
    const original = w.originalSetItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key.startsWith("mythings:fake-remote:")) {
        throw text === "Failed to fetch" ? new TypeError(text) : new Error(text);
      }
      return original.call(this, key, value);
    };
  }, message);
}

async function mendRemote(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { originalSetItem?: Storage["setItem"] };
    if (w.originalSetItem) Storage.prototype.setItem = w.originalSetItem;
  });
}

test("a To-do added on one device appears on the other after Sync now", async ({ page }) => {
  const other = await page.context().newPage();
  await page.goto("/");
  await other.goto("/");

  await signIn(page, "sam@example.com");
  await expect(page.getByTestId("sync-status")).toHaveText("Synced just now");
  await signIn(other, "sam@example.com");
  await expect(other.getByTestId("sync-status")).toHaveText("Synced just now");

  await openList(page, "inbox");
  await addToDo(page, "Added on the phone");
  await openList(page, "settings");
  await page.getByTestId("sync-now").click();
  await expect(page.getByTestId("sync-status")).toHaveText("Synced just now");

  await other.getByTestId("sync-now").click();
  await expect(other.getByTestId("sync-status")).toHaveText("Synced just now");
  await openList(other, "inbox");
  await expect(other.getByText("Added on the phone")).toBeVisible();
});

test("shows when sync is offline or failing, and signing out offers to sync first", async ({
  page,
}) => {
  await page.goto("/");
  await signIn(page, "sam@example.com");
  await expect(page.getByTestId("sync-status")).toHaveText("Synced just now");

  await breakRemote(page, "Failed to fetch");
  await openList(page, "inbox");
  await addToDo(page, "Made offline");
  await openList(page, "settings");
  await page.getByTestId("sync-now").click();
  await expect(page.getByTestId("sync-status")).toHaveText(
    "Offline: changes will sync when you're back online",
  );
  // Offline, the only way out is signing out anyway.
  await page.getByTestId("account-sign-out").click();
  const sheet = page.getByTestId("sign-out-sheet");
  await expect(sheet).toContainText(/\d+ changes haven't synced yet/);
  await expect(page.getByTestId("sign-out-sync")).toHaveCount(0);
  await expect(page.getByTestId("sign-out-confirm")).toHaveText("Sign out anyway");
  await sheet.getByTestId("menu-close").click();
  await expect(sheet).toBeHidden();

  await breakRemote(page, "Server unavailable");
  await page.getByTestId("sync-now").click();
  await expect(page.getByTestId("sync-status")).toHaveText("Sync failed: Server unavailable");

  await mendRemote(page);
  await page.getByTestId("account-sign-out").click();
  await expect(sheet).toContainText(/\d+ changes haven't synced yet/);
  await page.getByTestId("sign-out-sync").click();
  await expect(page.getByTestId("account-section")).toContainText("Sign in to sync your data");
  await openList(page, "inbox");
  await expect(page.getByText("Made offline")).toHaveCount(0);

  // Signing in again brings it back from the account.
  await signIn(page, "sam@example.com");
  await expect(page.getByTestId("sync-status")).toHaveText("Synced just now");
  await openList(page, "inbox");
  await expect(page.getByText("Made offline")).toBeVisible();
});
