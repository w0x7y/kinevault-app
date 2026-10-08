import "react-native-url-polyfill/auto";
import { createClient, processLock, type SupabaseClient } from "@supabase/supabase-js";
import { Platform } from "react-native";
import { sessionStorage } from "./session-storage";
import { createAccountAuthAdapter } from "./auth-adapter";
import type { AccountAuthPort } from "./controller";

export const accountAuthStorageKey = "kinevault-track.auth.v1";

let client: SupabaseClient | null | undefined;

export function getSupabaseClient(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) return (client = null);
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol !== "https:" &&
      !(parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname))
    )
      return (client = null);
    client = createClient(url, key, {
      auth: {
        storage: sessionStorage,
        storageKey: accountAuthStorageKey,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: "pkce",
        ...(Platform.OS !== "web" ? { lock: processLock } : {}),
      },
    });
    return client;
  } catch {
    return (client = null);
  }
}

let accountAuth: AccountAuthPort | null | undefined;
export function getAccountAuthPort(): AccountAuthPort | null {
  if (accountAuth !== undefined) return accountAuth;
  const configured = getSupabaseClient();
  return (accountAuth = configured
    ? createAccountAuthAdapter(configured.auth, sessionStorage, accountAuthStorageKey)
    : null);
}
