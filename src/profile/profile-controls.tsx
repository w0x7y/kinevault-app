import { useState, type PropsWithChildren } from "react";
import { Modal, Platform, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText, Panel } from "../components/ui";
import { FoodButton } from "../food/food-button";
import { useTheme } from "../theme/provider";
import { spacing } from "../theme/tokens";
export type ProfileSection = "Overview" | "Goals" | "Photos";
function ProfileChoice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      aria-pressed={selected}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 44,
        paddingHorizontal: 4,
        paddingVertical: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: focused || selected ? colors.ring : colors.border,
        backgroundColor: selected || pressed ? colors.accent : colors.secondary,
        justifyContent: "center",
      })}
    >
      <AppText
        variant="label"
        style={{ textAlign: "center", color: colors.secondaryForeground }}
      >
        {label}
      </AppText>
    </Pressable>
  );
}
export function ProfileChoices<T extends string | number>({
  label,
  values,
  selected,
  select,
}: {
  label: string;
  values: readonly { value: T; label: string }[];
  selected: T;
  select: (value: T) => void;
}) {
  return (
    <View
      accessibilityLabel={label}
      style={{ flexDirection: "row", gap: spacing.xs }}
    >
      {values.map((option) => (
        <ProfileChoice
          key={option.value}
          label={option.label}
          selected={selected === option.value}
          onPress={() => select(option.value)}
        />
      ))}
    </View>
  );
}
export function ProfileControls({
  section,
  select,
}: {
  section: ProfileSection;
  select: (section: ProfileSection) => void;
}) {
  return (
    <ProfileChoices
      label="Profile sections"
      values={(["Overview", "Goals", "Photos"] as const).map((value) => ({
        value,
        label: value,
      }))}
      selected={section}
      select={select}
    />
  );
}
export function SourceStatus({
  name,
  kind,
  retry,
}: {
  name: string;
  kind: "loading" | "error";
  retry: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <AppText
        accessibilityRole={kind === "error" ? "alert" : undefined}
        accessibilityLiveRegion="polite"
        style={kind === "error" ? { color: colors.error } : undefined}
      >
        {kind === "loading" ? `Loading ${name}…` : `Couldn't load ${name}.`}
      </AppText>
      {kind === "error" && (
        <FoodButton label={`Retry ${name}`} onPress={retry} />
      )}
    </View>
  );
}
export function ProfileDialog({
  title,
  dismiss,
  children,
}: PropsWithChildren<{ title: string; dismiss: () => void }>) {
  return (
    <Modal
      visible
      transparent
      animationType="none"
      accessibilityLabel={title}
      onRequestClose={dismiss}
      onShow={() => {
        if (Platform.OS === "web")
          document
            .getElementById("profile-dialog")
            ?.querySelector<HTMLElement>('input, [role="button"]')
            ?.focus();
      }}
    >
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.45)",
          justifyContent: "center",
          alignItems: "center",
          padding: spacing.layout,
        }}
      >
        <ScrollView
          style={{
            width: "100%",
            maxWidth: 740,
            maxHeight: "100%",
            flexGrow: 0,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <Panel nativeID="profile-dialog" accessibilityViewIsModal>
            <AppText variant="heading" accessibilityRole="header">
              {title}
            </AppText>
            {children}
          </Panel>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
