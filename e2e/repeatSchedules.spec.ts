import { expect, test } from "@playwright/test";
import { addToDo, openList, openToDo } from "./helpers";

test("the repeat picker sets the last weekday of the month, previews its dates and ends it", async ({
  page,
}) => {
  // Thursday 26 November 2026, mid-morning.
  await page.clock.install({ time: new Date(2026, 10, 26, 10, 0) });
  await page.goto("/");
  await openList(page, "today");
  await addToDo(page, "Send accounts");
  await openToDo(page, "Send accounts");

  await page.getByTestId("todo-repeat").click();
  await page.getByTestId("repeat-freq-monthly").click();
  await page.getByTestId("repeat-on-weekday").click();
  await page.getByTestId("repeat-nth-last").click();
  await page.getByTestId("repeat-nthday-weekday").click();
  await expect(page.getByTestId("repeat-summary")).toHaveText("Every month on the last weekday");

  // The next 5 dates: 31 January 2027 is a Sunday, so the 29th.
  const preview = page.getByTestId("repeat-preview").locator('[data-testid^="repeat-preview-"]');
  await expect(preview).toHaveText([
    "Mon 30 Nov",
    "Thu 31 Dec",
    "Fri 29 Jan 2027",
    "Fri 26 Feb 2027",
    "Wed 31 Mar 2027",
  ]);

  // Ending after 3 times shows only 3.
  await page.getByTestId("repeat-end-count").click();
  await page.getByTestId("repeat-count-less").click();
  await page.getByTestId("repeat-count-less").click();
  await expect(page.getByTestId("repeat-count")).toHaveText("3");
  await expect(page.getByTestId("repeat-summary")).toHaveText(
    "Every month on the last weekday, 3 times",
  );
  await expect(preview).toHaveCount(3);

  // Ending on a date is inclusive.
  await page.getByTestId("repeat-end-until").click();
  await page.getByTestId("cal-next").click();
  await page.getByTestId("cal-2026-12-31").click();
  await expect(page.getByTestId("repeat-summary")).toHaveText(
    "Every month on the last weekday, until 31 Dec 2026",
  );
  await expect(preview).toHaveText(["Mon 30 Nov", "Thu 31 Dec"]);

  await page.getByTestId("repeat-save").click();
  await expect(page.getByTestId("todo-repeat")).toContainText(
    "Every month on the last weekday, until 31 Dec 2026",
  );
  await expect(page.getByTestId("todo-when")).toContainText("Mon 30 Nov");

  // The picker reopens on the saved rule.
  await page.getByTestId("todo-repeat").click();
  await expect(page.getByTestId("repeat-nth-last")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("repeat-end-until")).toHaveAttribute("aria-checked", "true");
});

test("a yearly rule on the first Monday of March", async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 10, 26, 10, 0) });
  await page.goto("/");
  await openList(page, "inbox");
  await addToDo(page, "Service the boiler");
  await openToDo(page, "Service the boiler");

  await page.getByTestId("todo-repeat").click();
  await page.getByTestId("repeat-freq-yearly").click();
  await page.getByTestId("repeat-month-3").click();
  await page.getByTestId("repeat-on-weekday").click();
  await page.getByTestId("repeat-nth-1").click();
  await page.getByTestId("repeat-nthday-MO").click();
  await expect(page.getByTestId("repeat-summary")).toHaveText(
    "Every year on the first Monday of March",
  );
  await expect(page.getByTestId("repeat-preview-0")).toHaveText("Mon 1 Mar 2027");
  await expect(page.getByTestId("repeat-preview-1")).toHaveText("Mon 6 Mar 2028");
});
