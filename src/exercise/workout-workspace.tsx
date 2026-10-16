import { useState, type ReactNode } from "react";
import { ScrollView, View } from "react-native";
import Animated, { LayoutAnimationConfig } from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { Chip } from "../components/chip";
import { useLayoutMotion } from "../components/motion";
import { AppText, Overline } from "../components/ui";
import { useTheme } from "../theme/provider";
import { radius, spacing } from "../theme/tokens";
import { exerciseChipLabels } from "./short-name";
import { LiveDot, useLiveTone } from "./timer";
export type WorkspaceExercise = { id: string; exercise: { name: string } };

export function exerciseRowLabel(
  exercises: WorkspaceExercise[],
  row: WorkspaceExercise,
  index: number,
) {
  return exercises.filter((item) => item.exercise.name === row.exercise.name).length > 1
    ? `${row.exercise.name} exercise ${index + 1}`
    : row.exercise.name;
}

export function WorkoutWorkspace({
  name,
  overline,
  live = false,
  headerRight,
  headerActions,
  toolbar,
  exercises,
  selectedId,
  onSelect,
  busy,
  testID = "active-workout-workspace",
  children,
  feedback,
  actions,
}: {
  name: string;
  /** A small label above the name, e.g. "Saved workout". */
  overline?: string;
  /** Sets the name and timer on an ink "live" header that spans the card. */
  live?: boolean;
  /** On the live header, beside the name at the right: the active workout's timer. */
  headerRight?: ReactNode;
  headerActions?: ReactNode;
  toolbar?: ReactNode;
  exercises: WorkspaceExercise[];
  selectedId?: string;
  onSelect: (id: string) => void;
  busy: boolean;
  testID?: string;
  children: ReactNode;
  feedback?: ReactNode;
  actions: ReactNode;
}) {
  const tone = useLiveTone();
  const heading = (
    <View
      testID="workout-workspace-heading"
      style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, minWidth: 0 }}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        {overline && !live && <Overline>{overline}</Overline>}
        <AppText
          variant="heading"
          accessibilityRole="header"
          style={[
            { fontSize: 22, lineHeight: 28, letterSpacing: -0.4 },
            live && { color: tone.foreground },
          ]}
        >
          {name || "Workout"}
        </AppText>
      </View>
      {headerActions && (
        <View testID="workout-workspace-controls" style={{ flexShrink: 0 }}>
          {headerActions}
        </View>
      )}
    </View>
  );
  return (
    <View testID={testID} style={{ gap: spacing.layout + 2, minWidth: 0 }}>
      {live ? (
        // The live header bleeds to the card's edges, so the card reads as one object. The name
        // leads on the left and the timer answers it on the right.
        <View
          style={{
            marginTop: -spacing.card,
            marginHorizontal: -spacing.card,
            paddingHorizontal: spacing.card + 2,
            paddingTop: spacing.card + 2,
            paddingBottom: spacing.card + 2,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
            borderTopLeftRadius: radius.panel - 1,
            borderTopRightRadius: radius.panel - 1,
            backgroundColor: tone.background,
          }}
        >
          <View style={{ flex: 1, minWidth: 0, gap: spacing.xs }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <LiveDot color={tone.pulse} />
              <Overline style={{ color: tone.muted }}>Live workout</Overline>
            </View>
            {heading}
          </View>
          {headerRight && <View style={{ flexShrink: 0 }}>{headerRight}</View>}
        </View>
      ) : (
        <>
          {heading}
          {headerRight}
        </>
      )}
      {toolbar}
      <ExerciseBar exercises={exercises} selectedId={selectedId} onSelect={onSelect} busy={busy} />
      <View testID="exercise-details" style={{ minWidth: 0, gap: spacing.layout }}>
        {children}
      </View>
      {feedback}
      {actions}
    </View>
  );
}

/** Exercise pills in a horizontal scroller, fading out at the edge while more follow. */
function ExerciseBar({
  exercises,
  selectedId,
  onSelect,
  busy,
}: {
  exercises: WorkspaceExercise[];
  selectedId?: string;
  onSelect: (id: string) => void;
  busy: boolean;
}) {
  const { colors } = useTheme();
  const { fade } = useLayoutMotion();
  const [width, setWidth] = useState(0),
    [contentWidth, setContentWidth] = useState(0),
    [offset, setOffset] = useState(0);
  const more = contentWidth - width - offset > 4;
  // Chips show short names; the buttons' accessible names keep the full ones.
  const labels = exerciseChipLabels(exercises.map((row) => row.exercise.name));
  return (
    <View testID="exercise-topbar-frame" style={{ minWidth: 0, marginHorizontal: -spacing.card }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        testID="exercise-topbar"
        horizontal
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={32}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        onContentSizeChange={(next) => setContentWidth(next)}
        onScroll={(event) => setOffset(event.nativeEvent.contentOffset.x)}
        style={{ minWidth: 0, flexGrow: 0 }}
        contentContainerStyle={{
          gap: spacing.sm,
          alignItems: "stretch",
          paddingHorizontal: spacing.card,
        }}
      >
        {/* Chips present when the bar opens are simply there; an exercise added later fades in. */}
        <LayoutAnimationConfig skipEntering>
          {exercises.map((row, index) => (
            <Animated.View key={row.id} entering={fade}>
              <Chip
                singleLine
                label={labels[index]}
                accessibilityLabel={`Select exercise ${exerciseRowLabel(exercises, row, index)}`}
                selected={selectedId === row.id}
                disabled={busy}
                onPress={() => onSelect(row.id)}
              />
            </Animated.View>
          ))}
        </LayoutAnimationConfig>
      </ScrollView>
      {more && (
        <View
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            width: 40,
            pointerEvents: "none",
          }}
        >
          <Svg width="100%" height="100%">
            <Defs>
              <LinearGradient id="exercise-bar-fade" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={colors.card} stopOpacity={0} />
                <Stop offset="0.75" stopColor={colors.card} stopOpacity={1} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#exercise-bar-fade)" />
          </Svg>
        </View>
      )}
    </View>
  );
}
