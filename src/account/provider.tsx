import { createContext, useContext, useEffect, useState, useSyncExternalStore, type PropsWithChildren } from "react";
import { AppState, Platform } from "react-native";
import * as Linking from "expo-linking";
import { getSupabaseClient } from "./client";
import { createAccountController, type AccountSnapshot } from "./controller";

type AccountController = ReturnType<typeof createAccountController>;
export type AccountContextValue = AccountSnapshot & Pick<AccountController,
  "signIn" | "signUp" | "requestPasswordReset" | "updatePassword" | "signOut" | "clearFeedback" | "completeAuthLink" | "resumeAuthLink" | "acknowledgeAuthLink">;
const AccountContext = createContext<AccountContextValue | null>(null);

function redirectTo() {
  if (Platform.OS === "web") return typeof window === "undefined" ? "https://localhost/auth/callback" : `${window.location.origin}/auth/callback`;
  return Linking.createURL("auth/callback");
}

export function AccountProvider({ children }: PropsWithChildren) {
  const [client] = useState(getSupabaseClient);
  const [controller] = useState(() => createAccountController(client?.auth ?? null, { redirectTo: redirectTo() }));
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => {
    controller.start();
    if (!client || Platform.OS === "web") return controller.stop;
    const refresh = (state: string) => {
      if (state === "active") client.auth.startAutoRefresh();
      else client.auth.stopAutoRefresh();
    };
    refresh(AppState.currentState);
    const subscription = AppState.addEventListener("change", refresh);
    return () => { subscription.remove(); client.auth.stopAutoRefresh(); controller.stop(); };
  }, [client, controller]);
  return <AccountContext.Provider value={{ ...snapshot,
    signIn: controller.signIn, signUp: controller.signUp,
    requestPasswordReset: controller.requestPasswordReset, updatePassword: controller.updatePassword,
    signOut: controller.signOut, clearFeedback: controller.clearFeedback,
    completeAuthLink: controller.completeAuthLink,
    resumeAuthLink: controller.resumeAuthLink, acknowledgeAuthLink: controller.acknowledgeAuthLink,
  }}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountContextValue {
  const account = useContext(AccountContext);
  if (!account) throw new Error("useAccount must be used inside AccountProvider");
  return account;
}
