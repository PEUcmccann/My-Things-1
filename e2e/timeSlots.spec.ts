import { expect, test } from "@playwright/test";
import { addToDo, openList, openToDo, row } from "./helpers";

test("a Time slot set in the detail shows on the To-do's row in Today", async ({ page }) => {
  await page.goto("/");
  await openList(page, "inbox");
  await addToDo(page, "Dentist");
  await openToDo(page, "Dentist");

  await page.getByTestId("todo-time-slot").click();
  await page.getByTestId("slot-hour-14").click();
  await page.getByTestId("slot-minute-0").click();
  // The end is pre-filled 30 minutes after the start.
  await expect(page.getByTestId("slot-end")).toHaveText("14:30");
  await page.getByTestId("slot-save").click();

  await expect(page.getByTestId("todo-time-slot")).toContainText("14:00–14:30");
  // With no Start date, a Time slot puts the To-do on today.
  await expect(page.getByTestId("todo-when")).toContainText("Today");

  await openList(page, "today");
  await expect(row(page, "Dentist").getByTestId("row-time-slot")).toHaveText("14:00–14:30");
});
