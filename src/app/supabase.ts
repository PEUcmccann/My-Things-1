import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";
import { supabasePublishableKey, supabaseUrl } from "./backendConfig";

let client: SupabaseClient | null = null;

/**
 * The one Supabase client, made on first use: auth now, the database for sync next.
 * The session is kept in AsyncStorage (localStorage on the web) and its token is
 * refreshed automatically; there is no session in the URL to look for.
 * https://docs.expo.dev/guides/using-supabase/
 */
export function getSupabase(): SupabaseClient {
  if (client) return client;
  const created = createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  if (Platform.OS !== "web") {
    // On iPhone and Android, refresh only while the app is in the foreground.
    AppState.addEventListener("change", (state) => {
      if (state === "active") created.auth.startAutoRefresh();
      else created.auth.stopAutoRefresh();
    });
  }
  client = created;
  return created;
}
