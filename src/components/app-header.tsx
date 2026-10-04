import { useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import { usePathname, useRouter, type Href } from "expo-router";
import { BackHandler, Platform, Pressable, StyleSheet, useWindowDimensions, View, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { addDays, calendarWeeks, parseDay } from "../calendar/dates";
import { useSelectedDay } from "../calendar/provider";
import { useTheme } from "../theme/provider";
import { spacing } from "../theme/tokens";
import { Icon } from "./icon";
import { AppText } from "./ui";
import { ProfileAvatar } from "../profile/profile-identity";
import { ComingSoonPanel, ProfileMenu, type ProfileDestination } from "./profile-menu";

function fullDate(day: string): string {
  return parseDay(day).toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

function HeaderButton({
  children, label, onPress, selected, expanded, current, style, nativeID,
}: PropsWithChildren<{
  label: string;
  onPress: () => void;
  selected?: boolean;
  expanded?: boolean;
  current?: boolean;
  style?: ViewStyle;
  nativeID?: string;
}>) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      nativeID={nativeID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, expanded }}
      aria-pressed={selected}
      aria-current={current ? "date" : undefined}
      aria-expanded={expanded}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: pressed ? colors.accent : "transparent" },
        style,
        focused && { borderColor: colors.ring },
      ]}
    >
      {children}
    </Pressable>
  );
}

function DayCalendar() {
  const { colors } = useTheme();
  const { selectedDay, selectDay, today } = useSelectedDay();
  const weeks = useMemo(() => calendarWeeks(today), [today]);
  const start = weeks[0]![0]!;
  const end = weeks[4]![6]!;
  const shortDate = (day: string) => parseDay(day).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });
  const weekdays = weeks[2]!.map((day) => ({
    key: day,
    label: parseDay(day).toLocaleDateString(undefined, { weekday: "short" }),
  }));
  return (
    <View style={styles.calendar}>
      <View style={styles.calendarToolbar}>
        <HeaderButton label="Select previous day" onPress={() => selectDay(addDays(selectedDay, -1))}>
          <Icon name="chevron-left" size={16} color={colors.foreground} />
        </HeaderButton>
        <HeaderButton label="Select today" onPress={() => selectDay(today)} style={styles.todayButton}>
          <AppText variant="label">Today</AppText>
        </HeaderButton>
        <HeaderButton label="Select next day" onPress={() => selectDay(addDays(selectedDay, 1))}>
          <Icon name="chevron-right" size={16} color={colors.foreground} />
        </HeaderButton>
      </View>
      <AppText variant="caption" muted style={styles.range}>
        {shortDate(start)} – {shortDate(end)}
      </AppText>
      <View style={styles.week}>
        {weekdays.map(({ key, label }) => (
          <View key={key} style={styles.daySlot}>
            <AppText variant="caption" muted style={styles.weekday}>{label}</AppText>
          </View>
        ))}
      </View>
      {weeks.map((week, row) => (
        <View key={week[0]} style={[styles.week, row === 2 && { backgroundColor: colors.accent, borderRadius: 10 }]}>
          {week.map((day) => {
            const date = parseDay(day);
            const isToday = day === today;
            const selected = day === selectedDay;
            const monthBoundary = date.getDate() === 1 || day === start;
            return (
              <View key={day} style={styles.daySlot}>
                <HeaderButton
                  label={`${fullDate(day)}${isToday ? ", today" : ""}`}
                  onPress={() => selectDay(day)}
                  selected={selected}
                  current={isToday}
                  style={{
                    width: "100%",
                    backgroundColor: selected ? colors.primary : "transparent",
                    borderColor: isToday ? colors.primary : "transparent",
                  }}
                >
                  <AppText variant="label" style={{ color: selected ? colors.primaryForeground : colors.foreground }}>
                    {date.getDate()}
                  </AppText>
                  {monthBoundary && (
                    <AppText style={[styles.month, { color: selected ? colors.primaryForeground : colors.mutedForeground }]}>
                      {date.toLocaleDateString(undefined, { month: "short" })}
                    </AppText>
                  )}
                  {isToday && <View style={[styles.todayDot, { backgroundColor: selected ? colors.primaryForeground : colors.primary }]} />}
                </HeaderButton>
              </View>
            );
          })}
        </View>
      ))}
      <AppText variant="caption" muted style={styles.range}>
        Current week stays in the middle
      </AppText>
    </View>
  );
}

