import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { addToDo, openList } from "./helpers";

function localDate(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

test("an export restores over a To-do added since", async ({ page }) => {
  await page.goto("/");
  await openList(page, "inbox");
  await addToDo(page, "Kept in the export");

  await openList(page, "settings");
  const download = page.waitForEvent("download");
  await page.getByTestId("export-data").click();
  const file = await download;
  expect(file.suggestedFilename()).toBe(`mythings-${localDate()}.json`);
  const path = await file.path();
  const text = await readFile(path, "utf8");
  expect(JSON.parse(text)).toMatchObject({ format: "mythings-export", version: 1 });

  await openList(page, "inbox");
  await addToDo(page, "Added after the export");
  await expect(page.getByText("Added after the export")).toBeVisible();

  await openList(page, "settings");
  const chooser = page.waitForEvent("filechooser");
  await page.getByTestId("restore-data").click();
  await (await chooser).setFiles(path);
  await expect(page.getByTestId("restore-confirm-sheet")).toContainText(
    "Replace everything on this device with the data from",
  );
  await page.getByTestId("restore-data-confirm").click();
  await expect(page.getByTestId("data-status")).toHaveText("Restored");

  await openList(page, "inbox");
  await expect(page.getByText("Kept in the export")).toBeVisible();
  await expect(page.getByText("Added after the export")).toHaveCount(0);
});

test("a file that isn't an export is refused", async ({ page }) => {
  await page.goto("/");
  await openList(page, "settings");
  const chooser = page.waitForEvent("filechooser");
  await page.getByTestId("restore-data").click();
  await (
    await chooser
  ).setFiles({
    name: "other.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"format":"other"}'),
  });
  await expect(page.getByTestId("data-status")).toHaveText("This isn't a MyThings export");
});

test("To-dos export as a CSV file", async ({ page }) => {
  await page.goto("/");
  await openList(page, "inbox");
  await addToDo(page, "Shows in the spreadsheet");

  await openList(page, "settings");
  const download = page.waitForEvent("download");
  await page.getByTestId("export-csv").click();
  const file = await download;
  expect(file.suggestedFilename()).toBe(`mythings-todos-${localDate()}.csv`);
  const text = await readFile(await file.path(), "utf8");
  expect(text.startsWith("﻿Title,Notes,Status,Start date,")).toBe(true);
  expect(text).toContain("\r\nShows in the spreadsheet,");
});
