import AsyncStorage from "@react-native-async-storage/async-storage";
import { fakeAuth, supabaseAuth, type Auth } from "./authAdapter";
import { fakeBackend } from "./backendConfig";
import { getSupabase } from "./supabase";

/** Supabase Auth in the app, the fake in the `test:ui` build. */
export function deviceAuth(): Auth {
  return fakeBackend ? fakeAuth(AsyncStorage) : supabaseAuth(getSupabase());
}
