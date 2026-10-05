import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState, type PropsWithChildren } from "react";
import * as SplashScreen from "expo-splash-screen";
import { useSegments } from "expo-router";
import { useAccount } from "./provider";
import { createAccountStorage } from "./storage";
import { AccountStorageProvider } from "./storage-context";
import { createAccountRemote } from "./remote";
import { isPublicAccountRoute } from "./navigation";
import { KineLoading } from "../components/kine-loading";
import { AppText, Panel } from "../components/ui";
import { Button } from "../onboarding/controls";
import { ProfileProvider } from "../profile/provider";

export function AccountDataProvider({ children }: PropsWithChildren) {
  const { loading, user } = useAccount();
  if (loading) return <KineLoading fill />;
  return <ScopedData key={user?.id ?? "guest"} userId={user?.id ?? null}>{children}</ScopedData>;
}

function ScopedData({ userId, children }: PropsWithChildren<{ userId: string | null }>) {
  const account = useAccount();
  const segments = useSegments();
  const authRoute = isPublicAccountRoute(segments);
  const [storage] = useState(() => createAccountStorage({
    userId, local: AsyncStorage, remote: userId ? createAccountRemote(userId) : null,
  }));
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    storage.start().then(async () => {
      if (userId && storage.getSnapshot().error && await storage.getItem("kinevault-track.profile.v1") === null) throw new Error("No offline account profile");
      if (active) { setError(false); setReady(true); }
    }).catch(() => {
      if (active) { setError(true); void SplashScreen.hideAsync(); }
    });
    return () => { active = false; storage.stop(); };
  }, [storage, attempt]);
  if (error && !authRoute) return <Panel><AppText accessibilityRole="alert">Couldn't load this account's saved data.</AppText><Button label="Try again" onPress={() => { setError(false); setAttempt(x => x + 1); }} /><Button label="Log out" secondary disabled={account.busy} onPress={() => void account.signOut()} />{account.error && <AppText accessibilityRole="alert">{account.error}</AppText>}</Panel>;
  if (!ready && !authRoute) return <KineLoading fill />;
  return <AccountStorageProvider storage={storage}>
    <ProfileProvider>{children}</ProfileProvider>
  </AccountStorageProvider>;
}
