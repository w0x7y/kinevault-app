import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { View } from "react-native";
import { AppText, Panel } from "../components/ui";
import { spacing } from "../theme/tokens";
import { durationFromMinutes, type ExerciseDefinition, type ExerciseSet, type SessionExercise, type WorkoutSession } from "./model";
import { useExercises } from "./provider";
import { ActionRow, ConfirmAction, ExerciseButton, ExerciseError, ExerciseField } from "./controls";

export type SessionEditorHandle = { flush: () => Promise<boolean> };
type Draft = { name: string; exercises: SessionExercise[]; minutes: string };
type Removal = { kind: "session" } | { kind: "exercise"; rowId: string } | { kind: "set"; rowId: string; setId: string };
function localId() { return `set-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`; }

export function SessionEditor({ session, addedExercise, editorRef, onClose }: {
  session: WorkoutSession; addedExercise?: ExerciseDefinition; editorRef?: Ref<SessionEditorHandle>; onClose: () => void;
}) {
  const store = useExercises(), storeRef = useRef(store);
  storeRef.current = store;
  const sessionRef = useRef(session); sessionRef.current = session;
  const [draft, setDraft] = useState<Draft>(() => ({ name: session.name, exercises: addedExercise ? [...session.exercises, { id: localId(), exercise: { ...addedExercise }, sets: [] }] : session.exercises,
    minutes: session.durationSeconds === null ? "" : String(session.durationSeconds / 60) }));
  const draftRef = useRef(draft);
  const [busy, setBusy] = useState(false), busyRef = useRef(false);
  const [error, setError] = useState<string | null>(null), [confirmation, setConfirmation] = useState<Removal | null>(null);
  const alive = useRef(true), revision = useRef(0);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  async function persist(value: Draft, currentRevision: number): Promise<boolean> {
    let durationSeconds: number | null | undefined;
    let invalidMinutes = false;
    if (sessionRef.current.status === "planned") {
      try { durationSeconds = durationFromMinutes(value.minutes); } catch { invalidMinutes = true; }
    }
    const result = await storeRef.current.updateSession({ id: session.id, name: value.name, exercises: value.exercises, durationSeconds });
    if (alive.current && revision.current === currentRevision) setError(!result ? "Couldn't save your draft. Your fields are still here. Retry draft save or close again."
      : invalidMinutes ? "Enter a nonnegative duration in minutes or leave it blank before closing. Your sets have been saved." : null);
    return result && !invalidMinutes;
  }
  function change(build: (previous: Draft) => Draft) {
    if (busyRef.current) return;
    const next = build(draftRef.current);
    draftRef.current = next; setDraft(next);
    const currentRevision = ++revision.current;
    // Persist captured raw text immediately; provider publications never replace local fields.
    if (sessionRef.current.status !== "completed") void persist(next, currentRevision);
  }
  async function flush() {
    if (busyRef.current) return false;
    if (sessionRef.current.status === "completed") return true;
    busyRef.current = true; setBusy(true);
    const result = await persist(draftRef.current, revision.current);
    if (alive.current) setBusy(false);
    busyRef.current = false;
    return result;
  }
  useImperativeHandle(editorRef, () => ({ flush }));
  async function close() { if (await flush() && alive.current) onClose(); }
  async function transition(kind: "start" | "complete" | "save" | "discard") {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(null);
    const value = draftRef.current;
    let success = false;
    try {
      if (kind === "discard") success = await storeRef.current.removeSession(session.id);
      else if (kind === "start") {
        success = await storeRef.current.updateSession({ id: session.id, name: value.name, exercises: value.exercises });
        if (success && alive.current) success = await storeRef.current.startSession(session.id);
      } else if (kind === "complete") success = await storeRef.current.completeSession({ id: session.id, name: value.name,
        exercises: value.exercises, durationMinutes: value.minutes });
      else success = await storeRef.current.updateSession({ id: session.id, name: value.name, exercises: value.exercises,
        durationSeconds: durationFromMinutes(value.minutes) });
    } catch (reason) {
      if (alive.current) setError(reason instanceof Error ? reason.message : "Check your workout values and try again.");
    }
    busyRef.current = false;
    if (!alive.current) return;
    setBusy(false);
    if (success) { if (kind !== "start") onClose(); }
    else setError(previous => previous ?? (kind === "start" ? "Couldn't start. Another workout may already be active. Try again."
      : "Couldn't save. Enter a session name and positive whole reps for each set; weight and minutes must be nonnegative numbers. Your fields are still here. Try again."));
  }
  function rowChange(rowId: string, build: (row: SessionExercise) => SessionExercise) {
    change(value => ({ ...value, exercises: value.exercises.map(row => row.id === rowId ? build(row) : row) }));
  }
  function setChange(rowId: string, setId: string, build: (set: ExerciseSet) => ExerciseSet) {
    rowChange(rowId, row => ({ ...row, sets: row.sets.map(set => set.id === setId ? build(set) : set) }));
  }
  function move(index: number, direction: number) {
    change(value => { const exercises = [...value.exercises]; [exercises[index], exercises[index + direction]] = [exercises[index + direction]!, exercises[index]!]; return { ...value, exercises }; });
  }
  function confirmRemoval() {
    if (!confirmation) return;
    if (confirmation.kind === "session") { void transition("discard"); return; }
    const removal = confirmation;
    if (removal.kind === "exercise") change(value => ({ ...value, exercises: value.exercises.filter(row => row.id !== removal.rowId) }));
    else rowChange(removal.rowId, row => ({ ...row, sets: row.sets.filter(set => set.id !== removal.setId) }));
    setConfirmation(null);
  }
  return <Panel testID="session-editor">
    <AppText variant="heading" accessibilityRole="header">{session.status === "completed" ? "Edit completed workout" : session.status === "active" ? "Active workout" : "Workout session"}</AppText>
    <AppText variant="caption" muted>{session.date} · {session.status}</AppText>
    <ExerciseField label="Session name" value={draft.name} onChange={name => change(value => ({ ...value, name }))} disabled={busy} />
    {session.status !== "active" && <ExerciseField label="Duration in minutes (optional)" value={draft.minutes}
      onChange={minutes => change(value => ({ ...value, minutes }))} numeric disabled={busy} />}
    {draft.exercises.length === 0 && <AppText muted>Search your exercise library to add exercises to this session.</AppText>}
    {draft.exercises.map((row, index) => {
      const rowLabel = draft.exercises.filter(item => item.exercise.name === row.exercise.name).length > 1
        ? `${row.exercise.name} exercise ${index + 1}` : row.exercise.name;
      return <View key={row.id} style={{ gap: spacing.layout }}>
      <AppText variant="heading">{row.exercise.name}</AppText>
      {Boolean(row.exercise.notes) && <AppText variant="caption" muted>{row.exercise.notes}</AppText>}
      <ActionRow>
        <ExerciseButton label="Up" accessibilityLabel={`Move ${rowLabel} in session up`} disabled={busy || index === 0} onPress={() => move(index, -1)} />
        <ExerciseButton label="Down" accessibilityLabel={`Move ${rowLabel} in session down`} disabled={busy || index === draft.exercises.length - 1} onPress={() => move(index, 1)} />
        <ExerciseButton label="Remove exercise" accessibilityLabel={`Remove ${rowLabel} from session`} disabled={busy}
          onPress={() => setConfirmation({ kind: "exercise", rowId: row.id })} />
      </ActionRow>
      {row.sets.map((set, setIndex) => {
        const prefix = `${rowLabel} set ${setIndex + 1}`;
        return <View key={set.id} style={{ gap: spacing.layout }}>
          <AppText variant="label">Set {setIndex + 1}</AppText>
          {set.kind === "single" ? <View style={{ flexDirection: "row", gap: spacing.layout }}>
            <View style={{ flex: 1, minWidth: 0 }}><ExerciseField label={`${prefix} reps`} value={set.reps} numeric disabled={busy}
              onChange={reps => setChange(row.id, set.id, previous => previous.kind === "single" ? { ...previous, reps } : previous)} /></View>
            <View style={{ flex: 1, minWidth: 0 }}><ExerciseField label={`${prefix} weight (kg)`} value={set.weightKg} numeric disabled={busy}
              onChange={weightKg => setChange(row.id, set.id, previous => previous.kind === "single" ? { ...previous, weightKg } : previous)} /></View>
          </View> : (["left", "right"] as const).map(side => <View key={side} style={{ flexDirection: "row", gap: spacing.layout }}>
            <View style={{ flex: 1, minWidth: 0 }}><ExerciseField label={`${prefix} ${side} reps`} value={set[side].reps} numeric disabled={busy}
              onChange={reps => setChange(row.id, set.id, previous => previous.kind === "sides" ? { ...previous, [side]: { ...previous[side], reps } } : previous)} /></View>
            <View style={{ flex: 1, minWidth: 0 }}><ExerciseField label={`${prefix} ${side} weight (kg)`} value={set[side].weightKg} numeric disabled={busy}
              onChange={weightKg => setChange(row.id, set.id, previous => previous.kind === "sides" ? { ...previous, [side]: { ...previous[side], weightKg } } : previous)} /></View>
          </View>)}
          <ExerciseButton label="Remove set" accessibilityLabel={`Remove ${prefix}`} disabled={busy}
            onPress={() => setConfirmation({ kind: "set", rowId: row.id, setId: set.id })} />
        </View>;
      })}
      <ExerciseButton label="Add set" accessibilityLabel={`Add set to ${rowLabel}`} disabled={busy} onPress={() => rowChange(row.id, value => ({ ...value,
        sets: [...value.sets, row.exercise.tracking === "single" ? { id: localId(), kind: "single", reps: "", weightKg: "" }
          : { id: localId(), kind: "sides", left: { reps: "", weightKg: "" }, right: { reps: "", weightKg: "" } }] }))} />
    </View>; })}
    <AppText variant="caption" muted>Blank weight means bodyweight. Left and right repetitions can differ; an unused side may stay blank.</AppText>
    <ExerciseError message={error} />
    {error && session.status !== "completed" && <ExerciseButton label="Retry draft save" onPress={() => void flush()} disabled={busy} />}
    <ActionRow>
      {session.status === "planned" && <ExerciseButton label="Start workout" onPress={() => void transition("start")} disabled={busy} />}
      <ExerciseButton label={session.status === "active" ? "Finish workout" : session.status === "completed" ? "Save changes" : "Log completed workout"}
        onPress={() => void transition(session.status === "completed" ? "save" : "complete")} primary disabled={busy} />
      <ExerciseButton label="Close session" onPress={() => void close()} disabled={busy} />
      {session.status !== "completed" && <ExerciseButton label="Discard session" onPress={() => setConfirmation({ kind: "session" })} disabled={busy} />}
    </ActionRow>
    {confirmation && <ConfirmAction question={confirmation.kind === "session" ? "Discard this session and all entered sets?" : confirmation.kind === "set" ? "Remove this set?" : "Remove this exercise and its sets?"}
      label={confirmation.kind === "session" ? "Confirm discard session" : confirmation.kind === "set" ? "Confirm remove set" : "Confirm remove exercise"}
      onConfirm={confirmRemoval} onCancel={() => setConfirmation(null)} disabled={busy} />}
  </Panel>;
}
