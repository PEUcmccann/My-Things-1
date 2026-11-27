import { expect, test } from "@playwright/test";
import { addToDo, openList } from "./helpers";

test("a To-do added to the Inbox is still there after a reload", async ({ page }) => {
  await page.goto("/");
  await openList(page, "inbox");
  await addToDo(page, "Buy milk");
  await expect(page.getByTestId("screen-inbox").getByText("Buy milk")).toBeVisible();

  await page.waitForTimeout(300);
  await page.reload();
  await openList(page, "inbox");
  await expect(page.getByTestId("screen-inbox").getByText("Buy milk")).toBeVisible();
});

test("every built-in list and Settings open from the sidebar", async ({ page }) => {
  await page.goto("/");
  for (const list of ["inbox", "today", "upcoming", "anytime", "someday", "logbook", "trash"]) {
    await openList(page, list);
    await expect(page.getByTestId(`screen-${list}`)).toBeVisible();
    await page.getByTestId("back").click();
  }
  await page.getByTestId("sidebar-settings").click();
  await expect(page.getByTestId("screen-settings")).toBeVisible();
});
