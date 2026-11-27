import { expect, test, type Page } from "@playwright/test";
import { addToDo, openList, openToDo } from "./helpers";

async function giveTimeSlot(page: Page, title: string, hour: number) {
  await openToDo(page, title);
  await page.getByTestId("todo-time-slot").click();
  await page.getByTestId(`slot-hour-${hour}`).click();
  await page.getByTestId("slot-minute-0").click();
  await page.getByTestId("slot-save").click();
  await page.getByTestId("back").click();
}

for (const scheme of ["light", "dark"] as const) {
  test(`a To-do's Time slot shows as a block on Today's timeline (${scheme})`, async ({
    page,
  }, testInfo) => {
    await page.emulateMedia({ colorScheme: scheme });
    // 10:00 today, so the current time is inside the timeline's hours.
    const morning = new Date();
    morning.setHours(10, 0, 0, 0);
    await page.clock.install({ time: morning });
    await page.goto("/");
    await openList(page, "today");
    await addToDo(page, "Dentist");
    await addToDo(page, "Call the bank");
    await addToDo(page, "Pay rent");
    await giveTimeSlot(page, "Dentist", 14);
    await giveTimeSlot(page, "Call the bank", 14);

    // List is the default view of Today.
    await expect(page.getByTestId("today-view-list")).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("timeline")).toBeHidden();

    await page.getByTestId("today-view-timeline").click();
    const timeline = page.getByTestId("timeline");
    await expect(timeline).toBeVisible();
    await expect(timeline.getByTestId("timeline-now")).toBeAttached();
    // Only To-dos with a Time slot are on the timeline; overlapping ones sit side by side.
    const dentist = timeline.locator('[data-testid^="timeline-block-"]', { hasText: "Dentist" });
    const bank = timeline.locator('[data-testid^="timeline-block-"]', { hasText: "Call the bank" });
    // Sharing the width, a short block leaves its time to the accessibility label.
    await expect(dentist).toHaveAttribute("aria-label", "Dentist, 14:00–14:30");
    await expect(bank).toBeVisible();
    await expect(timeline.getByText("Pay rent")).toHaveCount(0);
    const sideBySide = async () => {
      const [a, b] = [await dentist.boundingBox(), await bank.boundingBox()];
      return !!a && !!b && (a.x + a.width <= b.x + 1 || b.x + b.width <= a.x + 1);
    };
    await expect.poll(sideBySide).toBe(true);

    await dentist.scrollIntoViewIfNeeded();
    // With SCREENSHOTS set, also saved for review beside the other screenshots.
    const path = process.env.SCREENSHOTS
      ? `docs/screenshots/milestone-2/timeline-${scheme}.png`
      : undefined;
    await testInfo.attach(`timeline-${scheme}`, {
      body: await page.screenshot({ path }),
      contentType: "image/png",
    });

    // Tapping a block opens the To-do; completing it strikes the block through.
    await dentist.click();
    await expect(page.getByTestId("screen-todo")).toBeVisible();
    await page.getByTestId("todo-complete").click();
    await page.getByTestId("back").click();
    await expect(page.getByTestId("timeline")).toBeVisible();
    await expect(dentist.getByTestId("finished-completed")).toBeVisible();
  });
}

test.describe("on the wide web layout", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("the timeline fills the content beside the sidebar", async ({ page }) => {
    await page.goto("/");
    await openList(page, "today");
    await addToDo(page, "Dentist");
    await giveTimeSlot(page, "Dentist", 11);
    await openList(page, "today");
    await page.getByTestId("today-view-timeline").click();

    const block = page.getByTestId("timeline").locator('[data-testid^="timeline-block-"]');
    await expect(block).toContainText("Dentist");
    await expect(block.getByTestId("timeline-time")).toHaveText("11:00–11:30");
    const box = await block.boundingBox();
    expect(box && box.width > 600).toBe(true);
    if (process.env.SCREENSHOTS)
      await page.screenshot({ path: "docs/screenshots/milestone-2/timeline-wide-light.png" });
  });
});
