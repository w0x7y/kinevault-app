import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { DeleteButton } from "../components/delete-button";
import { AppText, Panel } from "../components/ui";
import { spacing } from "../theme/tokens";
import type { ExerciseDefinition, WorkoutTemplate } from "./model";
import { useExercises } from "./provider";
import {
  ActionRow,
  ExerciseButton,
  ExerciseError,
  ExerciseField,
  ExerciseIconButton,
} from "./controls";
import { exerciseRowLabel, WorkoutWorkspace } from "./workout-workspace";
import { createWorkoutTemplateDraft } from "./workout-template-draft";

function useAlive() {
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  return alive;
}
export function ExerciseForm({
  exercise,
  onClose,
}: {
  exercise?: ExerciseDefinition;
  onClose: () => void;
}) {
  const store = useExercises();
  const [values, setValues] = useState<Omit<ExerciseDefinition, "id">>(
    () =>
      exercise ?? {
        name: "",
        muscleGroup: "",
        equipment: "",
        notes: "",
        tracking: "single" as const,
      },
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const alive = useAlive(),
    pending = useRef(false);
  async function save(remove = false) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    const success =
      remove && exercise
        ? await store.removeExercise(exercise.id)
        : await store.saveExercise({ ...values, id: exercise?.id });
    pending.current = false;
    if (!alive.current) return;
    setBusy(false);
    if (success) onClose();
    else
      setError(
        remove
          ? "Couldn't delete this exercise. Try again."
          : "Couldn't save. Enter an exercise name and try again; your fields are still here.",
      );
    return success;
  }
  return (
    <Panel testID="exercise-form">
      <AppText variant="heading" accessibilityRole="header">
        {exercise ? "Edit exercise" : "Create exercise"}
      </AppText>
      <ExerciseField
        label="Exercise name"
        value={values.name}
        onChange={(name) => setValues((v) => ({ ...v, name }))}
        disabled={busy}
      />
      <ExerciseField
        label="Muscle group (optional)"
        value={values.muscleGroup}
        onChange={(muscleGroup) => setValues((v) => ({ ...v, muscleGroup }))}
        disabled={busy}
      />
      <ExerciseField
        label="Equipment (optional)"
        value={values.equipment}
        onChange={(equipment) => setValues((v) => ({ ...v, equipment }))}
        disabled={busy}
      />
      <ExerciseField
        label="Notes (optional)"
        value={values.notes}
        onChange={(notes) => setValues((v) => ({ ...v, notes }))}
        disabled={busy}
        multiline
      />
      <AppText variant="label">Track repetitions and weight</AppText>
      <ActionRow>
        {(["single", "sides"] as const).map((tracking) => (
          <ExerciseButton
            key={tracking}
            label={tracking === "single" ? "Single weight" : "Left and right"}
            selected={values.tracking === tracking}
            onPress={() => setValues((v) => ({ ...v, tracking }))}
            disabled={busy}
          />
        ))}
      </ActionRow>
      <AppText variant="caption" muted>
        Leave weight blank for bodyweight. Changes apply to future workouts.
      </AppText>
      <ExerciseError message={error} />
      <ActionRow>
        <ExerciseButton label="Save exercise" onPress={() => void save()} primary disabled={busy} />
        <ExerciseButton label="Cancel" onPress={onClose} disabled={busy} />
        {exercise && (
          <DeleteButton
            label="Delete exercise"
            confirmAccessibilityLabel="Confirm delete exercise"
            onDelete={() => save(true)}
            disabled={busy}
          />
        )}
      </ActionRow>
    </Panel>
  );
}
export function WorkoutForm({
  workout,
  onClose,
}: {
  workout?: WorkoutTemplate;
  onClose: () => void;
}) {
  const store = useExercises();
  const exercises = store.state.kind === "ready" ? store.state.document.exercises : [];
  const [draft, setDraft] = useState(() => createWorkoutTemplateDraft(workout));
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const alive = useAlive(),
    pending = useRef(false);
  const [query, setQuery] = useState(""),
    [limit, setLimit] = useState(20);
  const [settingsOpen, setSettingsOpen] = useState(false),
    [selectedId, setSelectedId] = useState(workout?.exercises[0]?.id);
  const [notesId, setNotesId] = useState<string | null>(null);
  const search = query.trim().toLocaleLowerCase();
  const available = search
    ? exercises.filter(
        (item) =>
          !draft.rows.some((row) => row.exercise.id === item.id) &&
          [item.name, item.muscleGroup, item.equipment, item.notes].some((value) =>
            value.toLocaleLowerCase().includes(search),
          ),
      )
    : [];
  async function save(remove = false) {
    if (pending.current) return;
    const preparation = remove ? null : draft.prepare();
    if (preparation?.kind === "invalid") {
      setError(preparation.message);
      return;
    }
    pending.current = true;
    setBusy(true);
    setError(null);
    const success =
      remove && workout
        ? await store.removeWorkout(workout.id)
        : preparation?.kind === "ready"
          ? await store.saveWorkout(preparation.input)
          : false;
    pending.current = false;
    if (!alive.current) return;
    setBusy(false);
    if (success) onClose();
    else
      setError(
        remove
          ? "Couldn't delete this workout. Try again."
          : "Couldn't save. Enter a workout name, choose at least one exercise, and try again.",
      );
    return success;
  }
  const builder = (
    <View testID="workout-template-settings" style={{ gap: spacing.layout }}>
      <ExerciseField
        label="Workout name"
        value={draft.name}
        onChange={(name) => setDraft((current) => current.rename(name))}
        disabled={busy}
      />
      <AppText variant="label">Available exercises</AppText>
      <ExerciseField
        label="Search workout exercises"
        value={query}
        onChange={(value) => {
          setQuery(value);
          setLimit(20);
        }}
        disabled={busy}
      />
      {exercises.length === 0 ? (
        <AppText muted>Create an exercise first, then return to build your workout.</AppText>
      ) : !search ? (
        <AppText muted>Search by name, muscle group, equipment, or notes to add exercises.</AppText>
      ) : available.length === 0 ? (
        <AppText muted>No available exercises match your search.</AppText>
      ) : null}
      {available.slice(0, limit).map((item) => (
        <ExerciseButton
          key={item.id}
          label={item.name}
          accessibilityLabel={`Add ${item.name} to workout`}
          onPress={() => {
            setDraft((current) => current.add(item));
            setSelectedId(item.id);
          }}
          disabled={busy}
        />
      ))}
      {available.length > limit && (
        <ExerciseButton
          label="Show more exercises"
          onPress={() => setLimit((value) => value + 20)}
          disabled={busy}
        />
      )}
      <AppText variant="label">Exercise order</AppText>
      {draft.rows.length === 0 && (
        <AppText muted>
          Search above to choose exercises, then set how many sets you plan to do.
        </AppText>
      )}
      {draft.rows.map(({ exercise: item, rawCount }, index) => (
        <View key={item.id} style={{ gap: spacing.layout }}>
          <AppText variant="label">
            {index + 1}. {item.name}
          </AppText>
          {!workout && (
            <ExerciseField
              label={`Planned sets for ${item.name}`}
              value={rawCount}
              onChange={(value) => setDraft((current) => current.setCount(item.id, value))}
              numeric
              disabled={busy}
            />
          )}
          <ActionRow>
            <ExerciseButton
              label="Up"
              accessibilityLabel={`Move ${item.name} up`}
              onPress={() => setDraft((current) => current.move(index, -1))}
              disabled={busy || index === 0}
            />
            <ExerciseButton
              label="Down"
              accessibilityLabel={`Move ${item.name} down`}
              onPress={() => setDraft((current) => current.move(index, 1))}
              disabled={busy || index === draft.rows.length - 1}
            />
            <DeleteButton
              label="Remove"
              accessibilityLabel={`Remove ${item.name} from workout`}
              confirmAccessibilityLabel="Confirm remove workout exercise"
              onDelete={() => setDraft((current) => current.remove(item.id))}
              disabled={busy}
            />
          </ActionRow>
        </View>
      ))}
    </View>
  );
  const selectedDraftRow =
    draft.rows.find((row) => row.exercise.id === selectedId) ?? draft.rows[0];
  const selectedExercise = selectedDraftRow?.exercise;
  const rows = draft.rows.map(({ exercise }) => ({ id: exercise.id, exercise }));
  const selectedRow = rows.find((row) => row.id === selectedExercise?.id);
  const rowLabel = selectedRow
    ? exerciseRowLabel(rows, selectedRow, rows.indexOf(selectedRow))
    : "";
  return (
    <Panel testID="workout-form">
      {workout ? (
        <WorkoutWorkspace
          name={draft.name.trim() || "Edit workout"}
          testID="template-workout-workspace"
          headerRight={
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <ExerciseIconButton
                label="Settings"
                icon="gear"
                onPress={() => setSettingsOpen((value) => !value)}
                disabled={busy}
              />
              <ExerciseIconButton label="Cancel" icon="xmark" onPress={onClose} disabled={busy} />
            </View>
          }
          toolbar={settingsOpen ? builder : undefined}
          exercises={rows}
          selectedId={selectedExercise?.id}
          onSelect={setSelectedId}
          busy={busy}
          feedback={<ExerciseError message={error} />}
          actions={
            <View
              testID="workout-template-actions"
              style={{ flexDirection: "row", gap: spacing.sm }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <DeleteButton
                  label="Delete workout"
                  fill
                  confirmAccessibilityLabel="Confirm delete workout"
                  onDelete={() => save(true)}
                  disabled={busy}
                />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <ExerciseButton
                  label="Save workout"
                  fill
                  onPress={() => void save()}
                  primary
                  disabled={busy}
                />
              </View>
            </View>
          }
        >
          {selectedDraftRow && selectedExercise ? (
            <>
              <View
                testID="exercise-heading-row"
                style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}
              >
                <AppText
                  variant="heading"
                  accessibilityRole="header"
                  style={{ flex: 1, minWidth: 0 }}
                >
                  {selectedExercise.name}
                </AppText>
                <ExerciseIconButton
                  label={`View notes for ${rowLabel}`}
                  icon="note-sticky"
                  onPress={() =>
                    setNotesId((previous) =>
                      previous === selectedExercise.id ? null : selectedExercise.id,
                    )
                  }
                  disabled={busy}
                />
              </View>
              <ExerciseField
                label={`Planned sets for ${rowLabel}`}
                value={selectedDraftRow.rawCount}
                onChange={(value) =>
                  setDraft((current) => current.setCount(selectedExercise.id, value))
                }
                numeric
                disabled={busy}
              />
              {notesId === selectedExercise.id && (
                <AppText variant="caption" muted>
                  {selectedExercise.notes || "No notes for this exercise."}
                </AppText>
              )}
              <AppText variant="caption" muted>
                Exercise videos are upcoming with KineVault studio integration.
              </AppText>
            </>
          ) : (
            <AppText muted>Open Settings to add exercises to this workout.</AppText>
          )}
        </WorkoutWorkspace>
      ) : (
        <>
          <AppText variant="heading" accessibilityRole="header">
            Create workout
          </AppText>
          {builder}
          <ExerciseError message={error} />
          <ActionRow>
            <ExerciseButton
              label="Save workout"
              onPress={() => void save()}
              primary
              disabled={busy}
            />
            <ExerciseButton label="Cancel" onPress={onClose} disabled={busy} />
          </ActionRow>
        </>
      )}
    </Panel>
  );
}
