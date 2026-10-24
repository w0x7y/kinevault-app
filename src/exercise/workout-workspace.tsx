import { useEffect, useRef, useState, type ReactNode } from "react";
import { ScrollView, View } from "react-native";
import Animated, { LayoutAnimationConfig } from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { AppButton, ButtonRow, IconButton } from "../components/button";
import { Chip } from "../components/chip";
import { useLayoutMotion, useReducedMotion } from "../components/motion";
import { useSheetControls } from "../components/sheet-page";
import { AppText, Overline } from "../components/ui";
import { useTheme } from "../theme/provider";
import { spacing } from "../theme/tokens";
import { ExerciseNotes } from "./controls";
import { ExerciseDemoSlot } from "./demo/exercise-demo";
import type { ExerciseDefinition } from "./model";
import { exerciseRowLabel, shortExerciseName, type WorkspaceExercise } from "./short-name";

/**
 * A workout's page on its sheet: its heading, the exercise bar and the exercise on screen. The
 * workspace draws that exercise's heading, notes and demo, and pins Back and Next on top of the
 * main action under the page, where they stay put; `children` draws what the caller logs or
 * plans for the exercise.
 */
export function WorkoutWorkspace<Row extends { id: string; exercise: ExerciseDefinition }>({
  name,
  overline,
  headerActions,
  toolbar,
  exercises,
  selected,
  onSelect,
  notesId,
  onShowNotes,
  onLinkDemo,
  exerciseActions,
  empty,
  busy,
  testID = "active-workout-workspace",
  children,
  feedback,
  primary,
  trailing,
  actions,
}: {
  /** The workout's name; none leaves the heading out, as on the live workout. */
  name?: string;
  /** A small label above the name, e.g. "Saved workout". */
  overline?: string;
  headerActions?: ReactNode;
  toolbar?: ReactNode;
  exercises: readonly Row[];
  /** The exercise row on screen. */
  selected: Row | undefined;
  onSelect: (id: string) => void;
  /** The row whose notes show. */
  notesId: string | null;
  onShowNotes: (id: string | null) => void;
  /** "Link demo" under an exercise without one; left out where leaving would lose changes. */
  onLinkDemo?: (definition: ExerciseDefinition) => void;
  /** Buttons beside the exercise's name, after its notes. */
  exerciseActions?: (row: Row, label: string) => ReactNode;
  /** What shows when there is no exercise. */
  empty: ReactNode;
  busy: boolean;
  testID?: string;
  /** The exercise's sets or plan, given its row and accessible name. */
  children: (row: Row, label: string) => ReactNode;
  feedback?: ReactNode;
  /** The main action, pinned under the page with Back and Next on top of it. */
  primary: ReactNode;
  /** A control pinned to the header's right, e.g. Discard. */
  trailing?: ReactNode;
  /** Controls at the end of the page, e.g. Delete workout. */
  actions?: ReactNode;
}) {
  useSheetControls({
    trailing,
    footer: (
      <View style={{ gap: spacing.sm }}>
        {selected && (
          <ExerciseSteps
            exercises={exercises}
            selected={selected}
            onSelect={onSelect}
            busy={busy}
          />
        )}
        {primary}
      </View>
    ),
  });
  const heading = (
    <View
      testID="workout-workspace-heading"
      style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, minWidth: 0 }}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        {overline && <Overline>{overline}</Overline>}
        <AppText
          variant="heading"
          accessibilityRole="header"
          style={{ fontSize: 22, lineHeight: 28, letterSpacing: -0.4 }}
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
  function renderExercise(row: Row) {
    const label = exerciseRowLabel(exercises, row, exercises.indexOf(row));
    return (
      <View key={row.id} style={{ gap: spacing.layout, minWidth: 0 }}>
        <View
          testID="exercise-detail-heading"
          style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, minWidth: 0 }}
        >
          <AppText
            variant="heading"
            accessibilityRole="header"
            style={{ flex: 1, minWidth: 0, fontSize: 17 }}
          >
            {row.exercise.name}
          </AppText>
          <IconButton
            appearance="secondary"
            icon="note-sticky"
            label={`View notes for ${label}`}
            expanded={notesId === row.id}
            disabled={busy}
            onPress={() => onShowNotes(notesId === row.id ? null : row.id)}
          />
          {exerciseActions?.(row, label)}
        </View>
        {children(row, label)}
        {notesId === row.id && <ExerciseNotes notes={row.exercise.notes} />}
        <ExerciseDemoSlot
          exercise={row.exercise}
          label={label}
          disabled={busy}
          onLinkDemo={onLinkDemo}
        />
      </View>
    );
  }
  return (
    <View testID={testID} style={{ flexGrow: 1, gap: spacing.layout + 2, minWidth: 0 }}>
      {name !== undefined && heading}
      {toolbar}
      <ExerciseBar
        exercises={exercises}
        selectedId={selected?.id}
        onSelect={onSelect}
        busy={busy}
      />
      <View testID="exercise-details" style={{ minWidth: 0, gap: spacing.layout }}>
        {selected ? renderExercise(selected) : empty}
      </View>
      {feedback}
      {actions}
    </View>
  );
}

