import { expect, test, type Locator, type Page } from "@playwright/test";
import { addToDo, openList, row } from "./helpers";

async function dragTo(page: Page, from: Locator, to: { x: number; y: number }) {
  const box = (await from.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 5, box.y + box.height / 2 + 5, { steps: 3 });
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.up();
}

async function titlesIn(page: Page, screen: string) {
  return page
    .getByTestId(`screen-${screen}`)
    .locator('[data-testid^="todo-row-"]')
    .evaluateAll((rows) => rows.map((r) => r.textContent?.replace(/[≡⋯]/g, "").trim()));
}

test("dragging a To-do reorders the Inbox", async ({ page }) => {
  await page.goto("/");
  await openList(page, "inbox");
  await addToDo(page, "First");
  await addToDo(page, "Second");
  await addToDo(page, "Third");

  const target = (await row(page, "First").boundingBox())!;
  const handle = row(page, "Third").locator('[data-testid^="drag-"]');
  await dragTo(page, handle, { x: target.x + 50, y: target.y + 5 });
  await expect.poll(() => titlesIn(page, "inbox")).toEqual(["Third", "First", "Second"]);

  await page.reload();
  await openList(page, "inbox");
  await expect.poll(() => titlesIn(page, "inbox")).toEqual(["Third", "First", "Second"]);
});

test("dropping a To-do on Today in the drop bar schedules it", async ({ page }) => {
  await page.goto("/");
  await openList(page, "inbox");
  await addToDo(page, "Pay rent");
  const handle = row(page, "Pay rent").locator('[data-testid^="drag-"]');
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x, box.y + 20, { steps: 3 });
  const chip = (await page.getByTestId("drop-today").boundingBox())!;
  await page.mouse.move(chip.x + chip.width / 2, chip.y + chip.height / 2, { steps: 10 });
  await page.mouse.up();
  await expect(page.getByTestId("screen-inbox").getByText("Pay rent")).toHaveCount(0);
  await openList(page, "today");
  await expect(page.getByTestId("screen-today").getByText("Pay rent")).toBeVisible();
});

test("dragging Magic Plus creates the To-do at that spot", async ({ page }) => {
  await page.goto("/");
  await openList(page, "inbox");
  await addToDo(page, "First");
  await addToDo(page, "Second");
  const second = (await row(page, "Second").boundingBox())!;
  await dragTo(page, page.getByTestId("magic-plus"), { x: second.x + 60, y: second.y + 4 });
  await page.getByTestId("new-todo-title").fill("In between");
  await page.getByTestId("new-todo-add").click();
  await expect.poll(() => titlesIn(page, "inbox")).toEqual(["First", "In between", "Second"]);
});

test("Projects can be reordered in the sidebar", async ({ page }) => {
  await page.goto("/");
  for (const name of ["Alpha", "Beta"]) {
    await page.getByTestId("sidebar-new").click();
    await page.getByTestId("new-project").click();
    await page.getByTestId("prompt-input").fill(name);
    await page.getByTestId("prompt-confirm").click();
    await page.getByTestId("back").click();
  }
  const sidebarProjects = () =>
    page
      .getByTestId("sidebar")
      .locator('[data-testid^="sidebar-project-"]')
      .evaluateAll((els) => els.map((e) => e.textContent?.replace("≡", "").trim()));
  await expect.poll(sidebarProjects).toEqual(["Alpha", "Beta"]);
  const alpha = (await page.locator('[data-testid^="sidebar-project-"]').first().boundingBox())!;
  const handle = page.locator('[data-testid^="sidebar-drag-"]').nth(1);
  await dragTo(page, handle, { x: alpha.x + 40, y: alpha.y + 3 });
  await expect.poll(sidebarProjects).toEqual(["Beta", "Alpha"]);
});
