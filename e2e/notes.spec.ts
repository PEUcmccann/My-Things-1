import { expect, test } from "@playwright/test";
import { addToDo, openList, openToDo, row } from "./helpers";

test("notes show formatted, and the Checklist count shows on the row", async ({ page }) => {
  await page.goto("/");
  await openList(page, "inbox");
  await addToDo(page, "Pack for the trip");
  await openToDo(page, "Pack for the trip");

  await page.getByTestId("notes").click();
  await page.getByTestId("notes-input").fill("Remember the **passport**");
  await page.getByTestId("checklist-new").click();
  await expect(page.getByTestId("notes")).toContainText("Remember the passport");

  await page.getByTestId("checklist-new").fill("Charger");
  await page.getByTestId("checklist-new").press("Enter");
  await page.getByTestId("checklist-new").fill("Socks");
  await page.getByTestId("checklist-new").press("Enter");
  await page.getByTestId("checklist-tick-0").click();

  await page.getByTestId("back").click();
  await expect(row(page, "Pack for the trip").getByTestId("row-checklist")).toHaveText("1/2");
  await expect(row(page, "Pack for the trip").getByTestId("row-notes")).toBeVisible();
});
