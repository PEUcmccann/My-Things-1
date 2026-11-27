import { expect, test } from "@playwright/test";
import { addToDo, openList } from "./helpers";

// The test:ui build signs in with a fake (src/app/authAdapter.ts): any email, code 123456.

test("signs in with an email and a 6-digit code, stays signed in, then signs out", async ({
  page,
}) => {
  await page.goto("/");
  await openList(page, "inbox");
  await addToDo(page, "Made before signing in");

  await openList(page, "settings");
  const section = page.getByTestId("account-section");
  await expect(section).toContainText("Sign in to sync your data");

  await page.getByTestId("account-email").fill("not-an-email");
  await page.getByTestId("account-send-code").click();
  await expect(page.getByTestId("account-error")).toHaveText("Enter a valid email address.");

  await page.getByTestId("account-email").fill("sam@example.com");
  await page.getByTestId("account-send-code").click();
  await expect(page.getByTestId("account-code-sent")).toHaveText(
    "We sent a 6-digit code to sam@example.com",
  );
  const code = page.getByTestId("account-code");
  await expect(code).toHaveAttribute("autocomplete", "one-time-code");
  await expect(code).toHaveAttribute("inputmode", "numeric");
  await expect(page.getByTestId("account-resend")).toBeDisabled();
  await expect(page.getByTestId("account-resend")).toContainText("Resend code in");

  // Only digits, at most six.
  await code.fill("12a34");
  await expect(code).toHaveValue("1234");
  await expect(page.getByTestId("account-sign-in")).toBeDisabled();
  await code.fill("000000");
  await page.getByTestId("account-sign-in").click();
  await expect(page.getByTestId("account-error")).toContainText("wrong or has expired");

  await code.fill("123456");
  await page.getByTestId("account-sign-in").click();
  await expect(page.getByTestId("account-status")).toHaveText("Signed in");
  await expect(page.getByTestId("account-email-shown")).toHaveText("sam@example.com");

  // Still signed in, with the data kept, after a restart.
  await page.reload();
  await openList(page, "settings");
  await expect(page.getByTestId("account-status")).toHaveText("Signed in");
  await openList(page, "inbox");
  await expect(page.getByText("Made before signing in")).toBeVisible();

  await openList(page, "settings");
  await page.getByTestId("account-sign-out").click();
  const sheet = page.getByTestId("sign-out-sheet");
  await expect(sheet).toContainText("Sign out?");
  await expect(sheet).toContainText(
    "This removes your data from this device. It stays in your account.",
  );
  await page.getByTestId("sign-out-confirm").click();
  await expect(section).toContainText("Sign in to sync your data");

  await openList(page, "inbox");
  await expect(page.getByText("Made before signing in")).toHaveCount(0);
  await page.reload();
  await openList(page, "settings");
  await expect(section).toContainText("Sign in to sync your data");
});

test("a different email goes back to the email field", async ({ page }) => {
  await page.goto("/");
  await openList(page, "settings");
  await page.getByTestId("account-email").fill("sam@example.com");
  await page.getByTestId("account-send-code").click();
  await page.getByTestId("account-different-email").click();
  await expect(page.getByTestId("account-email")).toHaveValue("sam@example.com");
  await expect(page.getByTestId("account-send-code")).toBeVisible();
});
