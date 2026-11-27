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

test("a bulk action asks once and applies the answer to the repeating To-do", async ({ page }) => {
  await repeatingToDo(page);
  await page.getByTestId("back").first().click();
  await addToDo(page, "Buy soil");

  await page.getByTestId("select-mode").click();
  await row(page, "Water plants").click();
  await row(page, "Buy soil").click();
  await expect(page.getByTestId("selection-count")).toHaveText("2 selected");
  await page.getByTestId("bulk-priority").click();
  await expect(page.getByTestId("series-scope")).toBeVisible();
  await page.getByTestId("series-this-one").click();
  await page.getByTestId("priority-high").click();
  await expect(page.getByTestId("selection-bar")).toBeHidden();

  await openToDo(page, "Buy soil");
  await expect(page.getByTestId("todo-priority")).toContainText("High");
  await page.getByTestId("back").first().click();
  await openToDo(page, "Water plants");
  await expect(page.getByTestId("todo-priority")).toContainText("High");
  await page.getByTestId("todo-complete").click();

  // The next occurrence is created from the series, without the bulk change.
  await page.getByTestId("back").first().click();
  await openList(page, "upcoming");
  await openToDo(page, "Water plants");
  await expect(page.getByTestId("todo-priority")).toContainText("None");
});

test("a bulk action on To-dos that don't repeat doesn't ask", async ({ page }) => {
  await page.goto("/");
  await openList(page, "inbox");
  await addToDo(page, "Buy soil");
  await page.getByTestId("select-mode").click();
  await row(page, "Buy soil").click();
  await page.getByTestId("bulk-energy").click();
  await expect(page.getByTestId("series-scope")).toBeHidden();
  await expect(page.getByTestId("energy-picker")).toBeVisible();
});

test("deleting a Sub-to-do of a repeating To-do from its row asks", async ({ page }) => {
  await repeatingToDo(page);
  await page.getByTestId("sub-todo-new").fill("Balcony");
  await page.getByTestId("sub-todo-new").press("Enter");
  await page.getByTestId("series-all-future").click();
  await expect(row(page, "Balcony")).toBeVisible();
  // A new visit asks again.
  await page.getByTestId("back").first().click();
  await openToDo(page, "Water plants");
  await row(page, "Balcony").locator('[data-testid^="todo-menu-"]').click();
  await page.getByTestId("row-delete").click();
  await expect(page.getByTestId("series-scope")).toBeVisible();
  await page.getByTestId("series-back-out").click();
  await expect(row(page, "Balcony")).toBeVisible();
  await row(page, "Balcony").locator('[data-testid^="todo-menu-"]').click();
  await page.getByTestId("row-delete").click();
  await page.getByTestId("series-this-one").click();
  await expect(row(page, "Balcony")).toHaveCount(0);
});
