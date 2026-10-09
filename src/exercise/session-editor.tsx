import { useState } from "react";
import { View } from "react-native";
import { AppText, Panel } from "../components/ui";
import { ButtonRow, AppButton, IconButton } from "../components/button";
import { DeleteButton } from "../components/delete-button";
import { spacing } from "../theme/tokens";
import { durationFromMinutes, type SessionExercise, type WorkoutSession } from "./model";
import type { WorkoutEditing } from "./workout-editing";
import { useWorkoutEdit } from "./use-workout-editing";
import { ExerciseError, ExerciseField } from "./controls";
import { ExerciseSetTable } from "./set-table";
import { exerciseRowLabel, WorkoutWorkspace } from "./workout-workspace";
import { ActiveWorkoutTimer } from "./timer";

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
  editing,
  manual = false,
  initialSettings = false,
}: {
  session: WorkoutSession;
  editing: WorkoutEditing;
  manual?: boolean;
  initialSettings?: boolean;
}) {
  const {
    edit,
    fields: draft,
    counts,
    busy,
    error,
    countError: settingsError,
  } = useWorkoutEdit(editing, session.id);
  const [settingsOpen, setSettingsOpen] = useState(initialSettings);
  const [selectedId, setSelectedId] = useState(session.exercises[0]?.id),
    [notesId, setNotesId] = useState<string | null>(null);
  function renderExercise(row: SessionExercise, index: number) {
    const rowLabel = exerciseRowLabel(draft.exercises, row, index);
    return (
      <View key={row.id} style={{ gap: spacing.layout, minWidth: 0 }}>
        <View
          testID="exercise-detail-heading"
          style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, minWidth: 0 }}
        >
          <AppText variant="heading" accessibilityRole="header" style={{ flex: 1, minWidth: 0 }}>
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
          rowLabel={rowLabel}
          busy={busy}
          onChange={(setId, build) => edit.change({ kind: "set", rowId: row.id, setId, build })}
        />
        {notesId === row.id && (
          <AppText variant="caption" muted>
            {row.exercise.notes || "No notes for this exercise."}
          </AppText>
        )}
        <AppText variant="caption" muted>
          Exercise videos are upcoming with KineVault studio integration.
        </AppText>
      </View>
    );
  }
  const compact = session.status === "planned" && !manual;
  const selected = draft.exercises.find((row) => row.id === selectedId) ?? draft.exercises[0];
  const feedback = (
    <>
      <ExerciseError message={error} />
      {error && session.status !== "completed" && (
        <AppButton
          label="Retry draft save"
          onPress={() => void edit.run("retry")}
          disabled={busy}
        />
      )}
    </>
  );
  const active = session.status === "active";
  const headerActions = !active && (
    <View style={{ flexDirection: "row", gap: spacing.sm }}>
      <IconButton
        appearance="secondary"
        label="Settings"
        icon="gear"
        expanded={settingsOpen}
        disabled={busy}
        onPress={() => setSettingsOpen((previous) => !previous)}
      />
      <IconButton
        appearance="secondary"
        label="Cancel"
        icon="xmark"
        disabled={busy}
        onPress={() => void edit.run("cancel")}
      />
    </View>
  );
  const toolbar = !active && (
    <>
      <AppText variant="caption" muted accessibilityLabel="Workout duration">
        {durationCaption(draft.minutes)}
      </AppText>
      {session.status === "planned" && (
        <AppButton label="Start workout" onPress={() => void edit.run("start")} disabled={busy} />
      )}
      {settingsOpen && (
        <View testID="workout-log-settings" style={{ gap: spacing.layout }}>
          <ExerciseField
            label="Workout name"
            value={draft.name}
            onChange={(value) => edit.change({ kind: "name", value })}
            disabled={busy}
          />
          <ExerciseField
            label="Duration in minutes (optional)"
            value={draft.minutes}
            onChange={(value) => edit.change({ kind: "minutes", value })}
            numeric
            disabled={busy}
          />
        </View>
      )}
    </>
  );
  const actions = (
    <ButtonRow testID="workout-log-actions">
      {session.status !== "completed" && (
        <DeleteButton
          label="Discard workout"
          confirmAccessibilityLabel="Confirm discard workout"
          onDelete={() => edit.run("discard")}
          disabled={busy}
          fill
        />
      )}
      <AppButton
        label={
          active
            ? "End workout"
            : session.status === "completed"
              ? "Save changes"
              : "Log completed workout"
        }
        onPress={() => void edit.run(active || session.status === "planned" ? "complete" : "save")}
        primary
        disabled={busy}
        fill
      />
    </ButtonRow>
  );
  return (
    <Panel testID="session-editor">
      {compact ? (
        <View testID="planned-workout-card" style={{ gap: spacing.sm }}>
          <AppText variant="heading" accessibilityRole="header">
            {draft.name}
          </AppText>
          <AppText variant="caption" muted>
            {draft.exercises.length} exercises · {session.date}
          </AppText>
          <ButtonRow>
            <AppButton
              label="Start workout"
              primary
              fill
              onPress={() => void edit.run("start")}
              disabled={busy}
            />
            <AppButton
              label="Log completed workout"
              fill
              onPress={() =>
                void editing.requestView({ kind: "session", id: session.id, manual: true })
              }
              disabled={busy}
            />
          </ButtonRow>
          <AppButton
            label="Settings"
            expanded={settingsOpen}
            onPress={() =>
              void editing.requestView({ kind: "session", id: session.id, settings: true })
            }
            disabled={busy}
          />
          {settingsOpen && (
            <View testID="planned-workout-settings" style={{ gap: spacing.layout }}>
              <AppText variant="label">Planned sets</AppText>
              {draft.exercises.map((row, index) => (
                <ExerciseField
                  key={row.id}
                  label={`Planned sets for ${exerciseRowLabel(draft.exercises, row, index)}`}
                  value={counts[row.id] ?? String(row.sets.length)}
                  onChange={(value) => edit.change({ kind: "count", rowId: row.id, value })}
                  numeric
                  disabled={busy}
                />
              ))}
              <ExerciseError message={settingsError} />
              <AppButton
                label="Save settings"
                onPress={() => {
                  void (async () => {
                    if (await edit.run("settings")) setSettingsOpen(false);
                  })();
                }}
                disabled={busy}
              />
            </View>
          )}
          {feedback}
        </View>
      ) : (
        <WorkoutWorkspace
          name={draft.name}
          testID={
            active
              ? "active-workout-workspace"
              : session.status === "completed"
                ? "completed-workout-workspace"
                : "manual-workout-workspace"
          }
          headerRight={active ? <ActiveWorkoutTimer session={session} /> : undefined}
          headerActions={headerActions}
          toolbar={toolbar}
          exercises={draft.exercises}
          selectedId={selected?.id}
          onSelect={setSelectedId}
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
