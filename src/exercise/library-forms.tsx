import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { DeleteButton } from "../components/delete-button";
import { AppText, Panel } from "../components/ui";
import { spacing } from "../theme/tokens";
import type { ExerciseDefinition, WorkoutTemplate } from "./model";
import { useExercises } from "./provider";
import { ActionRow, ExerciseButton, ExerciseError, ExerciseField } from "./controls";

function useAlive() {
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  return alive;
}
export function ExerciseForm({ exercise, onClose }: { exercise?: ExerciseDefinition; onClose: () => void }) {
  const store = useExercises();
  const [values, setValues] = useState<Omit<ExerciseDefinition, "id">>(() => exercise ?? { name: "", muscleGroup: "", equipment: "", notes: "", tracking: "single" as const });
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const alive = useAlive(), pending = useRef(false);
  async function save(remove = false) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(null);
    const success = remove && exercise ? await store.removeExercise(exercise.id) : await store.saveExercise({ ...values, id: exercise?.id });
    pending.current = false;
    if (!alive.current) return;
    setBusy(false);
    if (success) onClose(); else setError(remove ? "Couldn't delete this exercise. Try again." : "Couldn't save. Enter an exercise name and try again; your fields are still here.");
    return success;
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
    <AppText variant="caption" muted>Leave weight blank for bodyweight. Changes apply to future workouts.</AppText>
    <ExerciseError message={error} />
    <ActionRow><ExerciseButton label="Save exercise" onPress={() => void save()} primary disabled={busy} />
      <ExerciseButton label="Cancel" onPress={onClose} disabled={busy} />
      {exercise && <DeleteButton label="Delete exercise" confirmAccessibilityLabel="Confirm delete exercise" onDelete={() => save(true)} disabled={busy} />}</ActionRow>
  </Panel>;
}
export function WorkoutForm({ workout, onClose }: { workout?: WorkoutTemplate; onClose: () => void }) {
  const store = useExercises();
  const exercises = store.state.kind === "ready" ? store.state.document.exercises : [];
  const [name, setName] = useState(workout?.name ?? ""), [selected, setSelected] = useState(workout?.exercises ?? []);
  const [setCounts, setSetCounts] = useState<Record<string, string>>(() => Object.fromEntries(
    (workout?.exercises ?? []).map(item => [item.id, String(workout?.setCounts?.[item.id] ?? 0)])));
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const alive = useAlive(), pending = useRef(false);
  const [query, setQuery] = useState(""), [limit, setLimit] = useState(20);
  const search = query.trim().toLocaleLowerCase();
  const available = search ? exercises.filter(item => !selected.some(row => row.id === item.id)
    && [item.name, item.muscleGroup, item.equipment, item.notes].some(value => value.toLocaleLowerCase().includes(search))) : [];
  function move(index: number, direction: number) {
    setSelected(rows => { const next = [...rows]; [next[index], next[index + direction]] = [next[index + direction]!, next[index]!]; return next; });
  }
  async function save(remove = false) {
    if (pending.current) return;
    const counts: Record<string, number> = {};
    if (!remove) {
      for (const item of selected) {
        const value = (setCounts[item.id] ?? "3").trim();
        if (!/^\d+$/.test(value) || Number(value) > 100) {
          setError(`Enter a whole number of sets from 0 to 100 for ${item.name}.`);
          return;
        }
        counts[item.id] = Number(value);
      }
    }
    pending.current = true; setBusy(true); setError(null);
    const success = remove && workout ? await store.removeWorkout(workout.id)
      : await store.saveWorkout({ id: workout?.id, name, exerciseIds: selected.map(item => item.id), setCounts: counts });
    pending.current = false;
    if (!alive.current) return;
    setBusy(false);
    if (success) onClose(); else setError(remove ? "Couldn't delete this workout. Try again." : "Couldn't save. Enter a workout name, choose at least one exercise, and try again.");
    return success;
  }
  return <Panel testID="workout-form">
    <AppText variant="heading" accessibilityRole="header">{workout ? "Edit workout" : "Create workout"}</AppText>
    <ExerciseField label="Workout name" value={name} onChange={setName} disabled={busy} />
    <AppText variant="label">Available exercises</AppText>
    <ExerciseField label="Search workout exercises" value={query} onChange={value => { setQuery(value); setLimit(20); }} disabled={busy} />
    {exercises.length === 0 ? <AppText muted>Create an exercise first, then return to build your workout.</AppText>
      : !search ? <AppText muted>Search by name, muscle group, equipment, or notes to add exercises.</AppText>
      : available.length === 0 ? <AppText muted>No available exercises match your search.</AppText> : null}
    {available.slice(0, limit).map(item => <ExerciseButton key={item.id}
      label={item.name} accessibilityLabel={`Add ${item.name} to workout`} onPress={() => setSelected(rows => rows.some(row => row.id === item.id) ? rows : [...rows, item])} disabled={busy} />)}
    {available.length > limit && <ExerciseButton label="Show more exercises" onPress={() => setLimit(value => value + 20)} disabled={busy} />}
    <AppText variant="label">Exercise order</AppText>
    {selected.length === 0 && <AppText muted>Search above to choose exercises, then set how many sets you plan to do.</AppText>}
    {selected.map((item, index) => <View key={item.id} style={{ gap: spacing.layout }}>
      <AppText variant="label">{index + 1}. {item.name}</AppText>
      <ExerciseField label={`Planned sets for ${item.name}`} value={setCounts[item.id] ?? "3"}
        onChange={value => setSetCounts(previous => ({ ...previous, [item.id]: value }))} numeric disabled={busy} />
      <ActionRow>
        <ExerciseButton label="Up" accessibilityLabel={`Move ${item.name} up`} onPress={() => move(index, -1)} disabled={busy || index === 0} />
        <ExerciseButton label="Down" accessibilityLabel={`Move ${item.name} down`} onPress={() => move(index, 1)} disabled={busy || index === selected.length - 1} />
        <DeleteButton label="Remove" accessibilityLabel={`Remove ${item.name} from workout`} confirmAccessibilityLabel="Confirm remove workout exercise"
          onDelete={() => setSelected(rows => rows.filter(row => row.id !== item.id))} disabled={busy} />
      </ActionRow></View>)}
    <ExerciseError message={error} /><ActionRow>
      <ExerciseButton label="Save workout" onPress={() => void save()} primary disabled={busy} />
      <ExerciseButton label="Cancel" onPress={onClose} disabled={busy} />
      {workout && <DeleteButton label="Delete workout" confirmAccessibilityLabel="Confirm delete workout" onDelete={() => save(true)} disabled={busy} />}
    </ActionRow>
  </Panel>;
}
