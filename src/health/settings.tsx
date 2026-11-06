import { View } from "react-native";
import { RowContent, SettingsGroup, SettingsSwitchRow } from "../account/settings-list";
import { AppButton } from "../components/button";
import { InlineMessage } from "../components/inline-message";
import { AppText } from "../components/ui";
import { spacing } from "../theme/tokens";
import { healthStatus } from "./plan";
import { useHealthWrite } from "./provider";
import { PlusTag } from "../plus/locks";
import { usePaywall } from "../plus/paywall";
import { usePlus } from "../plus/provider";

export function HealthSettings() {
  const { unlocked } = usePlus();
  const paywall = usePaywall();
  return (
    <>
      <HealthSettingsGroup
        health={useHealthWrite()}
        locked={!unlocked}
        onSeePlus={() => paywall.open("health")}
      />
      {paywall.sheet}
    </>
  );
}

/**
 * The Save to Apple Health or Health Connect switch, and why nothing is saved when it can't be.
 * Locked, the switch reads off, wears the Plus tag and opens the paywall.
 */
export function HealthSettingsGroup({
  health,
  locked = false,
  onSeePlus,
}: {
  health: ReturnType<typeof useHealthWrite>;
  locked?: boolean;
  onSeePlus?: () => void;
}) {
  // The web preview has no health store.
  if (health.name === null) return null;
  const status = locked ? null : healthStatus({ ...health, name: health.name });
  const action = status?.action;
  return (
    <SettingsGroup title="Health" cardTestID="health-settings">
      <SettingsSwitchRow
        icon="heart"
        title={`Save to ${health.name}`}
        accessibilityLabel={locked ? `Save to ${health.name}, part of Plus` : undefined}
        badge={locked && <PlusTag />}
        description="Completed workouts, body weight and daily water"
        value={!locked && health.enabled === true}
        disabled={!locked && (health.enabled === null || health.busy)}
        onChange={(enabled) => (locked ? onSeePlus?.() : void health.setEnabled(enabled))}
      />
      {(status || (!locked && health.error)) && (
        <RowContent>
          {status && (
            <View style={{ gap: spacing.sm, alignItems: "flex-start" }}>
              <AppText variant="caption" muted accessibilityLiveRegion="polite">
                {status.status}
              </AppText>
              {action && (
                <AppButton
                  size="compact"
                  label={action.label}
                  disabled={health.busy}
                  onPress={() => void health[action.kind]()}
                />
              )}
            </View>
          )}
          <InlineMessage>{health.error}</InlineMessage>
        </RowContent>
      )}
    </SettingsGroup>
  );
}
