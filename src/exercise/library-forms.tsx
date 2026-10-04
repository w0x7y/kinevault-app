import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { AppText, Panel } from "../components/ui";
import { spacing } from "../theme/tokens";
import type { ExerciseDefinition, WorkoutTemplate } from "./model";
import { useExercises } from "./provider";
import { ActionRow, ConfirmAction, ExerciseButton, ExerciseError, ExerciseField } from "./controls";

function useAlive() {
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  return alive;
}
export function ExerciseForm({ exercise, onClose }: { exercise?: ExerciseDefinition; onClose: () => void }) {
  const store = useExercises();
  const [values, setValues] = useState<Omit<ExerciseDefinition, "id">>(() => exercise ?? { name: "", muscleGroup: "", equipment: "", notes: "", tracking: "single" as const });
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [confirm, setConfirm] = useState(false);
  const alive = useAlive(), pending = useRef(false);
  async function save(remove = false) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(null);
    const success = remove && exercise ? await store.removeExercise(exercise.id) : await store.saveExercise({ ...values, id: exercise?.id });
    pending.current = false;
    if (!alive.current) return;
    setBusy(false);
    if (success) onClose(); else setError(remove ? "Couldn't delete this exercise. Try again." : "Couldn't save. Enter an exercise name and try again; your fields are still here.");
  }
  return <Panel testID="exercise-form">
    <AppText variant="heading" accessibilityRole="header">{exercise ? "Edit exercise" : "Create exercise"}</AppText>
    <ExerciseField label="Exercise name" value={values.name} onChange={name => setValues(v => ({ ...v, name }))} disabled={busy} />
    <ExerciseField label="Muscle group (optional)" value={values.muscleGroup} onChange={muscleGroup => setValues(v => ({ ...v, muscleGroup }))} disabled={busy} />
    <ExerciseField label="Equipment (optional)" value={values.equipment} onChange={equipment => setValues(v => ({ ...v, equipment }))} disabled={busy} />
    <ExerciseField label="Notes (optional)" value={values.notes} onChange={notes => setValues(v => ({ ...v, notes }))} disabled={busy} multiline />
    <AppText variant="label">Track repetitions and weight</AppText>
    <ActionRow>{(["single", "sides"] as const).map(tracking => <ExerciseButton key={tracking}
      label={tracking === "single" ? "Single weight" : "Left and right"} selected={values.tracking === tracking}
      onPress={() => setValues(v => ({ ...v, tracking }))} disabled={busy} />)}</ActionRow>
    <AppText variant="caption" muted>Leave weight blank for bodyweight. Changes apply to future sessions.</AppText>
    <ExerciseError message={error} />
    <ActionRow><ExerciseButton label="Save exercise" onPress={() => void save()} primary disabled={busy} />
      <ExerciseButton label="Cancel" onPress={onClose} disabled={busy} />
      {exercise && <ExerciseButton label="Delete exercise" onPress={() => setConfirm(true)} disabled={busy} />}</ActionRow>
    {confirm && <ConfirmAction question="Delete this exercise? Saved workouts and past sessions keep their exercise details."
      label="Confirm delete exercise" onConfirm={() => void save(true)} onCancel={() => setConfirm(false)} disabled={busy} />}
  </Panel>;
}
export function WorkoutForm({ workout, onClose }: { workout?: WorkoutTemplate; onClose: () => void }) {
  const store = useExercises();
  const exercises = store.state.kind === "ready" ? store.state.document.exercises : [];
  const [name, setName] = useState(workout?.name ?? ""), [selected, setSelected] = useState(workout?.exercises ?? []);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [confirm, setConfirm] = useState(false);
  const alive = useAlive(), pending = useRef(false);
  const [removal, setRemoval] = useState<ExerciseDefinition | null>(null);
  function move(index: number, direction: number) {
    setSelected(rows => { const next = [...rows]; [next[index], next[index + direction]] = [next[index + direction]!, next[index]!]; return next; });
  }
  async function save(remove = false) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(null);
    const success = remove && workout ? await store.removeWorkout(workout.id)
      : await store.saveWorkout({ id: workout?.id, name, exerciseIds: selected.map(item => item.id) });
    pending.current = false;
    if (!alive.current) return;
    setBusy(false);
    if (success) onClose(); else setError(remove ? "Couldn't delete this workout. Try again." : "Couldn't save. Enter a workout name, choose at least one exercise, and try again.");
  }
  return <Panel testID="workout-form">
    <AppText variant="heading" accessibilityRole="header">{workout ? "Edit workout" : "Create workout"}</AppText>
    <ExerciseField label="Workout name" value={name} onChange={setName} disabled={busy} />
    <AppText variant="label">Exercise order</AppText>
    {selected.length === 0 && <AppText muted>Choose exercises below. Sets and weights are entered when you log a session.</AppText>}
    {selected.map((item, index) => <View key={item.id} style={{ gap: spacing.layout }}>
      <AppText variant="label">{index + 1}. {item.name}</AppText><ActionRow>
        <ExerciseButton label="Up" accessibilityLabel={`Move ${item.name} up`} onPress={() => move(index, -1)} disabled={busy || index === 0} />
        <ExerciseButton label="Down" accessibilityLabel={`Move ${item.name} down`} onPress={() => move(index, 1)} disabled={busy || index === selected.length - 1} />
        <ExerciseButton label="Remove" accessibilityLabel={`Remove ${item.name} from workout`} onPress={() => setRemoval(item)} disabled={busy} />
      </ActionRow></View>)}
    {removal && <ConfirmAction question={`Remove ${removal.name} from this workout?`} label="Confirm remove workout exercise"
      onConfirm={() => { setSelected(rows => rows.filter(row => row.id !== removal.id)); setRemoval(null); }}
      onCancel={() => setRemoval(null)} disabled={busy} />}
    <AppText variant="label">Your exercises</AppText>
    {exercises.length === 0 && <AppText muted>Create an exercise first, then return to build your workout.</AppText>}
    {exercises.filter(item => !selected.some(row => row.id === item.id)).map(item => <ExerciseButton key={item.id}
      label={item.name} accessibilityLabel={`Add ${item.name} to workout`} onPress={() => setSelected(rows => rows.some(row => row.id === item.id) ? rows : [...rows, item])} disabled={busy} />)}
    <ExerciseError message={error} /><ActionRow>
      <ExerciseButton label="Save workout" onPress={() => void save()} primary disabled={busy} />
      <ExerciseButton label="Cancel" onPress={onClose} disabled={busy} />
      {workout && <ExerciseButton label="Delete workout" onPress={() => setConfirm(true)} disabled={busy} />}
    </ActionRow>
    {confirm && <ConfirmAction question="Delete this saved workout? Logged and planned sessions remain."
      label="Confirm delete workout" onConfirm={() => void save(true)} onCancel={() => setConfirm(false)} disabled={busy} />}
  </Panel>;
}
