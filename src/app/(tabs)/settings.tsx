import { View } from "react-native";
import { AppText, Screen } from "../../components/ui";
import { SegmentedControl, type SegmentOption } from "../../components/segmented-control";
import { useProfile } from "../../profile/provider";
import { useTheme } from "../../theme/provider";
import type { AppearancePreference } from "../../theme/preferences";
import { spacing } from "../../theme/tokens";
import { WaterGoalSettings } from "../../water/goal-settings";
import { ReminderSettings } from "../../reminders/settings";
import { HealthSettings } from "../../health/settings";
import { AccountSettings } from "../../account/settings-panel";
import { AppButton } from "../../components/button";
import { InlineMessage } from "../../components/inline-message";
import {
  RowContent,
  SettingsButtonRow,
  SettingsGroup,
  SettingsLinkRow,
} from "../../account/settings-list";
import { useStartTour } from "../../tour/app-tour";
import { useUnits } from "../../units/provider";
import type { UnitSystem } from "../../units/units";

const choices: SegmentOption<AppearancePreference>[] = [
  { value: "system", label: "System", icon: "desktop" },
  { value: "light", label: "Light", icon: "sun" },
  { value: "dark", label: "Dark", icon: "moon" },
];
const unitChoices: SegmentOption<UnitSystem>[] = [
  { value: "metric", label: "Metric" },
  { value: "imperial", label: "Imperial" },
];
const unitSummary = { metric: "Metric (kg, cm, km, ml)", imperial: "Imperial (lb, in, mi, fl oz)" };

export default function SettingsScreen() {
  const { state } = useProfile();
  const { units } = useUnits();
  const startTour = useStartTour();
  return (
    <Screen title="Settings" adjustKeyboardInsets>
      <AccountSettings
        importRow={
          <SettingsLinkRow
            href="/exercise?workoutImport=tracked"
            icon="file-import"
            title="Import workouts"
            description="Save a shared Tracked workout to your library"
          />
        }
      >
        {state.kind === "ready" && state.document.kind === "complete" && (
          <SettingsGroup title="Profile">
            <SettingsLinkRow
              href="/onboarding"
              icon="user"
              title="Edit profile"
              description="Goal, body details and daily targets"
            />
          </SettingsGroup>
        )}
        <WaterGoalSettings key={units} />
        <ReminderSettings />
        <HealthSettings />
        <SettingsGroup title="Appearance">
          <AppearanceControl />
        </SettingsGroup>
        <SettingsGroup title="Units">
          <UnitsControl />
        </SettingsGroup>
        <SettingsGroup title="Help">
          <SettingsButtonRow
            icon="compass"
            title="Take the tour"
            description="A quick look at each screen"
            onPress={startTour}
          />
        </SettingsGroup>
      </AccountSettings>
      <AppText variant="caption" muted style={{ textAlign: "center", paddingTop: spacing.sm }}>
        {`English · ${unitSummary[units]} · Version 1.0.0`}
      </AppText>
    </Screen>
  );
}

/** Three segments on a sunken track; one radio group for assistive tech. */
function AppearanceControl() {
  const { preference, setPreference, saving, error, retryLoad } = useTheme();
  return (
    <RowContent>
      <SegmentedControl
        label="Appearance"
        semantics="radio"
        options={choices}
        value={preference}
        disabled={saving}
        onChange={(value) => void setPreference(value)}
      />
      <AppText variant="caption" muted accessibilityLiveRegion="polite">
        {saving ? "Saving…" : "System follows your device's theme. Applies to this device."}
      </AppText>
      {error && (
        <View style={{ gap: spacing.sm, alignItems: "flex-start" }}>
          <InlineMessage>{error}</InlineMessage>
          <AppButton size="compact" label="Try again" icon="rotate-right" onPress={retryLoad} />
        </View>
      )}
    </RowContent>
  );
}

/** Metric or Imperial for every figure and field; saved values stay metric. */
function UnitsControl() {
  const { units, setUnits, saving, error, retryLoad } = useUnits();
  return (
    <RowContent>
      <SegmentedControl
        label="Units"
        semantics="radio"
        options={unitChoices}
        value={units}
        disabled={saving}
        onChange={(value) => void setUnits(value)}
      />
      <AppText variant="caption" muted accessibilityLiveRegion="polite">
        {saving
          ? "Saving…"
          : "Imperial shows pounds, ounces, feet and inches, miles and fluid ounces. Nutrients stay in grams. Applies to this device."}
      </AppText>
      {error && (
        <View style={{ gap: spacing.sm, alignItems: "flex-start" }}>
          <InlineMessage>{error}</InlineMessage>
          <AppButton size="compact" label="Try again" icon="rotate-right" onPress={retryLoad} />
        </View>
      )}
    </RowContent>
  );
}
