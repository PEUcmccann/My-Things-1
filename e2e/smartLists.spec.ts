import { expect, test, type Page } from "@playwright/test";
import { addToDo, openList, openToDo, row } from "./helpers";

async function setEstimate(page: Page, title: string, minutes: number) {
  await openToDo(page, title);
  await page.getByTestId("todo-estimate").click();
  await page.getByTestId(`estimate-${minutes}`).click();
  await page.getByTestId("back").click();
}

test("a Smart List of quick errands shows only matching To-dos", async ({ page }) => {
  await page.goto("/");
  await openList(page, "inbox");
  await addToDo(page, "Post parcel");
  await addToDo(page, "Buy paint");
  await addToDo(page, "Read book");

  await openToDo(page, "Post parcel");
  await page.getByTestId("todo-tags").click();
  await page.getByTestId("tag-picker-new").fill("Errand");
  await page.getByTestId("tag-picker-add").click();
  await page.getByTestId("tag-picker-done").click();
  await page.getByTestId("back").click();
  await openToDo(page, "Buy paint");
  await page.getByTestId("todo-tags").click();
  await page.getByTestId("tag-picker").getByText("Errand").click();
  await page.getByTestId("tag-picker-done").click();
  await page.getByTestId("back").click();
  await setEstimate(page, "Post parcel", 10);
  await setEstimate(page, "Buy paint", 45);
  await setEstimate(page, "Read book", 5);

  // Create the Smart List from the sidebar's New List menu.
  await page.getByTestId("back").click();
  await page.getByTestId("sidebar-new").click();
  await page.getByTestId("new-smart-list").click();
  await page.getByTestId("prompt-input").fill("Quick errands");
  await page.getByTestId("prompt-confirm").click();

  const editor = page.getByTestId("smart-list-editor");
  await expect(editor).toBeVisible();
  await editor.getByText("Errand", { exact: true }).click();
  await editor.getByTestId("smart-filter-estimate-upTo-15").click();
  await editor.getByTestId("smart-list-editor-done").click();
  await expect(editor).toBeHidden();

  const screen = page.getByTestId("screen-smartList");
  await expect(screen.getByText("Quick errands")).toBeVisible();
  await expect(row(page, "Post parcel")).toBeVisible();
  await expect(screen.getByText("Buy paint")).toHaveCount(0);
  await expect(screen.getByText("Read book")).toHaveCount(0);

  // The results follow changes to To-dos.
  await setEstimate(page, "Post parcel", 30);
  await expect(screen.getByText("Post parcel")).toHaveCount(0);
  await expect(screen.getByText("Nothing matches")).toBeVisible();

  // It is listed in the sidebar and opens from there.
  await page.getByTestId("back").click();
  await expect(page.getByTestId("sidebar").getByText("Quick errands")).toBeVisible();
});
