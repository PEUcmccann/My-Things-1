import { expect, test } from "@playwright/test";
import { addToDo, openList, openToDo, row } from "./helpers";

test("completing a parent with an open Sub-to-do asks what to do with it", async ({ page }) => {
  await page.goto("/");
  await openList(page, "inbox");
  await addToDo(page, "Plan trip");
  await openToDo(page, "Plan trip");
  await page.getByTestId("sub-todo-new").fill("Book flights");
  await page.getByTestId("sub-todo-new").press("Enter");
  await expect(row(page, "Book flights")).toBeVisible();

  await page.getByTestId("todo-complete").click();
  await page.getByTestId("remaining-cancel").click();
  await expect(row(page, "Book flights").getByText("Book flights")).toHaveCSS(
    "text-decoration-line",
    "line-through",
  );
  await expect(page.getByTestId("todo-reopen")).toBeVisible();
});
