import { expect, test } from "@playwright/test";
import { addToDo, openList, openToDo, row } from "./helpers";

test("setting a Priority on a To-do shows it on the row", async ({ page }) => {
  await page.goto("/");
  await openList(page, "inbox");
  await addToDo(page, "File taxes");
  await expect(row(page, "File taxes").getByTestId("badge-priority")).toHaveCount(0);

  await openToDo(page, "File taxes");
  await page.getByTestId("todo-priority").click();
  await page.getByTestId("priority-high").click();
  await expect(page.getByTestId("todo-priority")).toContainText("High");
  await page.getByTestId("back").click();

  await expect(row(page, "File taxes").getByTestId("badge-priority")).toHaveText("!!!");
});

test("Today shows the total Estimate of its To-dos", async ({ page }) => {
  await page.goto("/");
  await openList(page, "today");
  await addToDo(page, "Cook dinner");
  await addToDo(page, "Call bank");
  await expect(page.getByTestId("today-estimate")).toHaveCount(0);

  await openToDo(page, "Cook dinner");
  await page.getByTestId("todo-estimate").click();
  await page.getByTestId("estimate-90").click();
  await expect(page.getByTestId("todo-estimate")).toContainText("1h 30m");
  await page.getByTestId("back").click();

  await openToDo(page, "Call bank");
  await page.getByTestId("todo-estimate").click();
  await page.getByTestId("estimate-custom").click();
  await page.getByTestId("prompt-input").fill("0");
  await page.getByTestId("prompt-confirm").click();
  await expect(page.getByTestId("prompt-error")).toBeVisible();
  await page.getByTestId("prompt-input").fill("15");
  await page.getByTestId("prompt-confirm").click();
  await expect(page.getByTestId("todo-estimate")).toContainText("15m");
  await page.getByTestId("back").click();

  await expect(page.getByTestId("today-estimate")).toHaveText("Estimated 1h 45m");
  await expect(row(page, "Call bank").getByTestId("badge-estimate")).toHaveText("15m");
});

test("a multi-selection can set Energy for every selected To-do", async ({ page }) => {
  await page.goto("/");
  await openList(page, "inbox");
  await addToDo(page, "Write essay");
  await addToDo(page, "Plan trip");
  await addToDo(page, "Water plants");

  await page.getByTestId("select-mode").click();
  await row(page, "Write essay").click();
  await row(page, "Plan trip").click();
  await page.getByTestId("bulk-energy").click();
  await page.getByTestId("energy-high").click();
  await expect(page.getByTestId("selection-bar")).toBeHidden();

  for (const title of ["Write essay", "Plan trip"]) {
    await expect(row(page, title).getByTestId("badge-energy")).toHaveText("⚡ High energy");
  }
  await expect(row(page, "Water plants").getByTestId("badge-energy")).toHaveCount(0);
});
