import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { AppText, Panel } from "../components/ui";
import { spacing } from "../theme/tokens";
import type { WorkoutTemplate } from "./model";
import { useExercises } from "./provider";
import { ActionRow, ConfirmAction, ExerciseButton, ExerciseError } from "./controls";

export function WorkoutLibrary({ date, onEdit, onClose, onAdded, onOpen }: {
  date: string; onEdit: (workout: WorkoutTemplate) => void; onClose: () => void; onAdded: (id: string) => void; onOpen: (id: string) => void;
}) {
  const store = useExercises();
  const workouts = store.state.kind === "ready" ? store.state.document.workouts : [];
  const records = store.state.kind === "ready" ? store.state.document.sessions.filter(workout => workout.date === date) : [];
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const alive = useRef(true), pending = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  async function add(id: string) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(null);
    const result = await store.planWorkout({ date, workoutId: id });
    pending.current = false;
    if (!alive.current) return;
    setBusy(false);
    if (result) onAdded(result); else setError("Couldn't add this workout. Try again.");
  }
  async function remove(id: string) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(null);
    const success = await store.removeSession(id);
    pending.current = false;
    if (!alive.current) return;
    setBusy(false);
    if (success) setDeleting(null); else setError("Couldn't delete this workout. Try again.");
  }
  return <Panel testID="workout-library"><AppText variant="heading" accessibilityRole="header">Saved workouts</AppText>
    {workouts.length === 0 && <AppText>No workout found. Create a workout to get started.</AppText>}
    {workouts.map(workout => <View key={workout.id} style={{ gap: spacing.layout }}>
      <AppText variant="label">{workout.name}</AppText><AppText variant="caption" muted>{workout.exercises.map(item => item.name).join(" · ")}</AppText>
      <ActionRow><ExerciseButton label="Add to selected day" accessibilityLabel={`Add ${workout.name} to selected day`} onPress={() => void add(workout.id)} disabled={busy} />
        <ExerciseButton label="Edit" accessibilityLabel={`Edit workout ${workout.name}`} onPress={() => onEdit(workout)} disabled={busy} /></ActionRow>
    </View>)}
    {records.length > 0 && <AppText variant="heading" accessibilityRole="header">Workouts for {date}</AppText>}
    {records.map(workout => <View key={workout.id} testID={`logged-workout-${workout.id}`} style={{ gap: spacing.layout }}>
      <AppText variant="label">{workout.name}</AppText>
      <AppText variant="caption" muted>{workout.status === "active" ? "In progress" : workout.status === "planned" ? "Planned" : "Completed"} · {workout.exercises.length} exercises</AppText>
      <ActionRow><ExerciseButton label={workout.status === "completed" ? "Edit" : "Open"}
        accessibilityLabel={`${workout.status === "completed" ? "Edit logged workout" : "Open logged workout"} ${workout.name}`}
        onPress={() => onOpen(workout.id)} disabled={busy} />
        <ExerciseButton label={workout.status === "active" ? "Discard" : "Delete"}
          accessibilityLabel={`${workout.status === "active" ? "Discard workout" : "Delete logged workout"} ${workout.name}`}
          onPress={() => setDeleting(workout.id)} disabled={busy} />
      </ActionRow>
      {deleting === workout.id && <ConfirmAction
        question={workout.status === "active" ? "Discard this workout and all entered sets?" : "Delete this workout and its sets?"}
        label={workout.status === "active" ? "Confirm discard workout" : "Confirm delete logged workout"}
        onConfirm={() => void remove(workout.id)} onCancel={() => setDeleting(null)} disabled={busy} />}
    </View>)}
    <ExerciseError message={error} /><ExerciseButton label="Close saved workouts" onPress={onClose} disabled={busy} />
  </Panel>;
}
