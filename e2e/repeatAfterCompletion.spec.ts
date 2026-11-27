import { expect, test } from "@playwright/test";
import { addToDo, openList, openToDo, row } from "./helpers";

test("a Repeat rule after completion starts the next one 3 days after it was done", async ({
  page,
}) => {
  // Thursday 26 November 2026, mid-morning.
  await page.clock.install({ time: new Date(2026, 10, 26, 10, 0) });
  await page.goto("/");
  await openList(page, "today");
  await addToDo(page, "Water plants");
  await openToDo(page, "Water plants");

  await page.getByTestId("todo-repeat").click();
  await page.getByTestId("repeat-mode-afterCompletion").click();
  // A gap has no days to choose.
  await page.getByTestId("repeat-freq-weekly").click();
  await expect(page.getByTestId("repeat-day-MO")).toHaveCount(0);
  await page.getByTestId("repeat-freq-daily").click();
  await page.getByTestId("repeat-interval-more").click();
  await page.getByTestId("repeat-interval-more").click();
  await expect(page.getByTestId("repeat-summary")).toHaveText("Every 3 days after completion");
  await page.getByTestId("repeat-save").click();
  await expect(page.getByTestId("todo-repeat")).toContainText("Every 3 days after completion");
  await expect(page.getByTestId("todo-when")).toContainText("Today");

  await page.getByTestId("todo-detail-check").click();
  await page.getByTestId("back").first().click();

  // The next occurrence starts on Sunday 29 November, still repeating the same way.
  await openList(page, "upcoming");
  await expect(row(page, "Water plants").getByTestId("row-repeat")).toBeVisible();
  await openToDo(page, "Water plants");
  await expect(page.getByTestId("todo-when")).toContainText("Sun 29 Nov");
  await expect(page.getByTestId("todo-repeat")).toContainText("Every 3 days after completion");

  // Reopening the picker shows the mode it was saved with.
  await page.getByTestId("todo-repeat").click();
  await expect(page.getByTestId("repeat-mode-afterCompletion")).toHaveAttribute(
    "aria-checked",
    "true",
  );
});
