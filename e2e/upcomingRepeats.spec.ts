import { expect, test } from "@playwright/test";
import { addToDo, openList, openToDo } from "./helpers";

test("a weekly Repeat rule shows its next weeks in Upcoming", async ({ page }) => {
  // Thursday 26 November 2026, so the rule repeats on Thursdays.
  await page.clock.install({ time: new Date(2026, 10, 26, 10) });
  await page.goto("/");
  await openList(page, "today");
  await addToDo(page, "Bins out");
  await openToDo(page, "Bins out");
  await page.getByTestId("todo-repeat").click();
  await page.getByTestId("repeat-freq-weekly").click();
  await expect(page.getByTestId("repeat-summary")).toHaveText("Every week on Thu");
  await page.getByTestId("repeat-save").click();
  await page.getByTestId("back").first().click();

  await openList(page, "upcoming");
  const projected = page.locator('[data-testid^="projected-row-"]');
  // Upcoming shows the next Thursdays; the current occurrence stays in Today.
  for (const [group, date] of [
    ["2026-12-03", "2026-12-03"],
    ["2026-12-07", "2026-12-10"],
    ["2026-12-14", "2026-12-17"],
    ["2026-12-21", "2026-12-24"],
  ]) {
    const entry = page.getByTestId(`upcoming-${group}`).locator(`[data-testid$="-${date}"]`);
    await expect(entry).toContainText("Bins out");
    await expect(entry.getByTestId("projected-repeat")).toBeVisible();
  }
  await expect(page.locator('[data-testid^="todo-row-"]')).toHaveCount(0);
  // Projected entries can't be ticked off.
  await expect(projected.first().locator('[role="checkbox"]')).toHaveCount(0);

  // Tapping one opens the current occurrence, which is today's.
  await projected.first().click();
  await expect(page.getByTestId("screen-todo")).toBeVisible();
  await expect(page.getByTestId("todo-when")).toContainText("Today");
  await expect(page.getByTestId("todo-repeat")).toContainText("Every week on Thu");
});
