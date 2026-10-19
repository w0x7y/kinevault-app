import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
  type Ref,
} from "react";
import { usePathname, useRouter } from "expo-router";
import {
  BackHandler,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { addDays, calendarWeeks, parseDay } from "../calendar/dates";
import { useSelectedDay } from "../calendar/provider";
import { useTheme } from "../theme/provider";
import { fonts, radius, spacing } from "../theme/tokens";
import { Icon } from "./icon";
import { AppText } from "./ui";
import { ProfileAvatar } from "../profile/profile-identity";
import { useExercises } from "../exercise/provider";
import type { WorkoutSession } from "../exercise/model";
import { activeWorkout } from "../exercise/model";
import { TimerPillContent, timerPill, useElapsedTime, useLiveTone } from "../exercise/timer";
import { ProfileMenu } from "./profile-menu";
import { PopoverSurface, usePopover } from "./popover";
import { Tappable, type TappableState } from "./tappable";
import {
  headerPage,
  isJournal,
  journalHandlesBack,
  journalTab,
  originatingTab,
  popoverAfterNavigation,
  routeRequest,
  type HeaderPopover,
  type TabPath,
} from "../navigation/track-tabs";

function fullDate(day: string): string {
  return parseDay(day).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function HeaderButton({
  children,
  label,
  onPress,
  selected,
  expanded,
  current,
  style,
  surfaceHeight,
  ref,
}: PropsWithChildren<{
  label: string;
  onPress: () => void;
  selected?: boolean;
  expanded?: boolean;
  current?: boolean;
  style?: StyleProp<ViewStyle>;
  /** A button drawn shorter than its 44 pt hit area. */
  surfaceHeight?: number;
  ref?: Ref<View>;
}>) {
  const { colors } = useTheme();
  const look = ({ pressed }: TappableState) => [
    styles.button,
    { backgroundColor: pressed ? colors.accent : "transparent" },
    style,
  ];
  return (
    <Tappable
      ref={ref}
      label={label}
      selected={selected}
      current={current ? "date" : undefined}
      expanded={expanded}
      onPress={onPress}
      style={surfaceHeight === undefined ? look : undefined}
      surface={surfaceHeight === undefined ? undefined : look}
      surfaceHeight={surfaceHeight}
    >
      {children}
    </Tappable>
  );
}

/** The Active workout's timer in the middle of the header; it opens the workout's page. */
function LiveWorkoutButton({ session }: { session: WorkoutSession }) {
  const router = useRouter();
  const time = useElapsedTime(session);
  const tone = useLiveTone();
  // Narrow phones drop the stopwatch so the date and screen name beside it still fit.
  const narrow = useWindowDimensions().width < 360;
  return (
    <HeaderButton
      label={`Open live workout, elapsed time ${time}`}
      onPress={() => router.navigate(routeRequest("liveWorkout", session.id))}
      surfaceHeight={timerPill.height}
      style={[
        timerPill,
        { backgroundColor: tone.background },
        narrow && { paddingHorizontal: spacing.sm },
      ]}
    >
      <TimerPillContent time={time} icon={!narrow} />
    </HeaderButton>
  );
}

function DayCalendar() {
  const { colors } = useTheme();
  const { selectedDay, selectDay, today } = useSelectedDay();
  const weeks = useMemo(() => calendarWeeks(today), [today]);
  const start = weeks[0]![0]!;
  const end = weeks[4]![6]!;
  const shortDate = (day: string) =>
    parseDay(day).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  const weekdays = weeks[2]!.map((day) => ({
    key: day,
    label: parseDay(day).toLocaleDateString(undefined, { weekday: "short" }),
  }));
  return (
    <View style={styles.calendar}>
      <View style={styles.calendarToolbar}>
        <HeaderButton
          label="Select previous day"
          onPress={() => selectDay(addDays(selectedDay, -1))}
        >
          <Icon name="chevron-left" size={16} color={colors.primary} />
        </HeaderButton>
        <HeaderButton
          label="Select today"
          onPress={() => selectDay(today)}
          style={[styles.todayButton, { backgroundColor: colors.muted }]}
        >
          <AppText variant="label" style={{ fontFamily: fonts.bold }}>
            Today
          </AppText>
        </HeaderButton>
        <HeaderButton label="Select next day" onPress={() => selectDay(addDays(selectedDay, 1))}>
          <Icon name="chevron-right" size={16} color={colors.primary} />
        </HeaderButton>
      </View>
      <AppText variant="caption" muted style={styles.range}>
        {shortDate(start)} – {shortDate(end)}
      </AppText>
      <View style={styles.week}>
        {weekdays.map(({ key, label }) => (
          <View key={key} style={styles.daySlot}>
            <AppText variant="caption" muted style={styles.weekday}>
              {label}
            </AppText>
          </View>
        ))}
      </View>
      {weeks.map((week, row) => (
        <View
          key={week[0]}
          style={[styles.week, row === 2 && { backgroundColor: colors.muted, borderRadius: 14 }]}
        >
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
                    maxWidth: 52,
                    height: 44,
                    borderRadius: radius.pill,
                    backgroundColor: selected ? colors.primary : "transparent",
                    borderColor: isToday && !selected ? colors.foreground : "transparent",
                    borderWidth: isToday && !selected ? 1.5 : 2,
                  }}
                >
                  <AppText
                    variant="label"
                    style={{ color: selected ? colors.primaryForeground : colors.foreground }}
                  >
                    {date.getDate()}
                  </AppText>
                  {monthBoundary && (
                    <AppText
                      style={[
                        styles.month,
                        { color: selected ? colors.primaryForeground : colors.mutedForeground },
                      ]}
                    >
                      {date.toLocaleDateString(undefined, { month: "short" })}
                    </AppText>
                  )}
                  {isToday && (
                    <View
                      style={[
                        styles.todayDot,
                        { backgroundColor: selected ? colors.primaryForeground : colors.primary },
                      ]}
                    />
                  )}
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
  const page = headerPage(path);
  const isProfile = isJournal(path);
  const router = useRouter();
  const exercises = useExercises();
  const live =
    exercises.state.kind === "ready"
      ? (activeWorkout(exercises.state.document.sessions) ?? undefined)
      : undefined;
  const previousTab = useRef<TabPath>("/");
  useEffect(() => {
    previousTab.current = originatingTab(previousTab.current, path);
  }, [path]);
  const returnFromProfile = useCallback(() => router.replace(previousTab.current), [router]);
  const { height: windowHeight } = useWindowDimensions();
  const [popover, setPopover] = useState<HeaderPopover>(null);
  const expanded = popover === "calendar";
  const [headerHeight, setHeaderHeight] = useState(0);
  const closePopover = useCallback(() => setPopover(null), []);
  const calendarChip = useRef<View>(null),
    calendarCard = useRef<View>(null),
    profileButton = useRef<View>(null),
    profileMenu = useRef<View>(null);
  // The calendar stays open while the day below it is used; the menu closes on any outside press.
  usePopover({
    open: expanded,
    onDismiss: closePopover,
    trigger: calendarChip,
    container: calendarCard,
    lightDismiss: false,
  });
  usePopover({
    open: popover === "profile",
    onDismiss: closePopover,
    trigger: profileButton,
    container: profileMenu,
  });
  useEffect(() => {
    setPopover((previous) => popoverAfterNavigation(previous, path));
  }, [path]);
  useEffect(() => {
    if (!journalHandlesBack(path, popover)) return;
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      returnFromProfile();
      return true;
    });
    return () => back.remove();
  }, [path, popover, returnFromProfile]);
  // A live timer takes the middle of the bar, so the date shortens to leave it room.
  const dateLabel = parseDay(selectedDay).toLocaleDateString(
    undefined,
    live
      ? { month: "short", day: "numeric" }
      : { weekday: "short", month: "short", day: "numeric", year: "numeric" },
  );
  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      {popover === "profile" && (
        // Not a control: a tap outside the menu closes it, so it stays out of the accessibility tree.
        <Pressable
          testID="header-popover-backdrop"
          accessible={false}
          importantForAccessibility="no"
          tabIndex={-1}
          aria-hidden
          onPress={closePopover}
          style={[StyleSheet.absoluteFill, { top: headerHeight }]}
        />
      )}
      <SafeAreaView
        edges={["top", "left", "right"]}
        style={{ backgroundColor: colors.background }}
        onStartShouldSetResponder={() => popover === "profile"}
        onResponderRelease={() =>
          setPopover((previous) => (previous === "profile" ? null : previous))
        }
        onLayout={({ nativeEvent }) => {
          const height = nativeEvent.layout.height;
          setHeaderHeight(height);
          onHeightChange(height);
        }}
      >
        <View style={styles.bar}>
          {/* With a live timer the two sides share the width equally, so the timer is centered. */}
          <View style={styles.lead}>
            {isProfile && (
              <HeaderButton
                label="Back from Profile"
                onPress={returnFromProfile}
                style={styles.round}
              >
                <Icon name="chevron-left" size={20} color={colors.primary} />
              </HeaderButton>
            )}
            {/* A larger tap area for pointers; keyboard and screen readers use the calendar chip. */}
            <Pressable
              accessible={false}
              tabIndex={-1}
              disabled={page !== null}
              onPress={() =>
                setPopover((previous) => (previous === "calendar" ? null : "calendar"))
              }
              style={styles.titleArea}
            >
              <AppText
                variant="heading"
                accessibilityLabel={
                  page ?? `${fullDate(selectedDay)}${selectedDay === today ? ", today" : ""}`
                }
                numberOfLines={1}
                style={[styles.selectedDate, page !== null && styles.screenName]}
              >
                {page ?? dateLabel}
              </AppText>
              {page === null && (
                <HeaderButton
                  ref={calendarChip}
                  label={expanded ? "Collapse calendar" : "Expand calendar"}
                  expanded={expanded}
                  surfaceHeight={36}
                  onPress={() =>
                    setPopover((previous) => (previous === "calendar" ? null : "calendar"))
                  }
                  style={[
                    styles.chip,
                    { backgroundColor: expanded ? colors.accent : colors.muted },
                  ]}
                >
                  <Icon name="calendar" size={16} color={colors.primary} />
                  {!live && (
                    <Icon
                      name={expanded ? "chevron-up" : "chevron-down"}
                      size={13}
                      color={colors.mutedForeground}
                    />
                  )}
                </HeaderButton>
              )}
            </Pressable>
          </View>
          {live && <LiveWorkoutButton session={live} />}
          <View style={live && styles.trail}>
            <HeaderButton
              ref={profileButton}
              label="Profile menu"
              expanded={popover === "profile"}
              onPress={() => setPopover((previous) => (previous === "profile" ? null : "profile"))}
              style={styles.avatar}
            >
              <ProfileAvatar />
            </HeaderButton>
          </View>
        </View>
      </SafeAreaView>
      {page === null && expanded && (
        <SafeAreaView
          edges={["left", "right"]}
          pointerEvents="box-none"
          style={[styles.calendarOverlay, { top: headerHeight + 4 }]}
        >
          <PopoverSurface ref={calendarCard} origin="top" style={styles.calendarCard}>
            <DayCalendar />
          </PopoverSurface>
        </SafeAreaView>
      )}
      {popover === "profile" && (
        <SafeAreaView
          edges={["left", "right"]}
          pointerEvents="box-none"
          style={[styles.profileAnchor, { top: headerHeight - 4 }]}
        >
          <ProfileMenu
            ref={profileMenu}
            trigger={profileButton}
            currentProfile={isProfile}
            maxHeight={Math.max(0, windowHeight - headerHeight)}
            onSelect={(entry) => {
              setPopover(null);
              if (entry === "Profile") router.navigate(journalTab.path);
            }}
          />
        </SafeAreaView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 1 },
  // Narrow phones keep a 4px inset so seven 44px day cells still fit at 320px.
  calendarOverlay: {
    position: "absolute",
    width: "100%",
    maxWidth: 576,
    alignSelf: "center",
    paddingHorizontal: spacing.xs,
  },
  calendarCard: { borderRadius: radius.panel, paddingTop: spacing.md },
  profileAnchor: {
    position: "absolute",
    width: "100%",
    maxWidth: 768,
    alignSelf: "center",
    alignItems: "flex-end",
    paddingHorizontal: spacing.layout,
  },
  bar: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    // Even padding keeps the bar's middle on the screen's middle.
    paddingHorizontal: spacing.gutter,
    gap: spacing.sm,
    width: "100%",
    maxWidth: 768,
    alignSelf: "center",
  },
  // Both sides grow from zero, not from their content, so a live timer between them is centered.
  lead: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  trail: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, alignItems: "flex-end" },
  button: { borderRadius: 14, alignItems: "center", justifyContent: "center" },
  round: { borderRadius: radius.pill, marginLeft: -6 },
  avatar: { borderRadius: radius.pill, marginRight: -6 },
  titleArea: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  chip: { flexDirection: "row", gap: 6, paddingHorizontal: spacing.md, borderRadius: radius.pill },
  selectedDate: { flexShrink: 1, fontSize: 17, lineHeight: 24 },
  screenName: { fontFamily: fonts.bold },
  calendar: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    paddingBottom: spacing.md,
    gap: 2,
  },
  calendarToolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.layout,
  },
  todayButton: { paddingHorizontal: spacing.lg, borderRadius: radius.pill },
  range: { textAlign: "center", paddingVertical: 4 },
  week: { flexDirection: "row" },
  daySlot: { flex: 1, minWidth: 44, alignItems: "center", justifyContent: "center" },
  weekday: { textAlign: "center", paddingVertical: 4 },
  month: { fontSize: 10, lineHeight: 11 },
  todayDot: { position: "absolute", bottom: 3, width: 3, height: 3, borderRadius: 2 },
});
