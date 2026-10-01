import { useMemo, useState, type PropsWithChildren } from "react";
import { usePathname } from "expo-router";
import { Pressable, StyleSheet, View, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { addDays, calendarWeeks, parseDay } from "../calendar/dates";
import { useSelectedDay } from "../calendar/provider";
import { useTheme } from "../theme/provider";
import { spacing } from "../theme/tokens";
import { Icon } from "./icon";
import { AppText } from "./ui";

function fullDate(day: string): string {
  return parseDay(day).toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

function HeaderButton({
  children, label, onPress, selected, expanded, current, style,
}: PropsWithChildren<{
  label: string;
  onPress: () => void;
  selected?: boolean;
  expanded?: boolean;
  current?: boolean;
  style?: ViewStyle;
}>) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
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

export function AppHeader() {
  const { colors } = useTheme();
  const { selectedDay, today } = useSelectedDay();
  const path = usePathname();
  const isSettings = path === "/settings";
  const [expanded, setExpanded] = useState(false);
  const dateLabel = parseDay(selectedDay).toLocaleDateString(undefined, {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ backgroundColor: colors.card }}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.bar}>
          {isSettings ? <View style={styles.button} /> : (
            <HeaderButton
              label={expanded ? "Collapse calendar" : "Expand calendar"}
              expanded={expanded}
              onPress={() => setExpanded((previous) => !previous)}
            >
              <Icon name={expanded ? "chevron-up" : "chevron-down"} size={16} color={colors.foreground} />
            </HeaderButton>
          )}
          <AppText
            variant="label"
            accessibilityLabel={isSettings ? "Settings" : `${fullDate(selectedDay)}${selectedDay === today ? ", today" : ""}`}
            numberOfLines={1}
            style={styles.selectedDate}
          >
            {isSettings ? "Settings" : dateLabel}
          </AppText>
          <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.avatarSlot}>
            <View style={[styles.avatar, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Icon name="user" size={15} color={colors.mutedForeground} />
            </View>
          </View>
        </View>
        {!isSettings && expanded && <DayCalendar />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { borderBottomWidth: 1 },
  bar: { minHeight: 50, flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.layout, gap: spacing.layout, width: "100%", maxWidth: 768, alignSelf: "center" },
  button: { minWidth: 44, minHeight: 44, borderRadius: 10, borderWidth: 2, borderColor: "transparent", alignItems: "center", justifyContent: "center" },
  selectedDate: { flex: 1, textAlign: "center", fontSize: 13 },
  avatarSlot: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
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
