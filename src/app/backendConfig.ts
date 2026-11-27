// The Supabase project behind sign-in and sync (docs/wiki/subsystems/supabase.md).
// Both values are public by design: they ship in the web app, and row-level security
// protects the data. Never put the secret or service_role key here.
export const supabaseUrl = "https://mionebydpkthdqxljrow.supabase.co";
export const supabasePublishableKey = "sb_publishable_f1apkluJzsBj5hdl2fongw_IRXg0ls6";

/**
 * True only in the `test:ui` build (playwright.config.ts sets EXPO_PUBLIC_FAKE_BACKEND):
 * the app then talks to fakes instead of Supabase, so UI checks need no real email.
 * Expo inlines EXPO_PUBLIC_ variables at build time, so this must stay dot notation.
 */
export const fakeBackend = process.env.EXPO_PUBLIC_FAKE_BACKEND === "1";
