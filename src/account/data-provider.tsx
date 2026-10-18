import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState, useSyncExternalStore, type PropsWithChildren } from "react";
import * as SplashScreen from "expo-splash-screen";
import { useSegments } from "expo-router";
import { useAccount } from "./provider";
import { createAccountStorage } from "./storage";
import { AccountStorageProvider } from "./storage-context";
import { createAccountRemote } from "./remote";
import { createAccountScope } from "./scope";
import { entryRoute, sessionGate, storageGate } from "./entry-policy";
import { EntryGate } from "./entry-gate";
import { View } from "react-native";
import { AppButton } from "../components/button";
import { InlineMessage } from "../components/inline-message";
import { StatusScreen } from "../onboarding/status-screen";
import { spacing } from "../theme/tokens";
import { ProfileProvider } from "../profile/provider";
import { useConnectivityStore } from "../connectivity/provider";

export function AccountDataProvider({ children }: PropsWithChildren) {
  const { loading, user } = useAccount();
  const gate = sessionGate({ accountLoading: loading });
  if (gate) return <EntryGate decision={gate} />;
  return (
    <ScopedData key={user?.id ?? "guest"} userId={user?.id ?? null}>
      {children}
    </ScopedData>
  );
}

function ScopedData({ userId, children }: PropsWithChildren<{ userId: string | null }>) {
  const connectivity = useConnectivityStore();
  const account = useAccount();
  const route = entryRoute(useSegments());
  const [storage] = useState(() =>
    createAccountStorage({
      userId,
      local: AsyncStorage,
      remote: userId ? createAccountRemote(userId) : null,
    }),
  );
  const [scope] = useState(() => createAccountScope({ userId, storage, connectivity }));
  const state = useSyncExternalStore(scope.subscribe, scope.getSnapshot, scope.getSnapshot);
  useEffect(() => {
    scope.start();
    return scope.stop;
  }, [scope]);
  useEffect(() => {
    if (state === "error") void SplashScreen.hideAsync();
  }, [state]);
  const gate = storageGate(route, { storage: state });
  if (gate?.kind === "storageFailure")
    return (
      <StatusScreen
        icon="cloud"
        title="Couldn't load this account's saved data."
        titleRole="alert"
        message="Check your connection and try again, or log out."
      >
        <View style={{ gap: spacing.md }}>
          <AppButton label="Try again" tone="primary" onPress={scope.retry} />
          <AppButton
            label="Log out"
            disabled={account.busy}
            onPress={() => void account.signOut()}
          />
          {account.error && <InlineMessage>{account.error}</InlineMessage>}
        </View>
      </StatusScreen>
    );
  if (gate) return <EntryGate decision={gate} />;
  return (
    <AccountStorageProvider storage={storage}>
      <ProfileProvider>{children}</ProfileProvider>
    </AccountStorageProvider>
  );
}
