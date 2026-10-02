import { useEffect, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FoodButton } from "../food/food-button";
import { useTheme } from "../theme/provider";
import { radius, spacing } from "../theme/tokens";
import { Icon, type IconName } from "./icon";
import { AppText, Panel } from "./ui";

const destinations = [
  { label: "Profile", icon: "user" },
  { label: "Friends", icon: "user-group" },
  { label: "Messages", icon: "comment" },
  { label: "KineVault", icon: "clapperboard" },
  { label: "Support", icon: "circle-question" },
  { label: "Feedback", icon: "message" },
] as const satisfies ReadonlyArray<{ label: string; icon: IconName }>;

export type ProfileDestination = typeof destinations[number]["label"];

function MenuEntry({ label, icon, onPress }: { label: ProfileDestination; icon: IconName; onPress: () => void }) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <Pressable accessibilityRole="menuitem" accessibilityLabel={label} onPress={onPress}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={({ pressed }) => [styles.entry, {
        borderColor: focused ? colors.ring : "transparent",
        backgroundColor: pressed || focused ? colors.accent : "transparent",
      }]}>
      <Icon name={icon} size={16} color={colors.mutedForeground} />
      <AppText variant="label" style={{ flexShrink: 1 }}>{label}</AppText>
    </Pressable>
  );
}

export function ProfileMenu({ onSelect, onDismiss, maxHeight }: {
  onSelect: (destination: ProfileDestination) => void;
  onDismiss: () => void;
  maxHeight: number;
}) {
  const { colors } = useTheme();
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const menu = document.getElementById("profile-menu");
    const entries = Array.from(menu?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    entries[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      const index = entries.indexOf(document.activeElement as HTMLElement);
      if (index < 0) return;
      let next: number;
      switch (event.key) {
        case "ArrowDown": next = (index + 1) % entries.length; break;
        case "ArrowUp": next = (index + entries.length - 1) % entries.length; break;
        case "Home": next = 0; break;
        case "End": next = entries.length - 1; break;
        default: return;
      }
      event.preventDefault();
      entries[next]?.focus();
    };
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target as Node;
      if (!menu?.contains(target) && target !== document.getElementById("profile-menu-button")) onDismiss();
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [onDismiss]);
  return (
    <ScrollView nativeID="profile-menu" accessibilityRole="menu" accessibilityLabel="Profile menu"
      keyboardShouldPersistTaps="handled" style={[styles.menu, { maxHeight, backgroundColor: colors.card, borderColor: colors.border }]}
      contentContainerStyle={{ padding: spacing.xs }}>
      {destinations.map(({ label, icon }, index) => (
        <View key={label}>
          {index === 4 && <View role="separator" style={[styles.divider, { backgroundColor: colors.border }]} />}
          <MenuEntry label={label} icon={icon} onPress={() => onSelect(label)} />
        </View>
      ))}
    </ScrollView>
  );
}

export function ComingSoonPanel({ destination, onDismiss }: { destination: ProfileDestination; onDismiss: () => void }) {
  return (
    <Modal visible transparent animationType="none" accessibilityLabel={`${destination} coming soon`} onRequestClose={onDismiss}
      onShow={() => {
        if (Platform.OS === "web") {
          document.getElementById("profile-coming-soon")?.querySelector<HTMLElement>('[aria-label="Dismiss"]')?.focus();
        }
      }}>
      <SafeAreaView style={styles.modal}>
        <View accessible={false} aria-hidden onStartShouldSetResponder={() => true} onResponderRelease={onDismiss}
          style={StyleSheet.absoluteFill} />
        <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
          <Panel nativeID="profile-coming-soon" accessibilityViewIsModal style={styles.panel}>
            <AppText variant="heading" accessibilityRole="header">{destination}</AppText>
            <AppText variant="label">Coming soon</AppText>
            <AppText muted selectable>{destination} isn't available yet. You can keep tracking while we build this area.</AppText>
            <FoodButton label="Dismiss" onPress={onDismiss} />
          </Panel>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  menu: { width: "100%", maxWidth: 260, flexGrow: 0, borderWidth: 1,
    borderTopWidth: 0, borderBottomLeftRadius: radius.control, borderBottomRightRadius: radius.control,
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.12)" },
  entry: { minHeight: 44, paddingHorizontal: spacing.layout, paddingVertical: spacing.sm,
    flexDirection: "row", alignItems: "center", gap: spacing.layout, borderWidth: 2, borderRadius: 10 },
  divider: { height: 1, marginVertical: spacing.xs, marginHorizontal: spacing.layout },
  modal: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.45)", justifyContent: "center", alignItems: "center", padding: spacing.layout },
  modalScroll: { width: "100%", maxWidth: 360, maxHeight: "100%", flexGrow: 0 },
  modalContent: { alignItems: "center" },
  panel: { width: "100%", maxWidth: 360, gap: spacing.layout },
});
