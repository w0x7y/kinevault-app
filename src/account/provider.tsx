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
import { getSupabaseClient, getAccountAuthPort } from "./client";
import { getAppAccountController, type AccountSnapshot } from "./controller";
import { useConnectivityStore } from "../connectivity/provider";

type AccountController = ReturnType<typeof getAppAccountController>;
export type AccountContextValue = AccountSnapshot &
  Pick<
    AccountController,
    | "signIn"
    | "signUp"
    | "requestPasswordReset"
    | "updatePassword"
    | "signOut"
    | "deleteAccount"
    | "clearFeedback"
    | "completeAuthLink"
    | "resumeAuthLink"
    | "acknowledgeAuthLink"
    | "getSnapshot"
  >;
const AccountContext = createContext<AccountContextValue | null>(null);

function redirectTo() {
  if (Platform.OS === "web")
    return typeof window === "undefined"
      ? "https://localhost/auth/callback"
      : `${window.location.origin}/auth/callback`;
  return Linking.createURL("auth/callback");
}

export function AccountProvider({ children }: PropsWithChildren) {
  const connectivity = useConnectivityStore();
  const [client] = useState(getSupabaseClient);
  const [controller] = useState(() =>
    getAppAccountController(getAccountAuthPort(), { redirectTo: redirectTo() }),
  );
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  useEffect(() => {
    controller.start();
    if (!client || Platform.OS === "web") return controller.stop;
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
      controller.stop();
    };
  }, [client, controller, connectivity]);
  return (
    <AccountContext.Provider
      value={{
        ...snapshot,
        signIn: controller.signIn,
        signUp: controller.signUp,
        requestPasswordReset: controller.requestPasswordReset,
        updatePassword: controller.updatePassword,
        signOut: controller.signOut,
        deleteAccount: controller.deleteAccount,
        clearFeedback: controller.clearFeedback,
        completeAuthLink: controller.completeAuthLink,
        resumeAuthLink: controller.resumeAuthLink,
        acknowledgeAuthLink: controller.acknowledgeAuthLink,
        getSnapshot: controller.getSnapshot,
      }}
    >
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount(): AccountContextValue {
  const account = useContext(AccountContext);
  if (!account) throw new Error("useAccount must be used inside AccountProvider");
  return account;
}
