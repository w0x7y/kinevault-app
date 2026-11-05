import { View } from "react-native";
import { RowContent, SettingsGroup, SettingsSwitchRow } from "../account/settings-list";
import { AppButton } from "../components/button";
import { InlineMessage } from "../components/inline-message";
import { AppText } from "../components/ui";
import { spacing } from "../theme/tokens";
import { healthStatus } from "./plan";
import { useHealthWrite } from "./provider";

export function HealthSettings() {
  return <HealthSettingsGroup health={useHealthWrite()} />;
}

/** The Save to Apple Health or Health Connect switch, and why nothing is saved when it can't be. */
export function HealthSettingsGroup({ health }: { health: ReturnType<typeof useHealthWrite> }) {
  // The web preview has no health store.
  if (health.name === null) return null;
  const status = healthStatus({ ...health, name: health.name });
  const action = status?.action;
  return (
    <SettingsGroup title="Health" cardTestID="health-settings">
      <SettingsSwitchRow
        icon="heart"
        title={`Save to ${health.name}`}
        description="Completed workouts, body weight and daily water"
        value={health.enabled === true}
        disabled={health.enabled === null || health.busy}
        onChange={(enabled) => void health.setEnabled(enabled)}
      />
      {(status || health.error) && (
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
