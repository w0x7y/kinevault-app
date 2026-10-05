import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useAccount } from "../account/provider";
import { useProfile } from "../profile/provider";
import { ProfileRecovery } from "../profile/recovery";
import { KineLoading } from "../components/kine-loading";
import { AccountScreen } from "../onboarding/account-screen";

export default function AccountRoute() {
  const { user, recovery } = useAccount();
  const { state } = useProfile();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  if (recovery) return <Redirect href="/auth/reset-password" />;
  if (user && state.kind === "loading") return <KineLoading fill />;
  if (user && state.kind === "error") return <ProfileRecovery />;
  if (user && state.kind === "ready") return <Redirect href={state.document.kind === "complete" ? "/(tabs)" : "/onboarding"} />;
  return <AccountScreen initialMode={mode === "create" ? "create" : "login"} onBack={() => router.replace({ pathname: "/onboarding", params: { setupStage: "review" } })} />;
}
