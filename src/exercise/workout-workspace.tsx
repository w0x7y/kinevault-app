import type { ReactNode } from "react";
import { View } from "react-native";
import { AppButton, ButtonRow, IconButton } from "../components/button";
import { useSheetControls } from "../components/sheet-page";
import { TextField } from "../components/text-field";
import { AppText, Overline } from "../components/ui";
import { spacing } from "../theme/tokens";
import { ExerciseNotes } from "./controls";
import { ExerciseDemoSlot } from "./demo/exercise-demo";
import { ExerciseBar, type ExerciseBarEditing } from "./exercise-bar";
import type { ExerciseDefinition } from "./model";
import { exerciseRowLabel } from "./short-name";

/** Edit mode: the exercise bar's (see ExerciseBar), and the exercise's notes become a field. */
export type WorkspaceEditing = ExerciseBarEditing & {
  onNotes: (id: string, notes: string) => void;
};

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
  previous,
  next,
  onSelect,
  notesId,
  onShowNotes,
  onLinkDemo,
  exerciseActions,
  editing,
  empty,
  busy,
  testID,
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
  /** The rows Back and Next show. */
  previous: Row | undefined;
  next: Row | undefined;
  onSelect: (id: string) => void;
  /** The row whose notes show. */
  notesId: string | null;
  onShowNotes: (id: string | null) => void;
  /** "Link demo" under an exercise without one; left out where leaving would lose changes. */
  onLinkDemo?: (definition: ExerciseDefinition) => void;
  /** Buttons beside the exercise's name, after its notes. */
  exerciseActions?: ReactNode;
  /**
   * Edit mode: the exercise tiles wiggle, can be removed and dragged, and end in an add tile; the
   * notes show as a field.
   */
  editing?: WorkspaceEditing;
  /** What shows when there is no exercise. */
  empty: ReactNode;
  busy: boolean;
  testID: string;
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
          <ExerciseSteps previous={previous} next={next} onSelect={onSelect} busy={busy} />
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
    const label = exerciseRowLabel(exercises, row);
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
          {/* Edit mode keeps the notes open as a field. */}
          <IconButton
            appearance="secondary"
            icon="note-sticky"
            label={`View notes for ${label}`}
            expanded={Boolean(editing) || notesId === row.id}
            disabled={busy || Boolean(editing)}
            onPress={() => onShowNotes(notesId === row.id ? null : row.id)}
          />
          {exerciseActions}
        </View>
        {children(row, label)}
        {editing ? (
          <TextField
            labelTone="muted"
            label={`Notes for ${label}`}
            value={row.exercise.notes}
            onChange={(notes) => editing.onNotes(row.id, notes)}
            kind="multiline"
            disabled={busy}
          />
        ) : (
          notesId === row.id && <ExerciseNotes notes={row.exercise.notes} />
        )}
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
        editing={editing}
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

/** Back and Next: the exercise before and after the one on screen. */
function ExerciseSteps({
  previous,
  next,
  onSelect,
  busy,
}: {
  previous: { id: string } | undefined;
  next: { id: string } | undefined;
  onSelect: (id: string) => void;
  busy: boolean;
}) {
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
