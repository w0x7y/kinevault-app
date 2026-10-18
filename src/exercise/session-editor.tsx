import { useState } from "react";
import { View } from "react-native";
import { AppText, Overline, Panel } from "../components/ui";
import { ButtonRow, AppButton, IconButton } from "../components/button";
import { DeleteButton } from "../components/delete-button";
import { spacing } from "../theme/tokens";
import {
  durationFromMinutes,
  previousSets,
  type SessionExercise,
  type WorkoutSession,
} from "./model";
import { useExercises } from "./provider";
import type { ExerciseTabView } from "./tab-view";
import { ExerciseDemoSlot } from "./demo/exercise-demo";
import { useWorkoutEdit } from "./use-workout-editing";
import { InlineMessage } from "../components/inline-message";
import { TextField } from "../components/text-field";
import { ExerciseNotes, SectionLabel } from "./controls";
import { ExerciseSetTable } from "./set-table";
import { exerciseRowLabel, WorkoutWorkspace } from "./workout-workspace";
import { useSheetBack } from "../components/sheet-page";

function durationCaption(minutes: string) {
  try {
    const seconds = durationFromMinutes(minutes);
    return seconds === null
      ? "Duration not set"
      : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  } catch {
    return "Invalid duration";
  }
}

export function SessionEditor({
  session,
  tab,
  closeLabel = null,
}: {
  session: WorkoutSession;
  tab: ExerciseTabView;
  /** Names a compact card's close control, when a panel opened the card on its own. */
  closeLabel?: string | null;
}) {
  const {
    edit,
    fields: draft,
    counts,
    busy,
    error,
    countError: settingsError,
    selectedId,
    settingsOpen,
    mode,
    back,
    primary,
    discard,
    start,
    details,
    returnTo,
  } = useWorkoutEdit(tab.edits, session.id);
  const store = useExercises();
  const sessions = store.state.kind === "ready" ? store.state.document.sessions : [];
  const [detailsOpen, setDetailsOpen] = useState(false),
    [notesId, setNotesId] = useState<string | null>(null);
  const active = mode === "active",
    completed = mode === "completed";
  // In a sheet, its back button is this workout's Cancel. The Active workout keeps running.
  const inSheet = useSheetBack({ onPress: () => void edit.run(back), disabled: busy });
  function renderExercise(row: SessionExercise, index: number) {
    const rowLabel = exerciseRowLabel(draft.exercises, row, index);
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
            icon="plus"
            label={`Add set to ${rowLabel}`}
            disabled={busy}
            onPress={() => edit.change({ kind: "add-set", rowId: row.id })}
          />
          <IconButton
            appearance="secondary"
            icon="note-sticky"
            label={`View notes for ${rowLabel}`}
            expanded={notesId === row.id}
            disabled={busy}
            onPress={() => setNotesId((previous) => (previous === row.id ? null : row.id))}
          />
        </View>
        <ExerciseSetTable
          sets={row.sets}
          previous={previousSets(sessions, session, row.exercise.id)}
          rowLabel={rowLabel}
          busy={busy}
          onChange={(setId, build) => edit.change({ kind: "set", rowId: row.id, setId, build })}
        />
        {notesId === row.id && <ExerciseNotes notes={row.exercise.notes} />}
        <ExerciseDemoSlot
          exercise={row.exercise}
          label={rowLabel}
          disabled={busy}
          onLinkDemo={(definition) =>
            void tab.requestView({
              kind: "exercise",
              exercise: definition,
              linkDemo: true,
              returnTo,
            })
          }
        />
      </View>
    );
  }
  const selected = draft.exercises.find((row) => row.id === selectedId) ?? draft.exercises[0];
  const feedback = (
    <>
      <InlineMessage>{error}</InlineMessage>
      {error && !completed && (
        <AppButton
          label="Retry draft save"
          onPress={() => void edit.run("retry")}
          disabled={busy}
        />
      )}
    </>
  );
  // Manual and completed logs can rename the workout and set its duration.
  const headerActions = details && (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
      <AppButton
        size="compact"
        icon="pen"
        label="Details"
        accessibilityLabel="Workout name and duration"
        expanded={detailsOpen}
        disabled={busy}
        onPress={() => setDetailsOpen((previous) => !previous)}
      />
    </View>
  );
  const toolbar = details && (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <Overline>Duration</Overline>
        <AppText
          variant="label"
          accessibilityLabel="Workout duration"
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {durationCaption(draft.minutes)}
        </AppText>
      </View>
      {start && (
        <AppButton label="Start workout" onPress={() => void edit.run("start")} disabled={busy} />
      )}
      {detailsOpen && (
        <View testID="workout-log-settings" style={{ gap: spacing.layout }}>
          <TextField
            labelTone="muted"
            label="Workout name"
            value={draft.name}
            onChange={(value) => edit.change({ kind: "name", value })}
            disabled={busy}
          />
          <TextField
            labelTone="muted"
            label="Duration in minutes (optional)"
            value={draft.minutes}
            onChange={(value) => edit.change({ kind: "minutes", value })}
            kind="decimal"
            disabled={busy}
          />
        </View>
      )}
    </>
  );
  // The main action leads; discarding sits under it in red, so it is never the first tap.
  const actions = (
    <View testID="workout-log-actions" style={{ gap: spacing.sm }}>
      <AppButton
        label={active ? "End workout" : completed ? "Save changes" : "Log completed workout"}
        onPress={() => void edit.run(primary)}
        tone="primary"
        disabled={busy}
      />
      {discard && (
        <DeleteButton
          label="Discard workout"
          confirmAccessibilityLabel="Confirm discard workout"
          onDelete={() => edit.run("discard")}
          disabled={busy}
        />
      )}
    </View>
  );
  const plannedHeading = (
    <View style={{ gap: 2 }}>
      <Overline>Planned</Overline>
      <AppText
        variant="heading"
        accessibilityRole="header"
        style={{ fontSize: 22, lineHeight: 28, letterSpacing: -0.4 }}
      >
        {draft.name}
      </AppText>
      <AppText variant="caption" muted numberOfLines={2}>
        {draft.exercises.length
          ? draft.exercises.map((row) => row.exercise.name).join(" · ")
          : "No exercises yet"}
      </AppText>
    </View>
  );
  return (
    <Panel testID={inSheet ? undefined : "session-editor"}>
      {mode === "compact" ? (
        <View testID="planned-workout-card" style={{ gap: spacing.md }}>
          {closeLabel ? (
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.sm }}>
              <View style={{ flex: 1, minWidth: 0 }}>{plannedHeading}</View>
              <IconButton
                label={closeLabel}
                icon="xmark"
                disabled={busy}
                onPress={() => void edit.run("cancel")}
              />
            </View>
          ) : (
            plannedHeading
          )}
          <ButtonRow>
            <AppButton
              label="Start workout"
              tone="primary"
              fill
              onPress={() => void edit.run("start")}
              disabled={busy}
            />
            <AppButton
              label="Log completed workout"
              fill
              onPress={() =>
                void tab.requestView({ kind: "session", id: session.id, manual: true })
              }
              disabled={busy}
            />
          </ButtonRow>
          <AppButton
            icon="gear"
            label="Workout settings"
            expanded={settingsOpen}
            onPress={() => edit.showSettings(!settingsOpen)}
            disabled={busy}
          />
          {settingsOpen && (
            <View testID="planned-workout-settings" style={{ gap: spacing.layout }}>
              <SectionLabel>Planned sets</SectionLabel>
              {draft.exercises.map((row, index) => (
                <TextField
                  labelTone="muted"
                  key={row.id}
                  label={`Planned sets for ${exerciseRowLabel(draft.exercises, row, index)}`}
                  value={counts[row.id] ?? String(row.sets.length)}
                  onChange={(value) => edit.change({ kind: "count", rowId: row.id, value })}
                  kind="decimal"
                  layout="inline"
                  disabled={busy}
                />
              ))}
              <InlineMessage>{settingsError}</InlineMessage>
              <AppButton
                label="Save settings"
                onPress={() => void edit.run("settings")}
                disabled={busy}
              />
            </View>
          )}
          {feedback}
        </View>
      ) : (
        <WorkoutWorkspace
          name={draft.name}
          overline={active ? undefined : completed ? "Logged workout" : "Log a workout"}
          testID={
            active
              ? "active-workout-workspace"
              : completed
                ? "completed-workout-workspace"
                : "manual-workout-workspace"
          }
          headerActions={headerActions}
          toolbar={toolbar}
          exercises={draft.exercises}
          selectedId={selected?.id}
          onSelect={edit.select}
          busy={busy}
          feedback={feedback}
          actions={actions}
        >
          {selected ? (
            renderExercise(selected, draft.exercises.indexOf(selected))
          ) : (
            <AppText muted>This workout has no exercises.</AppText>
          )}
        </WorkoutWorkspace>
      )}
    </Panel>
  );
}
