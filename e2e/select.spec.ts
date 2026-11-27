import { expect, test } from "@playwright/test";
import { addToDo, openList, row } from "./helpers";

test("selecting two To-dos and completing both at once", async ({ page }) => {
  await page.goto("/");
  await openList(page, "inbox");
  await addToDo(page, "Buy milk");
  await addToDo(page, "Post letter");
  await addToDo(page, "Stay open");

  await page.getByTestId("select-mode").click();
  await row(page, "Buy milk").click();
  await row(page, "Post letter").click();
  await expect(page.getByTestId("selection-count")).toHaveText("2 selected");
  await page.getByTestId("bulk-complete").click();
  await expect(page.getByTestId("selection-bar")).toBeHidden();

  for (const title of ["Buy milk", "Post letter"]) {
    await expect(row(page, title).getByRole("checkbox")).toBeChecked();
  }
  await expect(row(page, "Stay open").getByRole("checkbox")).not.toBeChecked();
});

test("swiping right on a To-do opens the When picker", async ({ page }) => {
  await page.goto("/");
  await openList(page, "inbox");
  await addToDo(page, "Water plants");
  const box = (await row(page, "Water plants").boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + 60, y);
  await page.mouse.down();
  await page.mouse.move(box.x + 200, y, { steps: 12 });
  await page.mouse.up();
  await expect(page.getByTestId("when-picker")).toBeVisible();
  await page.getByTestId("when-today").click();
  await expect(page.getByTestId("screen-inbox").getByText("Water plants")).toHaveCount(0);
});

test("the row menu offers When, Select, Move and Delete on the web", async ({ page }) => {
  await page.goto("/");
  await openList(page, "inbox");
  await addToDo(page, "Old idea");
  await row(page, "Old idea").locator('[data-testid^="todo-menu-"]').click();
  await page.getByTestId("row-select").click();
  await expect(page.getByTestId("selection-count")).toHaveText("1 selected");
  await page.getByTestId("bulk-delete").click();
  await expect(page.getByTestId("screen-inbox").getByText("Old idea")).toHaveCount(0);
});
