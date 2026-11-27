import { expect, type Page } from "@playwright/test";

/** Opens a list from the sidebar, going back to the sidebar first if needed. */
export async function openList(page: Page, key: string) {
  const sidebar = page.getByTestId(`sidebar-${key}`);
  await page.locator('[data-testid="sidebar"], [data-testid="back"]').first().waitFor();
  while (!(await sidebar.isVisible())) {
    await page.getByTestId("back").first().click();
  }
  await sidebar.click();
}

/** Adds a To-do with Magic Plus on the current screen. */
export async function addToDo(page: Page, title: string) {
  await page.getByTestId("magic-plus").click();
  await page.getByTestId("new-todo-title").fill(title);
  await page.getByTestId("new-todo-add").click();
  await expect(page.getByTestId("new-todo-sheet")).toBeHidden();
}
