import { useEffect, useRef, useState } from "react";
import { AppText, Panel } from "../components/ui";
import type { ExerciseDefinition } from "./model";
import { useExercises } from "./provider";
import { ExerciseButton, ExerciseError, ExerciseField } from "./controls";

export function SessionPicker({ exercise, date, onAdded, onClose }: {
  exercise: ExerciseDefinition; date: string; onAdded: (id: string, exercise?: ExerciseDefinition) => void; onClose: () => void;
}) {
  const store = useExercises();
  const sessions = store.state.kind === "ready" ? store.state.document.sessions.filter(item => item.date === date) : [];
  const [name, setName] = useState(""), [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [created, setCreated] = useState<string | null>(null);
  const alive = useRef(true), pending = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  async function add(id?: string) {
    if (pending.current) return;
    if (id && sessions.find(session => session.id === id)?.status === "completed") { onAdded(id, exercise); return; }
    if (!id && !created && !name.trim()) { setError("Enter a session name."); return; }
    pending.current = true; setBusy(true); setError(null);
    const sessionId = id ?? created ?? await store.createSession({ date, name });
    if (!alive.current) return;
    if (!id && sessionId) setCreated(sessionId);
    const success = sessionId && await store.addExercise({ sessionId, exerciseId: exercise.id });
    pending.current = false;
    if (!alive.current) return;
    setBusy(false);
    if (success && sessionId) onAdded(sessionId); else setError("Couldn't add the exercise. Your session is still here; try again.");
  }
  return <Panel testID="session-picker"><AppText variant="heading" accessibilityRole="header">Add {exercise.name} to a session</AppText>
    <AppText muted>Choose a session for {date}.</AppText>
    {sessions.map(session => <ExerciseButton key={session.id} label={`${session.name || "Unnamed session"}${session.status === "active" ? " (active)" : session.status === "completed" ? " (completed)" : ""}`}
      accessibilityLabel={`Add ${exercise.name} to ${session.name || "Unnamed session"}`} onPress={() => void add(session.id)} disabled={busy} />)}
    <ExerciseButton label="New session" onPress={() => setCreating(true)} disabled={busy} />
    {creating && <><ExerciseField label="New session name" value={name} onChange={setName} disabled={busy} />
      <ExerciseButton label="Create session and add exercise" onPress={() => void add()} disabled={busy} primary /></>}
    <ExerciseError message={error} /><ExerciseButton label="Cancel session selection" onPress={onClose} disabled={busy} />
  </Panel>;
}
