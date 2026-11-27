import { expect, test } from "@playwright/test";
import { addToDo, openList, row } from "./helpers";

test("completing a To-do strikes it through", async ({ page }) => {
  await page.goto("/");
  await openList(page, "inbox");
  await addToDo(page, "Buy milk");
  await row(page, "Buy milk").getByRole("checkbox").click();
  const title = row(page, "Buy milk").getByText("Buy milk", { exact: true });
  await expect(title).toHaveCSS("text-decoration-line", "line-through");
  await expect(row(page, "Buy milk").getByRole("checkbox")).toBeChecked();
});
