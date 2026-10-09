import { useEffect, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useTheme } from "../theme/provider";
import { radius, spacing } from "../theme/tokens";
import { Icon, type IconName } from "./icon";
import { AppText } from "./ui";

const destinations = [
  { label: "Profile", icon: "user" },
  { label: "Friends", icon: "user-group" },
  { label: "Messages", icon: "comment" },
  { label: "KineVault", icon: "clapperboard" },
  { label: "Support", icon: "circle-question" },
  { label: "Feedback", icon: "message" },
] as const satisfies readonly { label: string; icon: IconName }[];

export type ProfileDestination = (typeof destinations)[number]["label"];

function MenuEntry({
  label,
  icon,
  onPress,
  selected,
}: {
  label: ProfileDestination;
  icon: IconName;
  onPress: () => void;
  selected: boolean;
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const upcoming = label !== "Profile";
  return (
    <Pressable
      accessibilityRole="menuitem"
      accessibilityLabel={upcoming ? `${label} · Upcoming` : label}
      onPress={onPress}
      disabled={upcoming}
      accessibilityState={{ disabled: upcoming }}
      aria-disabled={upcoming}
      aria-current={selected ? "page" : undefined}
      onFocus={() =>
        setFocused(
          Platform.OS !== "web" || document.activeElement?.matches(":focus-visible") === true,
        )
      }
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        styles.entry,
        {
          borderColor: focused ? colors.ring : "transparent",
          backgroundColor: pressed || selected ? colors.accent : "transparent",
        },
      ]}
    >
      <Icon name={icon} size={16} color={colors.mutedForeground} />
      <AppText variant="label" muted={upcoming} style={{ flex: 1 }}>
        {label}
      </AppText>
      {upcoming && (
        <AppText variant="caption" muted>
          Upcoming
        </AppText>
      )}
    </Pressable>
  );
}

export function ProfileMenu({
  onSelect,
  onDismiss,
  maxHeight,
  currentProfile = false,
}: {
  onSelect: (destination: ProfileDestination) => void;
  onDismiss: () => void;
  maxHeight: number;
  currentProfile?: boolean;
}) {
  const { colors } = useTheme();
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const menu = document.getElementById("profile-menu");
    const entries = Array.from(
      menu?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? [],
    );
    const trigger = document.getElementById("profile-menu-button");
    if (trigger?.matches(":focus-visible")) entries[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      const index = entries.indexOf(document.activeElement as HTMLElement);
      if (index < 0 && document.activeElement !== trigger) return;
      let next: number;
      switch (event.key) {
        case "ArrowDown":
          next = (index + 1) % entries.length;
          break;
        case "ArrowUp":
          next = index < 0 ? entries.length - 1 : (index + entries.length - 1) % entries.length;
          break;
        case "Home":
          next = 0;
          break;
        case "End":
          next = entries.length - 1;
          break;
        default:
          return;
      }
      event.preventDefault();
      entries[next]?.focus();
    };
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target as Node;
      if (!menu?.contains(target) && target !== document.getElementById("profile-menu-button"))
        onDismiss();
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [onDismiss]);
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      nativeID="profile-menu"
      accessibilityRole="menu"
      accessibilityLabel="Profile menu"
      keyboardShouldPersistTaps="handled"
      style={[styles.menu, { maxHeight, backgroundColor: colors.card, borderColor: colors.border }]}
      contentContainerStyle={{ padding: spacing.xs }}
    >
      {destinations.map(({ label, icon }, index) => (
        <View key={label}>
          {index === 4 && (
            <View role="separator" style={[styles.divider, { backgroundColor: colors.border }]} />
          )}
          <MenuEntry
            label={label}
            icon={icon}
            selected={currentProfile && label === "Profile"}
            onPress={() => onSelect(label)}
          />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  menu: {
    width: "100%",
    maxWidth: 260,
    flexGrow: 0,
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomLeftRadius: radius.control,
    borderBottomRightRadius: radius.control,
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.12)",
  },
  entry: {
    minHeight: 44,
    paddingHorizontal: spacing.layout,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.layout,
    borderWidth: 2,
    borderRadius: 10,
  },
  divider: { height: 1, marginVertical: spacing.xs, marginHorizontal: spacing.layout },
});
