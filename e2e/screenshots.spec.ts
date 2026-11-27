import { expect, test, type Page } from "@playwright/test";
import { addToDo, openList, openToDo } from "./helpers";

// Screenshots of the main screens at iPhone size, in light and dark, for review.
// Run with: SCREENSHOTS=1 npm run test:ui -- screenshots
test.skip(!process.env.SCREENSHOTS, "Only when SCREENSHOTS is set");

const dir = "docs/screenshots/milestone-1";

async function seed(page: Page) {
  await page.goto("/");
  await page.getByTestId("sidebar-new").click();
  await page.getByTestId("new-area").click();
  await page.getByTestId("prompt-input").fill("Home");
  await page.getByTestId("prompt-confirm").click();
  await page.getByTestId("area-menu").click();
  await page.getByTestId("area-new-project").click();
  await page.getByTestId("prompt-input").fill("Move house");
  await page.getByTestId("prompt-confirm").click();
  await addToDo(page, "Book a van");
  await addToDo(page, "Pack the books");
  await addToDo(page, "Tell the bank");
  await openToDo(page, "Book a van");
  await page.getByTestId("todo-when").click();
  await page.getByTestId("when-today").click();
  await page.getByTestId("todo-deadline").click();
  const soon = new Date(Date.now() + 2 * 86_400_000);
  const ymd = [soon.getFullYear(), soon.getMonth() + 1, soon.getDate()]
    .map((n) => String(n).padStart(2, "0"))
    .join("-");
  if (!(await page.getByTestId(`cal-${ymd}`).isVisible()))
    await page.getByTestId("cal-next").click();
  await page.getByTestId(`cal-${ymd}`).click();
  await page.getByTestId("notes").click();
  await page.getByTestId("notes-input").fill("Ask for the **large** van");
  await page.getByTestId("checklist-new").click();
  await page.getByTestId("checklist-new").fill("Compare prices");
  await page.getByTestId("checklist-new").press("Enter");
  await page.getByTestId("todo-tags").click();
  await page.getByTestId("tag-picker-new").fill("Errand");
  await page.getByTestId("tag-picker-add").click();
  await page.getByTestId("tag-picker-done").click();
  await page.getByTestId("back").click();
  await page.locator('[data-testid^="todo-check-"]').nth(1).click();
  await openList(page, "inbox");
  await addToDo(page, "Buy milk");
  await addToDo(page, "Plan the weekend");
  await openToDo(page, "Plan the weekend");
  await page.getByTestId("todo-when").click();
  await page.getByTestId("when-evening").click();
  await page.getByTestId("back").click();
}

for (const scheme of ["light", "dark"] as const) {
  test(`main screens in ${scheme}`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.emulateMedia({ colorScheme: scheme });
    await seed(page);
    const shot = async (name: string) => {
      await page.waitForTimeout(350);
      await page.screenshot({ path: `${dir}/${name}-${scheme}.png` });
    };
    await page.getByTestId("back").click();
    await expect(page.getByTestId("sidebar")).toBeVisible();
    await shot("sidebar");
    await openList(page, "inbox");
    await shot("inbox");
    await openList(page, "today");
    await shot("today");
    await page.getByTestId("back").click();
    await page.getByTestId("sidebar").getByText("Move house").click();
    await shot("project");
    await openToDo(page, "Book a van");
    await shot("todo");
    await page.getByTestId("back").click();
    await page.getByTestId("select-mode").click();
    await page.locator('[data-testid^="todo-row-"]').first().click();
    await shot("multi-select");
    await page.getByTestId("selection-done").click();
    await page.getByTestId("open-quickfind").click();
    await page.getByTestId("quickfind-input").fill("van");
    await shot("quick-find");
    await openList(page, "upcoming");
    await shot("upcoming");
    await page.getByTestId("back").click();
    await page.getByTestId("sidebar-settings").click();
    await shot("settings");
  });
}
