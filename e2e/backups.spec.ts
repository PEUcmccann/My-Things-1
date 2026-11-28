import { expect, test } from "@playwright/test";
import { addToDo, openList } from "./helpers";

// The test:ui build keeps Backups in a fake Storage bucket in memory
// (src/app/fileStorage.ts), and signs in with any email and the code 123456.

test("signed out, Backups ask you to sign in", async ({ page }) => {
  await page.goto("/");
  await openList(page, "settings");
  await expect(page.getByTestId("backups-section")).toContainText(
    "Sign in to back up automatically",
  );
  await expect(page.getByTestId("backup-now")).toHaveCount(0);
});

test("a first backup is made on signing in, another on Back up now, and the older restores", async ({
  page,
}) => {
  await page.goto("/");
  await openList(page, "inbox");
  await addToDo(page, "In the first backup");

  await openList(page, "settings");
  await page.getByTestId("account-email").fill("sam@example.com");
  await page.getByTestId("account-send-code").click();
  await page.getByTestId("account-code").fill("123456");
  await page.getByTestId("account-sign-in").click();
  await expect(page.getByTestId("account-status")).toHaveText("Signed in");

  const rows = page.getByTestId("backup-row");
  await expect(rows).toHaveCount(1);
  await expect(page.getByTestId("backups-last")).toContainText("Last backup: ");

  await openList(page, "inbox");
  await addToDo(page, "Added after the first backup");
  await openList(page, "settings");
  await page.getByTestId("backup-now").click();
  await expect(rows).toHaveCount(2);

  // Newest first: the older one is second.
  await rows.nth(1).getByTestId("backup-restore").click();
  const sheet = page.getByTestId("backup-restore-sheet");
  await expect(sheet).toContainText("Replace everything with the backup from ");
  await expect(sheet).toContainText("This can't be undone.");
  await page.getByTestId("backup-restore-confirm").click();
  await expect(page.getByTestId("backups-status")).toHaveText("Restored");

  await openList(page, "inbox");
  await expect(page.getByText("In the first backup")).toBeVisible();
  await expect(page.getByText("Added after the first backup")).toHaveCount(0);
});
