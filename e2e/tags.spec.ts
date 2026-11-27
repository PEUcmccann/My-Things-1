import { expect, test } from "@playwright/test";
import { addToDo, openList, openToDo } from "./helpers";

test("a list can be filtered by Tag", async ({ page }) => {
  await page.goto("/");
  await openList(page, "inbox");
  await addToDo(page, "Buy stamps");
  await addToDo(page, "Read a book");
  await openToDo(page, "Buy stamps");
  await page.getByTestId("todo-tags").click();
  await page.getByTestId("tag-picker-new").fill("Errand");
  await page.getByTestId("tag-picker-add").click();
  await page.getByTestId("tag-picker-done").click();
  await expect(page.getByTestId("todo-tags")).toContainText("Errand");
  await page.getByTestId("back").click();

  const inbox = page.getByTestId("screen-inbox");
  await inbox.getByTestId("tag-filter").getByText("Errand").click();
  await expect(inbox.getByText("Buy stamps")).toBeVisible();
  await expect(inbox.getByText("Read a book")).toHaveCount(0);
  await inbox.getByTestId("tag-filter-all").click();
  await expect(inbox.getByText("Read a book")).toBeVisible();
});
