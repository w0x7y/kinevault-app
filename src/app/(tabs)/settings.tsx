import { Check, Monitor, Moon, Sun, UserRound } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { useState } from "react";
import { AppText, Destination, Panel, Screen } from "../../components/ui";
import { ProfileReview } from "../../onboarding/profile-review";
import { useProfile } from "../../profile/provider";
import { useTheme } from "../../theme/provider";
import type { AppearancePreference } from "../../theme/preferences";
import { radius } from "../../theme/tokens";

const choices: {
  value: AppearancePreference;
  label: string;
  icon: typeof Sun;
}[] = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

export default function SettingsScreen() {
  const { colors, preference, setPreference, saving, error, retryLoad } =
    useTheme();
  const [focused, setFocused] = useState<AppearancePreference | null>(null);
  const { state } = useProfile();
  return (
    <Screen title="Settings">
      {state.kind === "ready" && state.document.kind === "complete" && (
        <>
          <Panel>
            <AppText variant="heading" accessibilityRole="header">
              Your profile
            </AppText>
            <ProfileReview answers={state.document.answers} />
          </Panel>
          <Destination
            href="/onboarding"
            title="Edit profile"
            icon={UserRound}
          />
        </>
      )}
      <Panel>
        <AppText variant="heading" accessibilityRole="header">
          Appearance
        </AppText>
        <AppText muted>System follows your device's theme.</AppText>
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel="Appearance"
          style={{ gap: 8 }}
        >
          {choices.map(({ value, label, icon: Icon }) => {
            const selected = value === preference;
            return (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityLabel={label}
                aria-checked={selected}
                aria-disabled={saving}
                accessibilityState={{ checked: selected, disabled: saving }}
                disabled={saving}
                onPress={() => void setPreference(value)}
                onFocus={() => setFocused(value)}
                onBlur={() => setFocused(null)}
                style={({ pressed }) => ({
                  minHeight: 52,
                  padding: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  borderRadius: radius.control,
                  borderWidth: focused === value ? 2 : 1,
                  borderColor:
                    focused === value
                      ? colors.ring
                      : selected
                        ? colors.primary
                        : colors.border,
                  backgroundColor:
                    selected || pressed ? colors.accent : colors.card,
                  opacity: saving ? 0.6 : 1,
                })}
              >
                <Icon
                  size={20}
                  color={selected ? colors.primary : colors.mutedForeground}
                  aria-hidden={true}
                />
                <AppText variant="label" style={{ flex: 1 }}>
                  {label}
                </AppText>
                {selected && (
                  <Check size={18} color={colors.primary} aria-hidden={true} />
                )}
              </Pressable>
            );
          })}
        </View>
        <AppText variant="caption" muted accessibilityLiveRegion="polite">
          {saving ? "Saving…" : "Applies to this device."}
        </AppText>
        {error && (
          <View style={{ gap: 8 }}>
            <AppText accessibilityRole="alert" style={{ color: colors.error }}>
              {error}
            </AppText>
            <Pressable
              accessibilityRole="button"
              onPress={retryLoad}
              style={{ minHeight: 48, justifyContent: "center" }}
            >
              <AppText variant="label" style={{ color: colors.primary }}>
                Try again
              </AppText>
            </Pressable>
          </View>
        )}
      </Panel>
      <Panel>
        <AppText variant="heading" accessibilityRole="header">
          Preferences
        </AppText>
        <View style={{ gap: 16 }}>
          <View style={{ gap: 4 }}>
            <AppText variant="label">Language</AppText>
            <AppText muted>English</AppText>
          </View>
          <View style={{ gap: 4 }}>
            <AppText variant="label">Units</AppText>
            <AppText muted>Metric · kg, cm, km</AppText>
          </View>
        </View>
      </Panel>
      <AppText variant="caption" muted>
        Version 1.0.0
      </AppText>
    </Screen>
  );
}
