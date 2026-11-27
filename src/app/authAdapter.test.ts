import { describe, expect, it } from "vitest";
import {
  authErrorKind,
  authErrorText,
  AuthError,
  fakeAuth,
  fakeCode,
  isValidEmail,
  memoryStorage,
} from "./authAdapter";

describe("email check", () => {
  it("accepts ordinary addresses and refuses others", () => {
    expect(isValidEmail("sam@example.com")).toBe(true);
    expect(isValidEmail(" sam.lee+mythings@mail.example.org ")).toBe(true);
    expect(isValidEmail("sam")).toBe(false);
    expect(isValidEmail("sam@example")).toBe(false);
    expect(isValidEmail("sam @example.com")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });
});

describe("Supabase errors in plain words", () => {
  const api = (code: string, status = 400) => ({ name: "AuthApiError", code, status });

  it("tells a wrong or expired code", () => {
    expect(authErrorKind(api("otp_expired", 403))).toBe("wrongCode");
    expect(authErrorKind(api("invalid_credentials"))).toBe("wrongCode");
  });

  it("tells an invalid email", () => {
    expect(authErrorKind(api("email_address_invalid"))).toBe("invalidEmail");
    expect(authErrorKind(api("validation_failed"))).toBe("invalidEmail");
  });

  it("tells too many requests", () => {
    expect(authErrorKind(api("over_email_send_rate_limit", 429))).toBe("tooManyRequests");
    expect(authErrorKind(api("over_request_rate_limit", 429))).toBe("tooManyRequests");
    expect(authErrorKind({ name: "AuthApiError", status: 429 })).toBe("tooManyRequests");
  });

  it("tells no connection", () => {
    expect(authErrorKind({ name: "AuthRetryableFetchError", status: 0 })).toBe("offline");
    expect(authErrorKind(new TypeError("Network request failed"))).toBe("offline");
    expect(authErrorKind(new TypeError("Failed to fetch"))).toBe("offline");
  });

  it("falls back to something went wrong", () => {
    expect(authErrorKind({ name: "AuthRetryableFetchError", status: 503 })).toBe("unknown");
    expect(authErrorKind(new Error("boom"))).toBe("unknown");
    expect(authErrorKind(new AuthError("tooManyRequests"))).toBe("tooManyRequests");
  });

  it("has a sentence for every kind", () => {
    for (const kind of [
      "invalidEmail",
      "wrongCode",
      "tooManyRequests",
      "offline",
      "unknown",
    ] as const) {
      expect(authErrorText(kind)).toMatch(/^[A-Z].*\.$/);
    }
  });
});

describe("fake sign-in", () => {
  it("signs in any email with the test code, and keeps the session after a restart", async () => {
    const storage = memoryStorage();
    const auth = fakeAuth(storage);
    expect(await auth.currentAccount()).toBeNull();
    await auth.sendCode("sam@example.com");
    const account = await auth.verifyCode("sam@example.com", fakeCode);
    expect(account.email).toBe("sam@example.com");
    expect(account.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(await fakeAuth(storage).currentAccount()).toEqual(account);
  });

  it("gives each email its own account id, the same every time", async () => {
    const auth = fakeAuth(memoryStorage());
    const a = await auth.verifyCode("a@example.com", fakeCode);
    const b = await auth.verifyCode("b@example.com", fakeCode);
    const again = await fakeAuth(memoryStorage()).verifyCode("a@example.com", fakeCode);
    expect(a.id).not.toBe(b.id);
    expect(again.id).toBe(a.id);
  });

  it("refuses another code and an invalid email", async () => {
    const auth = fakeAuth(memoryStorage());
    await expect(auth.verifyCode("sam@example.com", "000000")).rejects.toMatchObject({
      kind: "wrongCode",
    });
    await expect(auth.sendCode("sam")).rejects.toMatchObject({ kind: "invalidEmail" });
    expect(await auth.currentAccount()).toBeNull();
  });

  it("signs out", async () => {
    const storage = memoryStorage();
    const auth = fakeAuth(storage);
    await auth.verifyCode("sam@example.com", fakeCode);
    await auth.signOut();
    expect(await fakeAuth(storage).currentAccount()).toBeNull();
  });
});
