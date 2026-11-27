import type { Account } from "./authAdapter";
import { fakeBackend } from "./backendConfig";
import { fakeRemote, memorySyncStorage, supabaseRemote, type Remote } from "./remote";
import { getSupabase } from "./supabase";

/**
 * The account's edits: Supabase in the app; in the `test:ui` build, a fake kept in
 * localStorage, so two pages of one browser sync with each other.
 */
export function deviceRemote(account: Account): Remote {
  if (!fakeBackend) return supabaseRemote(getSupabase());
  return fakeRemote(globalThis.localStorage ?? memorySyncStorage(), account.id);
}
