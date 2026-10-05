import "react-native-url-polyfill/auto";
import { createClient, processLock, type SupabaseClient } from "@supabase/supabase-js";
import { Platform } from "react-native";
import { sessionStorage } from "./session-storage";

let client: SupabaseClient | null | undefined;

export function getSupabaseClient(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) return client = null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname))) return client = null;
    client = createClient(url, key, { auth: {
      storage: sessionStorage,
      storageKey: "kinevault-track.auth.v1",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: "pkce",
      ...(Platform.OS !== "web" ? { lock: processLock } : {}),
    } });
    return client;
  } catch { return client = null; }
}
