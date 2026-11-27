import { expect, test } from "@playwright/test";
import { addToDo, openList } from "./helpers";

test("a To-do added inside a Project is filed there, not in the Inbox", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("sidebar-new").click();
  await page.getByTestId("new-project").click();
  await page.getByTestId("prompt-input").fill("Move house");
  await page.getByTestId("prompt-confirm").click();

  await expect(page.getByTestId("screen-project")).toBeVisible();
  await addToDo(page, "Book a van");
  await expect(page.getByTestId("screen-project").getByText("Book a van")).toBeVisible();
  await expect(page.getByTestId("project-progress")).toContainText("0 of 1");

  await openList(page, "inbox");
  await expect(page.getByTestId("screen-inbox").getByText("Book a van")).toHaveCount(0);
  await page.getByTestId("back").click();
  await expect(page.getByTestId("sidebar").getByText("Move house")).toBeVisible();
});
