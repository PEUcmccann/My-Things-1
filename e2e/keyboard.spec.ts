import { expect, test, type Page } from "@playwright/test";
import { addToDo, openList, openToDo } from "./helpers";

// The Home Screen web app on iPhone, in dark mode (issue #34). Chromium can't show the iOS
// keyboard, so these checks replace window.visualViewport with one whose visible height the
// test sets, the way iOS shrinks it when the keyboard opens.

test.use({ colorScheme: "dark" });

const dark = "rgb(18, 20, 22)"; // theme.tsx dark background, #121416
const keyboardHeight = 300;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    // Read the size late: when this script runs, the page's viewport tag isn't applied yet.
    let keyboard = 0;
    const viewport = Object.defineProperties(new EventTarget(), {
      offsetLeft: { value: 0 },
      offsetTop: { value: 0 },
      pageLeft: { value: 0 },
      pageTop: { value: 0 },
      scale: { value: 1 },
      width: { get: () => document.documentElement.clientWidth },
      height: { get: () => document.documentElement.clientHeight - keyboard },
    });
    Object.defineProperty(window, "visualViewport", { get: () => viewport });
    (window as unknown as Record<string, unknown>).showKeyboard = (height: number) => {
      keyboard = height;
      viewport.dispatchEvent(new Event("resize"));
    };
  });
});

function showKeyboard(page: Page, height: number) {
  return page.evaluate(
    (h) => (window as unknown as { showKeyboard: (h: number) => void }).showKeyboard(h),
    height,
  );
}

/** Expects the element to lie wholly within the part of the screen above the keyboard. */
async function expectAboveKeyboard(page: Page, testID: string) {
  const visibleBottom = page.viewportSize()!.height - keyboardHeight;
  await expect(async () => {
    const box = (await page.getByTestId(testID).boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(visibleBottom);
  }).toPass();
}

/** The colours of the top and bottom rows of pixels on screen, as "r,g,b" strings. */
async function edgeColours(page: Page): Promise<string[]> {
  const png = (await page.screenshot()).toString("base64");
  return page.evaluate(async (data) => {
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0);
    const colours = new Set<string>();
    for (const y of [0, image.height - 1]) {
      const row = context.getImageData(0, y, image.width, 1).data;
      for (let i = 0; i < row.length; i += 4) colours.add(`${row[i]},${row[i + 1]},${row[i + 2]}`);
    }
    return [...colours];
  }, png);
}

test("in dark mode the page behind the app is dark, with no white at the edges", async ({
  page,
}) => {
  await page.goto("/");
  await openList(page, "today");
  for (const selector of ["html", "body"]) {
    await expect(page.locator(selector)).toHaveCSS("background-color", dark);
  }
  for (const colour of await edgeColours(page)) {
    const [r, g, b] = colour.split(",").map(Number);
    expect(Math.max(r, g, b), `edge pixel ${colour}`).toBeLessThan(64);
  }
});

test("the new To-do field stays above the keyboard", async ({ page }) => {
  await page.goto("/");
  await openList(page, "today");
  await page.getByTestId("magic-plus").click();
  await expect(page.getByTestId("new-todo-title")).toBeFocused();
  await showKeyboard(page, keyboardHeight);
  await expectAboveKeyboard(page, "new-todo-title");
  await expectAboveKeyboard(page, "new-todo-add");

  // When the keyboard closes, the sheet returns to the bottom of the screen.
  await showKeyboard(page, 0);
  await expect(async () => {
    const box = (await page.getByTestId("new-todo-sheet").boundingBox())!;
    expect(box.y + box.height).toBeCloseTo(page.viewportSize()!.height, 0);
  }).toPass();
});

test("the new Tag field stays above the keyboard", async ({ page }) => {
  await page.goto("/");
  await openList(page, "inbox");
  await addToDo(page, "Buy stamps");
  await openToDo(page, "Buy stamps");
  await page.getByTestId("todo-tags").click();
  await page.getByTestId("tag-picker-new").focus();
  await showKeyboard(page, keyboardHeight);
  await expectAboveKeyboard(page, "tag-picker-new");
  await expectAboveKeyboard(page, "tag-picker-done");
});

test("screens shrink to the area above the keyboard", async ({ page }) => {
  await page.goto("/");
  await openList(page, "inbox");
  await showKeyboard(page, keyboardHeight);
  await expectAboveKeyboard(page, "magic-plus");
});
