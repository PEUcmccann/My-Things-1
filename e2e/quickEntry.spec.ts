import { expect, test } from "@playwright/test";
import { openList, openToDo, row } from "./helpers";

test("quick entry shorthand sets a Tag, Priority, Estimate and Time slot", async ({ page }) => {
  await page.goto("/");
  await openList(page, "inbox");
  await page.getByTestId("magic-plus").click();
  await page.getByTestId("new-todo-title").fill("Buy milk #errand !high ~15m @14:00");

  const tokens = page.getByTestId("quick-entry-tokens");
  await expect(tokens).toContainText("#errand (new)");
  await expect(tokens).toContainText("!high");
  await expect(tokens).toContainText("~15m");
  await expect(tokens).toContainText("@14:00");
  await expect(page.getByTestId("quick-entry-title")).toHaveText("Buy milk");
  await page.getByTestId("new-todo-add").click();
  await expect(page.getByTestId("new-todo-sheet")).toBeHidden();

  // The Time slot gives it today's Start date, so it is in Today.
  await openList(page, "today");
  await expect(row(page, "Buy milk")).toBeVisible();
  await openToDo(page, "Buy milk");
  await expect(page.getByTestId("todo-tags")).toContainText("errand");
  await expect(page.getByTestId("todo-priority")).toContainText("High");
  await expect(page.getByTestId("todo-estimate")).toContainText("15m");
  await expect(page.getByTestId("todo-time-slot")).toContainText("14:00");
  await expect(page.getByTestId("todo-time-slot")).toContainText("14:15");
});

test("tapping a highlight keeps the shorthand in the title", async ({ page }) => {
  await page.goto("/");
  await openList(page, "inbox");
  await page.getByTestId("magic-plus").click();
  const input = page.getByTestId("new-todo-title");
  await input.fill("Learn the !high notes");
  await page.getByTestId("quick-entry-tokens").getByText("!high").click();
  await expect(page.getByTestId("quick-entry-tokens")).toBeHidden();
  // Typing before the kept token does not bring it back.
  await input.press("Home");
  await input.pressSequentially("Really ");
  await expect(page.getByTestId("quick-entry-tokens")).toBeHidden();
  await page.getByTestId("new-todo-add").click();

  await openToDo(page, "Really Learn the !high notes");
  await expect(page.getByTestId("todo-priority")).toContainText("None");
});