/** Back and Next: the exercise before and after `selected`. */
function ExerciseSteps<Row extends { id: string }>({
  exercises,
  selected,
  onSelect,
  busy,
}: {
  exercises: readonly Row[];
  selected: Row;
  onSelect: (id: string) => void;
  busy: boolean;
}) {
  const index = exercises.indexOf(selected);
  const previous = exercises[index - 1],
    next = index < 0 ? undefined : exercises[index + 1];
  return (
    <ButtonRow testID="exercise-step-buttons">
      <AppButton
        icon="arrow-left"
        label="Back"
        accessibilityLabel="Back to previous exercise"
        disabled={busy || !previous}
        onPress={() => previous && onSelect(previous.id)}
      />
      <AppButton
        icon="arrow-right"
        iconAfter
        label="Next"
        accessibilityLabel="Next exercise"
        disabled={busy || !next}
        onPress={() => next && onSelect(next.id)}
      />
    </ButtonRow>
  );
}

/** Exercise pills in a horizontal scroller, fading out at either edge while more lie past it. */
function ExerciseBar({
  exercises,
  selectedId,
  onSelect,
  busy,
}: {
  exercises: readonly WorkspaceExercise[];
  selectedId?: string;
  onSelect: (id: string) => void;
  busy: boolean;
}) {
  const { fade } = useLayoutMotion();
  // Scrolling reports ~30 times a second; only the fades' flags re-render the chips.
  const bar = useRef({ width: 0, contentWidth: 0, offset: 0 });
  const [before, setBefore] = useState(false);
  const [after, setAfter] = useState(false);
  const measure = (next: Partial<typeof bar.current>) => {
    const { width, contentWidth, offset } = Object.assign(bar.current, next);
    setBefore(offset > 4);
    setAfter(contentWidth - width - offset > 4);
  };
  // Back and Next can pick an exercise whose chip sits off screen; bring it into view.
  const reduced = useReducedMotion();
  const scroller = useRef<ScrollView>(null);
  const chipX = useRef(new Map<string, number>());
  const reveal = (x: number, animated: boolean) =>
    scroller.current?.scrollTo({ x: Math.max(0, x - 2 * spacing.card), animated });
  useEffect(() => {
    const x = selectedId === undefined ? undefined : chipX.current.get(selectedId);
    if (x !== undefined) reveal(x, !reduced);
  }, [selectedId, reduced]);
  return (
    <View testID="exercise-topbar-frame" style={{ minWidth: 0, marginHorizontal: -spacing.card }}>
      <ScrollView
        ref={scroller}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        testID="exercise-topbar"
        horizontal
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={32}
        onLayout={(event) => measure({ width: event.nativeEvent.layout.width })}
        onContentSizeChange={(contentWidth) => measure({ contentWidth })}
        onScroll={(event) => measure({ offset: event.nativeEvent.contentOffset.x })}
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
            <Animated.View
              key={row.id}
              entering={fade}
              onLayout={(event) => {
                chipX.current.set(row.id, event.nativeEvent.layout.x);
                // A page that opens on, or adds, an exercise past the edge shows its chip.
                if (row.id === selectedId) reveal(event.nativeEvent.layout.x, false);
              }}
            >
              {/* Chips show a short name and position; the accessible names keep the full ones. */}
              <Chip
                singleLine
                minWidth={72}
                caption={String(index + 1)}
                label={shortExerciseName(row.exercise.name)}
                accessibilityLabel={`Select exercise ${exerciseRowLabel(exercises, row, index)}`}
                selected={selectedId === row.id}
                disabled={busy}
                onPress={() => onSelect(row.id)}
              />
            </Animated.View>
          ))}
        </LayoutAnimationConfig>
      </ScrollView>
      {before && <EdgeFade side="left" />}
      {after && <EdgeFade side="right" />}
    </View>
  );
}

/** A card-colored fade over one end of the exercise bar. */
function EdgeFade({ side }: { side: "left" | "right" }) {
  const { colors } = useTheme();
  const id = `exercise-bar-fade-${side}`;
  return (
    <View
      testID={id}
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        ...(side === "left" ? { left: 0 } : { right: 0 }),
        width: 40,
        pointerEvents: "none",
      }}
    >
      <Svg width="100%" height="100%">
        <Defs>
          {/* Clear at the chips, solid at the edge. */}
          <LinearGradient
            id={id}
            x1={side === "left" ? "1" : "0"}
            y1="0"
            x2={side === "left" ? "0" : "1"}
            y2="0"
          >
            <Stop offset="0" stopColor={colors.card} stopOpacity={0} />
            <Stop offset="0.75" stopColor={colors.card} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}
