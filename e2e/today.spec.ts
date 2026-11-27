import { expect, test } from "@playwright/test";
import { addToDo, openList, openToDo } from "./helpers";

test("setting a To-do's When to Today puts it in Today", async ({ page }) => {
  await page.goto("/");
  await openList(page, "inbox");
  await addToDo(page, "Pay rent");
  await openToDo(page, "Pay rent");
  await page.getByTestId("todo-when").click();
  await page.getByTestId("when-today").click();
  await expect(page.getByTestId("todo-when")).toContainText("Today");

  await openList(page, "today");
  await expect(page.getByTestId("screen-today").getByText("Pay rent")).toBeVisible();
});
