import { expect, test } from "@playwright/test";
import { addToDo, openList, openToDo, row } from "./helpers";

test("completing a To-do with a daily Repeat rule brings on the next one", async ({ page }) => {
  await page.goto("/");
  await openList(page, "today");
  await addToDo(page, "Water plants");
  await openToDo(page, "Water plants");

  await page.getByTestId("todo-repeat").click();
  await page.getByTestId("repeat-freq-daily").click();
  await expect(page.getByTestId("repeat-summary")).toHaveText("Every day");
  await page.getByTestId("repeat-save").click();
  await expect(page.getByTestId("todo-repeat")).toContainText("Every day");

  // A repeating To-do always has a Start date: "When" offers no Someday or Clear.
  await page.getByTestId("todo-when").click();
  await expect(page.getByTestId("when-someday")).toHaveCount(0);
  await expect(page.getByTestId("when-clear")).toHaveCount(0);
  await page.getByTestId("when-today").click();

  await page.getByTestId("back").first().click();
  await expect(row(page, "Water plants").getByTestId("row-repeat")).toBeVisible();
  await row(page, "Water plants")
    .getByTestId(/^todo-check-/)
    .click();
  await expect(row(page, "Water plants").getByTestId("finished-completed")).toBeVisible();

  // The next occurrence waits in Upcoming, tomorrow, still repeating.
  await openList(page, "upcoming");
  const next = row(page, "Water plants");
  await expect(next).toBeVisible();
  await expect(next.getByTestId("row-repeat")).toBeVisible();
  await openToDo(page, "Water plants");
  await expect(page.getByTestId("todo-when")).toContainText("Tomorrow");
  await expect(page.getByTestId("todo-repeat")).toContainText("Every day");
});

test("a monthly rule on the 31st explains skipped months, and offers the last day", async ({
  page,
}) => {
  await page.goto("/");
  await openList(page, "inbox");
  await addToDo(page, "Send invoice");
  await openToDo(page, "Send invoice");

  await page.getByTestId("todo-repeat").click();
  await page.getByTestId("repeat-freq-monthly").click();
  await page.getByTestId("repeat-monthday-31").click();
  await expect(page.getByTestId("repeat-month-hint")).toBeVisible();
  await page.getByTestId("repeat-monthday-last").click();
  await expect(page.getByTestId("repeat-month-hint")).toBeHidden();
  await page.getByTestId("repeat-interval-more").click();
  await expect(page.getByTestId("repeat-summary")).toHaveText("Every 2 months on the last day");
  await page.getByTestId("repeat-save").click();
  await expect(page.getByTestId("todo-repeat")).toContainText("Every 2 months on the last day");

  // Removing the rule.
  await page.getByTestId("todo-repeat").click();
  await page.getByTestId("repeat-remove").click();
  await expect(page.getByTestId("todo-repeat")).toContainText("None");
});
