import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import { useLayoutMotion } from "../components/motion";
import { router } from "expo-router";
import { AppButton, ButtonRow } from "../components/button";
import { Icon } from "../components/icon";
import { AppText } from "../components/ui";
import { InlineMessage } from "../components/inline-message";
import { LoadFailure } from "../components/load-failure";
import { TextField } from "../components/text-field";
import { ProfileAvatar } from "../profile/profile-identity";
import { useTheme } from "../theme/provider";
import { fonts, radius, spacing } from "../theme/tokens";
import { RowContent, SettingsButtonRow, SettingsCard, SettingsGroup } from "./settings-list";
import { useAccount } from "./provider";
import { useAccountStorage } from "./storage-context";
import { readMembership, type Membership } from "./membership";
import { useConnectivity } from "../connectivity/provider";
import { useAccountManagementAttempts } from "./use-management-attempts";
import { accountTrackingDocument } from "./tracking-documents";
import { recentGoogleSignIn } from "./management";

/** Routine settings render between the account summary and the account's data, sign-out and
 * deletion actions, which sit last and apart. `importRow` joins the data group's rows. */
export function AccountSettings({
  children,
  importRow,
}: {
  children?: ReactNode;
  importRow?: ReactNode;
}) {
  const { colors, appearance } = useTheme();
  // Feedback and the deletion form fade in where they appear instead of popping into place.
  const { fade } = useLayoutMotion();
  const offline = useConnectivity() === "offline";
  const account = useAccount();
  const storage = useAccountStorage();
  const sync = useSyncExternalStore(storage.subscribe, storage.getSnapshot, storage.getSnapshot);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [membershipError, setMembershipError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const {
    working,
    error: actionError,
    notice: managementNotice,
    deletion,
    attempts,
    proof,
  } = useAccountManagementAttempts({ account, storage, offline });
  const googleConfirmed = proof === "google" && recentGoogleSignIn(account.session?.access_token);
  const userId = account.user?.id;
  useEffect(() => {
    if (!userId) return;
    let active = true;
    setMembershipError(false);
    readMembership(userId)
      .then((value) => {
        if (active) setMembership(value);
      })
      .catch(() => {
        if (active) setMembershipError(true);
      });
    return () => {
      active = false;
    };
  }, [userId, attempt]);

  const syncText = offline
    ? "Offline. Changes stay on this device and sync when you reconnect."
    : sync.state === "idle"
      ? "All changes saved to your account."
      : sync.state === "syncing"
        ? "Syncing…"
        : sync.state === "pending"
          ? "Changes saved on this device. Waiting to sync."
          : sync.state === "conflict"
            ? "Another device changed your data. Choose the copy to keep below."
            : sync.error;
  const syncDot = offline
    ? colors.carbs
    : sync.state === "idle"
      ? colors.success
      : sync.state === "syncing"
        ? colors.brand
        : sync.state === "pending"
          ? colors.carbs
          : colors.danger;

  return (
    <>
      <SettingsGroup title="Your account" fullDividers>
        <RowContent style={{ flexDirection: "row", alignItems: "center", gap: spacing.layout }}>
          <ProfileAvatar size={56} />
          <View style={{ flex: 1, minWidth: 0, gap: spacing.xs + 2 }}>
            <AppText
              variant="label"
              numberOfLines={2}
              style={{ fontSize: 16, lineHeight: 22, fontFamily: fonts.bold }}
            >
              {account.user?.email}
            </AppText>
            {membership ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <View
                  style={{
                    paddingHorizontal: spacing.sm + 2,
                    paddingVertical: 3,
                    borderRadius: radius.pill,
                    backgroundColor: colors.brandSoft,
                  }}
                >
                  <AppText
                    variant="caption"
                    style={{
                      color: colors.brand,
                      fontFamily: fonts.bold,
                      fontSize: 12,
                      lineHeight: 16,
                    }}
                  >
                    {membership.plan[0].toUpperCase() + membership.plan.slice(1)}
                  </AppText>
                </View>
                {membership.status !== "active" && (
                  <AppText variant="caption" muted>
                    {membership.status.replaceAll("_", " ")}
                  </AppText>
                )}
              </View>
            ) : (
              !membershipError && (
                <AppText variant="caption" muted>
                  Loading membership…
                </AppText>
              )
            )}
          </View>
        </RowContent>
        {membershipError && (
          <RowContent>
            <LoadFailure
              message="Couldn't load membership."
              retryLabel="Retry membership"
              onRetry={() => setAttempt((x) => x + 1)}
            />
          </RowContent>
        )}
        <RowContent>
          <View style={{ gap: spacing.xs }}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.sm }}>
              <View
                style={{
                  width: 8,
                  height: 8,
                  marginTop: 6,
                  borderRadius: 4,
                  backgroundColor: syncDot,
                }}
              />
              <AppText
                variant="label"
                accessibilityLiveRegion="polite"
                style={{ flex: 1, fontFamily: fonts.semibold }}
              >
                {syncText}
              </AppText>
            </View>
            <AppText variant="caption" muted style={{ paddingLeft: 16 }}>
              Goals and logs sync across devices. Photos stay on this device.
            </AppText>
          </View>
          <View style={{ flexDirection: "row", paddingLeft: 16 - 2 }}>
            <AppButton
              size="compact"
              label={working ? "Please wait…" : "Sync now"}
              icon="rotate"
              disabled={offline || working || sync.state === "syncing"}
              onPress={() => void attempts.retrySync()}
            />
          </View>
          {sync.conflicts.map((key) => (
            <View
              key={key}
              style={{
                gap: spacing.sm,
                padding: spacing.md + 2,
                borderRadius: radius.control,
                backgroundColor: colors.muted,
              }}
            >
              <AppText variant="label">
                {accountTrackingDocument(key)?.name ?? "Tracking data"}
              </AppText>
              <AppText variant="caption" muted>
                Keeping this device replaces the cloud copy for this category. Keeping cloud
                replaces this device's copy.
              </AppText>
              <ButtonRow>
                <AppButton
                  label="Keep this device"
                  fill
                  disabled={working}
                  onPress={() => void attempts.resolveConflict(key, "local")}
                />
                <AppButton
                  label="Keep cloud copy"
                  fill
                  disabled={working}
                  onPress={() => void attempts.resolveConflict(key, "cloud")}
                />
              </ButtonRow>
            </View>
          ))}
          <InlineMessage>{actionError}</InlineMessage>
          <InlineMessage>{account.error}</InlineMessage>
        </RowContent>
      </SettingsGroup>
      {children}
      <SettingsGroup
        title="Data & account"
        testID="account-management"
        after={
          deletion.kind === "closed" ? (
            <AppButton
              icon="user-xmark"
              label="Delete account"
              tone="danger"
              disabled={working || account.busy}
              onPress={attempts.openDeletion}
            />
          ) : (
            <Animated.View entering={fade}>
              <SettingsCard>
                <RowContent style={{ gap: spacing.layout }}>
                  <AppText variant="heading">Permanently delete your KineVault account</AppText>
                  <View
                    style={{
                      flexDirection: "row",
                      gap: spacing.md,
                      padding: spacing.md + 2,
                      borderRadius: radius.control,
                      backgroundColor:
                        appearance === "dark"
                          ? "rgba(240, 138, 128, 0.10)"
                          : "rgba(180, 35, 24, 0.06)",
                      borderWidth: 1,
                      borderColor:
                        appearance === "dark"
                          ? "rgba(240, 138, 128, 0.22)"
                          : "rgba(180, 35, 24, 0.16)",
                    }}
                  >
                    <Icon
                      name="triangle-exclamation"
                      size={18}
                      color={colors.danger}
                      style={{ marginTop: 1 }}
                    />
                    <AppText variant="caption" style={{ flex: 1, lineHeight: 19 }}>
                      This deletes your shared KineVault login and its account data across KineVault
                      apps, including Track history and membership. It cannot be undone. Export your
                      data first. Photos on other devices must be removed on those devices.
                    </AppText>
                  </View>
                  {proof === "password" ? (
                    <TextField
                      size="large"
                      label="Current password"
                      value={deletion.password}
                      onChange={attempts.setPassword}
                      kind="password"
                      disabled={working}
                    />
                  ) : (
                    <View style={{ gap: spacing.sm }}>
                      <AppText variant="caption" muted>
                        {googleConfirmed
                          ? "Google sign-in confirmed. Delete within 10 minutes of signing in."
                          : "Your account uses Google sign-in. Sign in with Google again to confirm it's you, then delete within 10 minutes."}
                      </AppText>
                      {!googleConfirmed && (
                        <AppButton
                          label="Sign in with Google again"
                          icon="google"
                          disabled={offline || working || account.busy}
                          onPress={() => void account.signInWithGoogle()}
                        />
                      )}
                    </View>
                  )}
                  <TextField
                    size="large"
                    label="Type DELETE to confirm"
                    value={deletion.confirmation}
                    onChange={attempts.setConfirmation}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    disabled={working}
                    maxLength={6}
                  />
                  {offline && (
                    <AppText variant="caption" muted>
                      Reconnect to delete your account.
                    </AppText>
                  )}
                  <View style={{ gap: spacing.sm }}>
                    <AppButton
                      label={working ? "Deleting account…" : "Permanently delete my account"}
                      tone="destructive"
                      disabled={
                        offline ||
                        working ||
                        account.busy ||
                        deletion.confirmation !== "DELETE" ||
                        (proof === "password" ? !deletion.password : !googleConfirmed)
                      }
                      onPress={() => void attempts.deleteData()}
                    />
                    <AppButton
                      label="Cancel deletion"
                      disabled={working || account.busy}
                      onPress={attempts.cancelDeletion}
                    />
                  </View>
                </RowContent>
              </SettingsCard>
            </Animated.View>
          )
        }
      >
        <SettingsButtonRow
          icon="file-export"
          title={offline ? "Export device copy" : "Export account data"}
          description="Records, pending changes and photos as a JSON file"
          disabled={working || account.busy}
          onPress={() => void attempts.exportData()}
        />
        {managementNotice && (
          <RowContent style={{ paddingVertical: spacing.md }}>
            <InlineMessage tone="success">{managementNotice}</InlineMessage>
          </RowContent>
        )}
        {importRow}
        <SettingsButtonRow
          icon="right-from-bracket"
          title={account.busy ? "Signing out…" : "Log out"}
          description={
            sync.state !== "idle"
              ? "Pending changes stay on this device for the next time you log in to this account."
              : undefined
          }
          disabled={account.busy || working}
          onPress={() => {
            void account.signOut().then((success) => {
              if (success) router.replace("/account");
            });
          }}
        />
      </SettingsGroup>
    </>
  );
}
