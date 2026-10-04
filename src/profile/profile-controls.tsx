import { type PropsWithChildren } from "react";
import { Modal, Platform, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText, Panel } from "../components/ui";
import { FoodButton } from "../food/food-button";
import { useTheme } from "../theme/provider";
import { spacing } from "../theme/tokens";
import { JournalText } from "./journal-ui";
export type ProfileSection = "Overview" | "Goals" | "Photos";
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
  const { colors } = useTheme();
  return (
    <View
      accessibilityLabel={label}
      style={{
        flexDirection: "row",
        gap: 3,
        padding: 3,
        backgroundColor: colors.secondary,
        borderRadius: 10,
      }}
    >
      {values.map((option) => (
        <Pressable
          key={option.value}
          accessibilityRole="button"
          accessibilityLabel={option.label}
          accessibilityState={{ selected: selected === option.value }}
          aria-pressed={selected === option.value}
          onPress={() => select(option.value)}
          style={{
            flex: option.value === "weight" ? 1.5 : 1,
            minHeight: 44,
            marginVertical: -4,
            justifyContent: "center",
          }}
        >
          <View
            style={{
              height: 36,
              borderRadius: 7,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor:
                selected === option.value ? colors.card : "transparent",
            }}
          >
            <JournalText
              size={10}
              style={{
                color:
                  selected === option.value
                    ? colors.primary
                    : colors.mutedForeground,
              }}
            >
              {option.label}
            </JournalText>
          </View>
        </Pressable>
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
  const { colors } = useTheme();
  return (
    <View
      accessibilityLabel="Profile sections"
      style={{
        flexDirection: "row",
        borderBottomWidth: 1,
        borderColor: colors.border,
        marginHorizontal: -12,
        paddingHorizontal: 12,
        marginBottom: 14,
      }}
    >
      {(["Overview", "Goals", "Photos"] as const).map((name) => (
        <Pressable
          key={name}
          accessibilityRole="button"
          accessibilityLabel={name}
          accessibilityState={{ selected: section === name }}
          aria-pressed={section === name}
          onPress={() => select(name)}
          style={{
            flex: 1,
            minHeight: 44,
            justifyContent: "center",
            alignItems: "center",
            borderBottomWidth: 2,
            borderBottomColor:
              section === name ? colors.primary : "transparent",
          }}
        >
          <JournalText
            size={11}
            style={{
              color: section === name ? colors.primary : colors.mutedForeground,
            }}
          >
            {name}
          </JournalText>
        </Pressable>
      ))}
    </View>
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
