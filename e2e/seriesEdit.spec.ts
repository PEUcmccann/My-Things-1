import { expect, test, type Page } from "@playwright/test";
import { addToDo, openList, openToDo, row } from "./helpers";

/** Adds "Water plants" to Today, repeating every day, and leaves its detail open. */
async function repeatingToDo(page: Page) {
  await page.goto("/");
  await openList(page, "today");
  await addToDo(page, "Water plants");
  await openToDo(page, "Water plants");
  await page.getByTestId("todo-repeat").click();
  await page.getByTestId("repeat-freq-daily").click();
  await page.getByTestId("repeat-save").click();
  await expect(page.getByTestId("todo-repeat")).toContainText("Every day");
}

test('"This one" changes the title of this occurrence only', async ({ page }) => {
  await repeatingToDo(page);
  await page.getByTestId("todo-title").fill("Water the ferns");
  await page.getByTestId("todo-title").press("Enter");
  await expect(page.getByTestId("series-scope")).toBeVisible();
  await page.getByTestId("series-this-one").click();
  await expect(page.getByTestId("series-scope")).toBeHidden();
  await expect(page.getByTestId("todo-title")).toHaveValue("Water the ferns");

  // The answer holds for the rest of the visit: the next edit doesn't ask.
  await page.getByTestId("todo-priority").click();
  await page.getByTestId("priority-high").click();
  await expect(page.getByTestId("series-scope")).toBeHidden();
  await expect(page.getByTestId("todo-priority")).toContainText("High");

  await page.getByTestId("back").first().click();
  await row(page, "Water the ferns")
    .getByTestId(/^todo-check-/)
    .click();
  await expect(row(page, "Water the ferns").getByTestId("finished-completed")).toBeVisible();

  // The next occurrence has the series' title and Priority.
  await openList(page, "upcoming");
  await expect(row(page, "Water plants")).toBeVisible();
  await expect(row(page, "Water the ferns")).toHaveCount(0);
  await openToDo(page, "Water plants");
  await expect(page.getByTestId("todo-priority")).toContainText("None");
});

test('"All future ones" carries the change to the next occurrence', async ({ page }) => {
  await repeatingToDo(page);
  await page.getByTestId("checklist-new").fill("Fill can");
  await page.getByTestId("checklist-new").press("Enter");
  await page.getByTestId("series-all-future").click();
  await expect(page.getByTestId("checklist-item-0")).toBeVisible();

  // Ticking never asks.
  await page.getByTestId("checklist-tick-0").click();
  await expect(page.getByTestId("series-scope")).toBeHidden();

  await page.getByTestId("todo-complete").click();
  await page.getByTestId("back").first().click();
  await openList(page, "upcoming");
  await openToDo(page, "Water plants");
  await expect(page.getByTestId("checklist-item-0").locator("input")).toHaveValue("Fill can");
});

test("backing out leaves the To-do unchanged", async ({ page }) => {
  await repeatingToDo(page);
  await page.getByTestId("todo-title").fill("Water the ferns");
  await page.getByTestId("todo-title").press("Enter");
  await page.getByTestId("series-back-out").click();
  await expect(page.getByTestId("series-scope")).toBeHidden();
  await expect(page.getByTestId("todo-title")).toHaveValue("Water plants");

  // Moving it never asks, and the question comes back for the next edit.
  await page.getByTestId("todo-when").click();
  await page.getByTestId("when-today").click();
  await expect(page.getByTestId("series-scope")).toBeHidden();
  await page.getByTestId("todo-tags").click();
  await expect(page.getByTestId("series-scope")).toBeVisible();
  await page.getByTestId("series-back-out").click();
  await expect(page.getByTestId("tag-picker")).toBeHidden();
});
