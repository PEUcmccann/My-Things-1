import { expect, test } from "@playwright/test";
import { addToDo, openList, openToDo } from "./helpers";

test("a To-do moved to Someday shows in the Someday list", async ({ page }) => {
  await page.goto("/");
  await openList(page, "inbox");
  await addToDo(page, "Learn the cello");
  await openToDo(page, "Learn the cello");
  await page.getByTestId("todo-when").click();
  await page.getByTestId("when-someday").click();
  await expect(page.getByTestId("todo-when")).toContainText("Someday");

  await openList(page, "someday");
  await expect(page.getByTestId("screen-someday").getByText("Learn the cello")).toBeVisible();
  await openList(page, "inbox");
  await expect(page.getByTestId("screen-inbox").getByText("Learn the cello")).toHaveCount(0);
});
