import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type PropsWithChildren,
} from "react";
import { AppState, Platform } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { getSupabaseClient, getAccountAuthPort } from "./client";
import { getAppAccountController, type AccountSnapshot } from "./controller";
import { useConnectivityStore } from "../connectivity/provider";

export type AccountContextValue = AccountSnapshot &
  Omit<ReturnType<typeof getAppAccountController>, "start" | "stop" | "subscribe">;
const AccountContext = createContext<AccountContextValue | null>(null);

function redirectTo() {
  if (Platform.OS === "web")
    return typeof window === "undefined"
      ? "https://localhost/auth/callback"
      : `${window.location.origin}/auth/callback`;
  return Linking.createURL("auth/callback");
}

async function openAuthSession(url: string) {
  // Web follows the provider in this tab and finishes on the callback route.
  if (Platform.OS === "web") {
    window.location.assign(url);
    return null;
  }
  const result = await WebBrowser.openAuthSessionAsync(url, redirectTo());
  return result.type === "success" ? result.url : null;
}

export function AccountProvider({ children }: PropsWithChildren) {
  const connectivity = useConnectivityStore();
  const [client] = useState(getSupabaseClient);
  // The controller's methods are closures, so its actions can be passed on unbound.
  const [{ start, stop, subscribe, ...actions }] = useState(() =>
    getAppAccountController(getAccountAuthPort(), {
      redirectTo: redirectTo(),
      openAuthSession,
      oauthRedirectOpensCallback: Platform.OS !== "ios",
    }),
  );
  const snapshot = useSyncExternalStore(subscribe, actions.getSnapshot, actions.getSnapshot);
  useEffect(() => {
    start();
    if (!client || Platform.OS === "web") return stop;
    let active = true;
    const refresh = (state: string) => {
      if (!active) return;
      if (state === "active" && connectivity.getSnapshot() !== "offline")
        client.auth.startAutoRefresh();
      else client.auth.stopAutoRefresh();
    };
    refresh(AppState.currentState);
    const subscription = AppState.addEventListener("change", refresh);
    const unsubscribe = connectivity.subscribe(() => refresh(AppState.currentState));
    return () => {
      active = false;
      subscription.remove();
      unsubscribe();
      client.auth.stopAutoRefresh();
      stop();
    };
  }, [client, start, stop, connectivity]);
  return (
    <AccountContext.Provider value={{ ...snapshot, ...actions }}>
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount(): AccountContextValue {
  const account = useContext(AccountContext);
  if (!account) throw new Error("useAccount must be used inside AccountProvider");
  return account;
}
