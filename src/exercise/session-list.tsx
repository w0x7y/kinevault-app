import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { AppText, Panel } from "../components/ui";
import { spacing } from "../theme/tokens";
import type { WorkoutSession } from "./model";
import { useExercises } from "./provider";
import { ActionRow, ConfirmAction, ExerciseButton, ExerciseError } from "./controls";

export function SessionList({ sessions, onOpen, onStart, onNew }: {
  sessions: WorkoutSession[]; onOpen: (id: string) => void; onStart: (id: string) => Promise<boolean>; onNew: () => void;
}) {
  const store = useExercises();
  const [deleting, setDeleting] = useState<string | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const alive = useRef(true), pending = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  async function remove(id: string) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(null);
    const success = await store.removeSession(id);
    pending.current = false;
    if (!alive.current) return;
    setBusy(false);
    if (success) setDeleting(null); else setError("Couldn't delete this session. Try again.");
  }
  async function start(id: string) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(null);
    const success = await onStart(id);
    pending.current = false;
    if (!alive.current) return;
    setBusy(false);
    if (!success) setError("Couldn't start this session. Save any open draft and finish or discard the active workout, then try again.");
  }
  return <Panel testID="session-list"><AppText variant="heading" accessibilityRole="header">Sessions for the day</AppText>
    {sessions.length === 0 && <AppText muted>No sessions yet. Add a saved workout or build a session from your exercises.</AppText>}
    <ExerciseButton label="New workout session" onPress={onNew} disabled={busy} />
    {sessions.map(session => <View key={session.id} testID={`session-${session.id}`} style={{ gap: spacing.layout }}>
      <AppText variant="heading">{session.name || "Unnamed session"}</AppText><AppText variant="caption" muted>{session.status} · {session.exercises.length} exercises</AppText>
      {session.status === "completed" && session.exercises.filter(row => row.sets.length > 0).map(row => <View key={row.id} style={{ gap: spacing.xs }}>
        <AppText variant="label">{row.exercise.name}</AppText>
        {row.sets.map((set, index) => <AppText key={set.id} variant="caption">Set {index + 1}: {set.kind === "single"
          ? `${set.reps} reps · ${set.weightKg.trim() ? `${set.weightKg} kg` : "Bodyweight"}`
          : `Left ${set.left.reps || "0"} reps · ${set.left.weightKg.trim() ? `${set.left.weightKg} kg` : "Bodyweight"}; Right ${set.right.reps || "0"} reps · ${set.right.weightKg.trim() ? `${set.right.weightKg} kg` : "Bodyweight"}`}</AppText>)}
      </View>)}
      <ActionRow><ExerciseButton label={session.status === "completed" ? "Edit" : "Open"}
        accessibilityLabel={session.status === "completed" ? `Edit session ${session.name}` : `Open ${session.name}`} onPress={() => onOpen(session.id)} disabled={busy} />
        {session.status === "planned" && <><ExerciseButton label="Start" accessibilityLabel={`Start ${session.name}`} onPress={() => void start(session.id)} disabled={busy} />
          <ExerciseButton label="Log completed" accessibilityLabel={`Log completed ${session.name}`} onPress={() => onOpen(session.id)} disabled={busy} /></>}
        <ExerciseButton label={session.status === "active" ? "Discard" : "Delete"} accessibilityLabel={`Delete session ${session.name}`}
          onPress={() => setDeleting(session.id)} disabled={busy} />
      </ActionRow>
      {deleting === session.id && <ConfirmAction question={session.status === "active" ? "Discard the active workout and its entered sets?" : "Delete this session and its sets?"}
        label="Confirm delete session" onConfirm={() => void remove(session.id)} onCancel={() => setDeleting(null)} disabled={busy} />}
    </View>)}<ExerciseError message={error} />
  </Panel>;
}
