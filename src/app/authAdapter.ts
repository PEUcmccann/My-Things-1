import type { SupabaseClient, User } from "@supabase/supabase-js";

/** A signed-in account: its Supabase user id (the records' Owner) and email. */
export interface Account {
  id: string;
  email: string;
}

/**
 * Signing in with an email and a 6-digit code. The app uses Supabase Auth; the UI
 * checks use the fake, so no real email is ever needed.
 */
export interface Auth {
  /** The account of the session kept on this device, or null when signed out. */
  currentAccount(): Promise<Account | null>;
  /** Emails a 6-digit code, creating the account on first sign-in. */
  sendCode(email: string): Promise<void>;
  /** Checks the code and keeps the session on this device. */
  verifyCode(email: string, code: string): Promise<Account>;
  /** Forgets the session on this device only; other devices stay signed in. */
  signOut(): Promise<void>;
}

export type AuthErrorKind =
  "invalidEmail" | "wrongCode" | "tooManyRequests" | "offline" | "unknown";

/** A sign-in failure the app can explain. */
export class AuthError extends Error {
  constructor(readonly kind: AuthErrorKind) {
    super(kind);
    this.name = "AuthError";
  }
}

/** Seconds before another code can be sent: Supabase's default limit per address. */
export const resendSeconds = 60;

export const codeLength = 6;

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** Keeps only digits, at most six of them, as the code field accepts. */
export function codeDigits(text: string): string {
  return text.replace(/\D/g, "").slice(0, codeLength);
}

const wrongCodes = ["otp_expired", "invalid_credentials"];
const invalidEmailCodes = ["email_address_invalid", "validation_failed"];

/** What went wrong, from an error thrown by Supabase Auth or fetch. */
export function authErrorKind(error: unknown): AuthErrorKind {
  if (error instanceof AuthError) return error.kind;
  const e = (error ?? {}) as { name?: string; code?: string; status?: number; message?: string };
  if (e.code && wrongCodes.includes(e.code)) return "wrongCode";
  if (e.code && invalidEmailCodes.includes(e.code)) return "invalidEmail";
  if (e.status === 429 || e.code?.startsWith("over_")) return "tooManyRequests";
  if (e.name === "AuthRetryableFetchError" && !e.status) return "offline";
  if (e.name === "TypeError" && /network|fetch/i.test(e.message ?? "")) return "offline";
  return "unknown";
}

/** The error shown under the field, in plain words. */
export function authErrorText(kind: AuthErrorKind): string {
  switch (kind) {
    case "invalidEmail":
      return "Enter a valid email address.";
    case "wrongCode":
      return "That code is wrong or has expired. Check the email or send a new code.";
    case "tooManyRequests":
      return "Too many tries. Wait a minute, then try again.";
    case "offline":
      return "No connection. Check you're online, then try again.";
    case "unknown":
      return "Something went wrong. Try again.";
  }
}

function accountOf(user: User | null | undefined): Account | null {
  return user ? { id: user.id, email: user.email ?? "" } : null;
}

/** Supabase Auth email OTP: `signInWithOtp`, then `verifyOtp` with type `email`. */
export function supabaseAuth(client: SupabaseClient): Auth {
  const fail = (error: unknown): never => {
    throw new AuthError(authErrorKind(error));
  };
  return {
    async currentAccount() {
      // The session kept in storage; it is refreshed automatically while the app is open.
      const { data } = await client.auth.getSession();
      return accountOf(data.session?.user);
    },
    async sendCode(email) {
      if (!isValidEmail(email)) throw new AuthError("invalidEmail");
      const { error } = await client.auth
        .signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } })
        .catch(fail);
      if (error) fail(error);
    },
    async verifyCode(email, code) {
      const { data, error } = await client.auth
        .verifyOtp({ email: email.trim(), token: code, type: "email" })
        .catch(fail);
      if (error) fail(error);
      const account = accountOf(data.user ?? data.session?.user);
      if (!account) throw new AuthError("unknown");
      return account;
    },
    async signOut() {
      await client.auth.signOut({ scope: "local" });
    },
  };
}

/** The part of AsyncStorage the fake uses, so tests can pass memory instead. */
export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export function memoryStorage(): KeyValueStorage {
  const data = new Map<string, string>();
  return {
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => void data.set(key, value),
    removeItem: async (key) => void data.delete(key),
  };
}

/** The code the fake accepts for any email. */
export const fakeCode = "123456";

const fakeKey = "mythings:fake-auth";

/** A v4-shaped UUID that is always the same for one email. */
function fakeUserId(email: string): string {
  let hex = "";
  for (let seed = 0; hex.length < 32; seed++) {
    // FNV-1a, once per seed, for 8 hex digits at a time.
    let h = 0x811c9dc5 ^ seed;
    for (const ch of email.toLowerCase()) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193);
    hex += (h >>> 0).toString(16).padStart(8, "0");
  }
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Signs in any valid email with the code 123456, sending nothing. The session is kept
 * in `storage`, so it survives a restart like a real one. Only the `test:ui` build uses it.
 */
export function fakeAuth(storage: KeyValueStorage): Auth {
  return {
    async currentAccount() {
      const raw = await storage.getItem(fakeKey);
      return raw ? (JSON.parse(raw) as Account) : null;
    },
    async sendCode(email) {
      if (!isValidEmail(email)) throw new AuthError("invalidEmail");
    },
    async verifyCode(email, code) {
      if (code !== fakeCode) throw new AuthError("wrongCode");
      const account = { id: fakeUserId(email.trim()), email: email.trim() };
      await storage.setItem(fakeKey, JSON.stringify(account));
      return account;
    },
    async signOut() {
      await storage.removeItem(fakeKey);
    },
  };
}
