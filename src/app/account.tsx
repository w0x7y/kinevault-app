import { router, useLocalSearchParams } from "expo-router";
import { useAccount } from "../account/provider";
import { routeDecision } from "../account/entry-policy";
import { EntryGate } from "../account/entry-gate";
import { useProfile } from "../profile/provider";
import { AccountScreen } from "../onboarding/account-screen";

export default function AccountRoute() {
  const { user, recovery } = useAccount();
  const { state } = useProfile();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const decision = routeDecision("account", { recovery, signedIn: user !== null, profile: state });
  if (decision.kind !== "render") return <EntryGate decision={decision} />;
  return (
    <AccountScreen
      initialMode={mode === "create" ? "create" : "login"}
      onBack={() => router.replace({ pathname: "/onboarding", params: { setupStage: "review" } })}
    />
  );
}
