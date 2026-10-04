import { useEffect, useRef, useState } from "react";
import { AppText, Panel } from "../components/ui";
import { useExercises } from "./provider";
import { ActionRow, ExerciseButton, ExerciseError, ExerciseField } from "./controls";

export function NewSession({ date, onCreated, onClose }: { date: string; onCreated: (id: string) => void; onClose: () => void }) {
  const store = useExercises();
  const [name, setName] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const alive = useRef(true), pending = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  async function create() {
    if (pending.current) return;
    if (!name.trim()) { setError("Enter a session name."); return; }
    pending.current = true; setBusy(true); setError(null);
    const id = await store.createSession({ date, name });
    pending.current = false;
    if (!alive.current) return;
    setBusy(false);
    if (id) onCreated(id); else setError("Couldn't create your session. Try again.");
  }
  return <Panel testID="new-session-form"><AppText variant="heading">New workout session</AppText>
    <AppText muted>Session date: {date}. Add exercises from your library after creating it.</AppText>
    <ExerciseField label="New session name" value={name} onChange={setName} disabled={busy} />
    <ExerciseError message={error} /><ActionRow><ExerciseButton label="Create session" onPress={() => void create()} primary disabled={busy} />
      <ExerciseButton label="Cancel" onPress={onClose} disabled={busy} /></ActionRow>
  </Panel>;
}
