import { useEffect, useRef, type Ref, type RefObject } from "react";
import { Platform, ScrollView, StyleSheet, View } from "react-native";
import { useTheme } from "../theme/provider";
import { fonts, radius, spacing } from "../theme/tokens";
import { Icon, type IconName } from "./icon";
import { PopoverSurface } from "./popover";
import { AppText } from "./ui";
import { Tappable } from "./tappable";

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
  const upcoming = label !== "Profile";
  return (
    <Tappable
      role="menuitem"
      label={upcoming ? `${label} · Upcoming` : label}
      onPress={onPress}
      disabled={upcoming}
      current={selected ? "page" : undefined}
      feedback="fill"
      style={[styles.entry, selected && { backgroundColor: colors.accent }]}
    >
      <View style={styles.iconColumn}>
        <Icon name={icon} size={19} color={colors.foreground} />
      </View>
      <AppText
        variant="label"
        numberOfLines={1}
        style={{ flex: 1, fontSize: 15, fontFamily: upcoming ? fonts.medium : fonts.semibold }}
      >
        {label}
      </AppText>
      {upcoming && (
        // The entry fades as unavailable, so the badge keeps full-strength text to stay legible.
        <View style={[styles.badge, { backgroundColor: colors.accent }]}>
          <AppText variant="overline" style={styles.badgeText}>
            Upcoming
          </AppText>
        </View>
      )}
    </Tappable>
  );
}

/**
 * The menu under the header's avatar. Arrow keys, Home and End move between the available
 * entries; opening it from the keyboard focuses the first. The header dismisses it.
 */
export function ProfileMenu({
  onSelect,
  maxHeight,
  currentProfile = false,
  trigger,
  ref,
}: {
  onSelect: (destination: ProfileDestination) => void;
  maxHeight: number;
  currentProfile?: boolean;
  /** The button that opened the menu. */
  trigger: RefObject<View | null>;
  ref?: Ref<View>;
}) {
  const { colors } = useTheme();
  const list = useRef<View>(null);
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const opener = trigger.current as unknown as HTMLElement | null;
    const entries = Array.from(
      (list.current as unknown as HTMLElement | null)?.querySelectorAll<HTMLElement>(
        '[role="menuitem"]:not([aria-disabled="true"])',
      ) ?? [],
    );
    if (opener?.matches(":focus-visible")) entries[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      const index = entries.indexOf(document.activeElement as HTMLElement);
      if (index < 0 && document.activeElement !== opener) return;
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
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [trigger]);
  return (
    <PopoverSurface
      ref={ref}
      origin="top right"
      accessibilityRole="menu"
      accessibilityLabel="Profile menu"
      style={[styles.menu, { maxHeight }]}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={{ flexGrow: 0 }}
      >
        <View ref={list} style={{ padding: 6 }}>
          {destinations.map(({ label, icon }, index) => (
            <View key={label}>
              {index === 4 && (
                <View
                  role="separator"
                  style={[styles.divider, { backgroundColor: colors.border }]}
                />
              )}
              <MenuEntry
                label={label}
                icon={icon}
                selected={currentProfile && label === "Profile"}
                onPress={() => onSelect(label)}
              />
            </View>
          ))}
        </View>
      </ScrollView>
    </PopoverSurface>
  );
}

const styles = StyleSheet.create({
  menu: { width: "100%", maxWidth: 272, borderRadius: 20, overflow: "hidden" },
  entry: {
    minHeight: 46,
    paddingLeft: spacing.sm,
    paddingRight: spacing.sm,
    paddingVertical: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: 14,
  },
  iconColumn: { width: 28, alignItems: "center", justifyContent: "center" },
  badge: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  badgeText: { fontSize: 10, lineHeight: 13, letterSpacing: 0.6, textTransform: "none" },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 6,
    marginHorizontal: spacing.md,
  },
});