export function AppHeader({ onHeightChange }: { onHeightChange: (height: number) => void }) {
  const { colors } = useTheme();
  const { selectedDay, today } = useSelectedDay();
  const path = usePathname();
  const isSettings = path === "/settings";
  const isProfile = path === "/profile";
  const router = useRouter();
  const previousTab = useRef<Href>("/");
  useEffect(() => { if (!isProfile && ["/", "/food", "/exercise", "/settings"].includes(path)) previousTab.current = path as Href; }, [path, isProfile]);
  const returnFromProfile = useCallback(() => router.replace(previousTab.current), [router]);
  const { height: windowHeight } = useWindowDimensions();
  const [popover, setPopover] = useState<"calendar" | "profile" | null>(null);
  const [destination, setDestination] = useState<ProfileDestination | null>(null);
  const expanded = popover === "calendar";
  const [headerHeight, setHeaderHeight] = useState(0);
  const closePopover = useCallback(() => setPopover(null), []);
  const focusProfile = useCallback(() => {
    if (Platform.OS === "web") document.getElementById("profile-menu-button")?.focus();
  }, []);
  const hadDestination = useRef(false);
  useEffect(() => {
    if (hadDestination.current && !destination) focusProfile();
    hadDestination.current = destination !== null;
  }, [destination, focusProfile]);
  const dismissDestination = useCallback(() => {
    setDestination(null);
  }, []);
  useEffect(() => {
    setPopover(previous => previous === "profile" || isProfile ? null : previous);
    setDestination(null);
  }, [path, isProfile]);
  useEffect(() => {
    // The dropdown and native Modal dismiss themselves before leaving Profile.
    if (!isProfile || popover || destination) return;
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      returnFromProfile();
      return true;
    });
    return () => back.remove();
  }, [isProfile, popover, destination, returnFromProfile]);
  useEffect(() => {
    if (!popover) return;
    const close = () => {
      setPopover(null);
      if (popover === "profile") focusProfile();
      return true;
    };
    const back = BackHandler.addEventListener("hardwareBackPress", close);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); close(); }
    };
    if (Platform.OS === "web") document.addEventListener("keydown", onKeyDown);
    return () => {
      back.remove();
      if (Platform.OS === "web") document.removeEventListener("keydown", onKeyDown);
    };
  }, [popover, focusProfile]);
  const dateLabel = parseDay(selectedDay).toLocaleDateString(undefined, {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      {popover === "profile" && <Pressable
        testID="header-popover-backdrop"
        accessible={false}
        importantForAccessibility="no"
        tabIndex={-1}
        aria-hidden
        onPress={closePopover}
        style={[StyleSheet.absoluteFill, { top: headerHeight }]}
      />}
      <SafeAreaView
        edges={["top", "left", "right"]}
        style={{ backgroundColor: colors.card }}
        onStartShouldSetResponder={() => popover === "profile"}
        onResponderRelease={() => setPopover(previous => previous === "profile" ? null : previous)}
        onLayout={({ nativeEvent }) => {
          const height = nativeEvent.layout.height;
          setHeaderHeight(height);
          onHeightChange(height);
        }}
      >
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View style={styles.bar}>
            {isProfile ? <HeaderButton label="Back from Profile" onPress={returnFromProfile}><Icon name="chevron-left" size={16} color={colors.foreground} /></HeaderButton> : isSettings ? <View style={styles.button} /> : (
              <HeaderButton
                label={expanded ? "Collapse calendar" : "Expand calendar"}
                expanded={expanded}
                onPress={() => setPopover(previous => previous === "calendar" ? null : "calendar")}
              >
                <Icon name={expanded ? "chevron-up" : "chevron-down"} size={16} color={colors.foreground} />
              </HeaderButton>
            )}
            <AppText
              variant="label"
              accessibilityLabel={isProfile ? "Profile" : isSettings ? "Settings" : `${fullDate(selectedDay)}${selectedDay === today ? ", today" : ""}`}
              numberOfLines={1}
              style={styles.selectedDate}
            >
              {isProfile ? "Profile" : isSettings ? "Settings" : dateLabel}
            </AppText>
            <HeaderButton
              nativeID="profile-menu-button"
              label="Profile menu"
              expanded={popover === "profile"}
              onPress={() => setPopover(previous => previous === "profile" ? null : "profile")}
            >
              <ProfileAvatar />
            </HeaderButton>
          </View>
        </View>
      </SafeAreaView>
      {!isProfile && !isSettings && expanded && (
        <SafeAreaView
          edges={["left", "right"]}
          style={[styles.calendarOverlay, { top: headerHeight, backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <DayCalendar />
        </SafeAreaView>
      )}
      {popover === "profile" && (
        <SafeAreaView edges={["left", "right"]} pointerEvents="box-none"
          style={[styles.profileAnchor, { top: headerHeight }]}>
          <ProfileMenu maxHeight={Math.max(0, windowHeight - headerHeight)}
            onDismiss={closePopover} onSelect={entry => { setPopover(null); if (entry === "Profile") router.navigate("/profile"); else setDestination(entry); }} />
        </SafeAreaView>
      )}
      {destination && <ComingSoonPanel destination={destination} onDismiss={dismissDestination} />}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 1 },
  calendarOverlay: { position: "absolute", width: "100%", maxWidth: 600, alignSelf: "center", borderBottomWidth: 1, borderBottomLeftRadius: 14, borderBottomRightRadius: 14, boxShadow: "0 4px 12px rgba(0, 0, 0, 0.12)" },
  profileAnchor: { position: "absolute", width: "100%", maxWidth: 768, alignSelf: "center", alignItems: "flex-end", paddingHorizontal: spacing.layout },
  header: { borderBottomWidth: 1 },
  bar: { minHeight: 50, flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.layout, gap: spacing.layout, width: "100%", maxWidth: 768, alignSelf: "center" },
  button: { minWidth: 44, minHeight: 44, borderRadius: 10, borderWidth: 2, borderColor: "transparent", alignItems: "center", justifyContent: "center" },
  selectedDate: { flex: 1, textAlign: "center", fontSize: 13 },
  avatar: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  calendar: { width: "100%", maxWidth: 600, alignSelf: "center", paddingHorizontal: 4, paddingBottom: spacing.layout, gap: 2 },
  calendarToolbar: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.layout },
  todayButton: { paddingHorizontal: spacing.layout },
  range: { textAlign: "center", paddingVertical: 4 },
  week: { flexDirection: "row" },
  daySlot: { flex: 1, minWidth: 44, alignItems: "center", justifyContent: "center" },
  weekday: { textAlign: "center", paddingVertical: 4 },
  month: { fontSize: 9, lineHeight: 10 },
  todayDot: { position: "absolute", bottom: 3, width: 3, height: 3, borderRadius: 2 },
});
