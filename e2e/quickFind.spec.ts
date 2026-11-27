import { expect, test } from "@playwright/test";
import { addToDo, openList, openToDo } from "./helpers";

test("Quick Find finds a To-do by a word in its notes", async ({ page }) => {
  await page.goto("/");
  await openList(page, "inbox");
  await addToDo(page, "Call Sam");
  await openToDo(page, "Call Sam");
  await page.getByTestId("notes").click();
  await page.getByTestId("notes-input").fill("Ask about the garden party");
  await page.getByTestId("todo-title").click();
  await page.getByTestId("back").click();

  await page.getByTestId("open-quickfind").click();
  await expect(page.getByTestId("quickfind-input")).toBeFocused();
  await page.getByTestId("quickfind-input").fill("GARDEN");
  const results = page.getByTestId("results-to-dos");
  await expect(results.getByText("Call Sam")).toBeVisible();
  await expect(results.getByTestId("result-excerpt")).toContainText("garden party");
  await results.getByText("Call Sam").click();
  await expect(page.getByTestId("screen-todo")).toBeVisible();
});
