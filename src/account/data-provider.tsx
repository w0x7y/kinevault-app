import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState, useSyncExternalStore, type PropsWithChildren } from "react";
import * as SplashScreen from "expo-splash-screen";
import { useSegments } from "expo-router";
import { useAccount } from "./provider";
import { createAccountStorage } from "./storage";
import { AccountStorageProvider } from "./storage-context";
import { createAccountRemote } from "./remote";
import { createAccountScope } from "./scope";
import { isPublicAccountRoute } from "./navigation";
import { KineLoading } from "../components/kine-loading";
import { AppText, Panel } from "../components/ui";
import { Button } from "../onboarding/controls";
import { ProfileProvider } from "../profile/provider";
import { useConnectivityStore } from "../connectivity/provider";

export function AccountDataProvider({ children }: PropsWithChildren) {
  const { loading, user } = useAccount();
  if (loading) return <KineLoading fill />;
  return (
    <ScopedData key={user?.id ?? "guest"} userId={user?.id ?? null}>
      {children}
    </ScopedData>
  );
}

function ScopedData({ userId, children }: PropsWithChildren<{ userId: string | null }>) {
  const connectivity = useConnectivityStore();
  const account = useAccount();
  const segments = useSegments();
  const authRoute = isPublicAccountRoute(segments);
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
  if (state === "error" && !authRoute)
    return (
      <Panel>
        <AppText accessibilityRole="alert">Couldn't load this account's saved data.</AppText>
        <Button label="Try again" onPress={scope.retry} />
        <Button
          label="Log out"
          secondary
          disabled={account.busy}
          onPress={() => void account.signOut()}
        />
        {account.error && <AppText accessibilityRole="alert">{account.error}</AppText>}
      </Panel>
    );
  if (state === "loading" && !authRoute) return <KineLoading fill />;
  return (
    <AccountStorageProvider storage={storage}>
      <ProfileProvider>{children}</ProfileProvider>
    </AccountStorageProvider>
  );
}
