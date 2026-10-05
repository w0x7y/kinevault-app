import { useEffect, useState, useSyncExternalStore } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { AppText, Panel } from "../components/ui";
import { Button } from "../onboarding/controls";
import { spacing } from "../theme/tokens";
import { useAccount } from "./provider";
import { useAccountStorage } from "./storage-context";
import { readMembership, type Membership } from "./membership";

const documentNames: Record<string, string> = {
  "kinevault-track.profile.v1": "Profile and goals",
  "kinevault-track.exercise.v1": "Exercises and workout history",
  "kinevault-track.food-log.v1": "Food log",
  "kinevault-track.custom-foods.v1": "Saved foods and meals",
  "kinevault-track.water-log.v1": "Water log",
  "kinevault-track.water-goal.v1": "Water goal",
};

export function AccountSettingsPanel() {
  const account = useAccount();
  const storage = useAccountStorage();
  const sync = useSyncExternalStore(storage.subscribe, storage.getSnapshot, storage.getSnapshot);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [membershipError, setMembershipError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const userId = account.user?.id;
  useEffect(() => {
    if (!userId) return;
    let active = true;
    setMembershipError(false);
    readMembership(userId).then(value => { if (active) setMembership(value); }).catch(() => { if (active) setMembershipError(true); });
    return () => { active = false; };
  }, [userId, attempt]);

  async function update(action: () => Promise<boolean>) {
    if (working) return;
    setWorking(true);
    setActionError(null);
    try {
      await action();
    } catch { setActionError("Couldn't update cloud storage. Try again."); }
    finally { setWorking(false); }
  }

  return <Panel>
    <AppText variant="heading" accessibilityRole="header">Your account</AppText>
    <AppText>{account.user?.email}</AppText>
    <View style={{ gap: spacing.sm }}>
      <AppText variant="label">Membership</AppText>
      {membership ? <AppText muted>{membership.plan[0].toUpperCase() + membership.plan.slice(1)} · {membership.status.replaceAll("_", " ")}</AppText>
        : <AppText muted>{membershipError ? "Couldn't load membership." : "Loading membership…"}</AppText>}
      {membershipError && <Button label="Retry membership" secondary onPress={() => setAttempt(x => x + 1)} />}
    </View>
    <View style={{ gap: spacing.sm }}>
      <AppText variant="label">Cloud storage</AppText>
      <AppText muted accessibilityLiveRegion="polite">{sync.state === "idle" ? "All changes saved to your account." : sync.state === "syncing" ? "Syncing…" : sync.state === "pending" ? "Changes saved on this device. Waiting to sync." : sync.state === "conflict" ? "Another device changed your data. Choose the copy to keep below." : sync.error}</AppText>
      <AppText variant="caption" muted>Goals, exercises, workout history, food and water logs sync across devices. Photos stay on this device.</AppText>
      <Button label={working ? "Please wait…" : "Sync now"} secondary disabled={working || sync.state === "syncing"} onPress={() => void update(() => storage.retry())} />
      {sync.conflicts.map(key => <View key={key} style={{ gap: spacing.sm }}>
        <AppText variant="label">{documentNames[key] ?? "Tracking data"}</AppText>
        <AppText variant="caption" muted>Keeping this device replaces the cloud copy for this category. Keeping cloud replaces this device's copy.</AppText>
        <Button label="Keep this device" secondary disabled={working} onPress={() => void update(() => storage.resolveConflict(key, "local"))} />
        <Button label="Keep cloud copy" secondary disabled={working} onPress={() => void update(() => storage.resolveConflict(key, "cloud"))} />
      </View>)}
      {actionError && <AppText accessibilityRole="alert">{actionError}</AppText>}
    </View>
    {account.error && <AppText accessibilityRole="alert">{account.error}</AppText>}
    <Button label={account.busy ? "Signing out…" : "Log out"} secondary disabled={account.busy || working} onPress={() => { void account.signOut().then(success => { if (success) router.replace("/account"); }); }} />
    {sync.state !== "idle" && <AppText variant="caption" muted>Pending changes stay on this device for the next time you log in to this account.</AppText>}
  </Panel>;
}
