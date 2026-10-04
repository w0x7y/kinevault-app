import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { View } from "react-native";
import { AppText, Panel } from "../components/ui";
import { DeleteButton } from "../components/delete-button";
import { useTheme } from "../theme/provider";
import { radius, spacing } from "../theme/tokens";
import { durationFromMinutes, type ExerciseSet, type SessionExercise, type WorkoutSession } from "./model";
import type { CompletedSessionDrafts, SessionDraft } from "./session-drafts";
import { useExercises } from "./provider";
import { ActionRow, ExerciseButton, ExerciseError, ExerciseField } from "./controls";
import { ExerciseSetTable } from "./set-table";
import { exerciseRowLabel, WorkoutWorkspace } from "./workout-workspace";

export type SessionEditorHandle = { flush: () => Promise<boolean> };
function localId() { return `set-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`; }

export function SessionEditor({ session, drafts, editorRef, onClose, manual = false, onManual }: {
  session: WorkoutSession; drafts: CompletedSessionDrafts; editorRef?: Ref<SessionEditorHandle>; onClose: () => void; manual?: boolean; onManual?: () => void;
}) {
  const store = useExercises(), storeRef = useRef(store);
  const { colors } = useTheme();
  storeRef.current = store;
  const sessionRef = useRef(session); sessionRef.current = session;
  const [draft, setDraft] = useState<SessionDraft>(() => {
    if (session.status === "completed") return drafts.open(session);
    return { name: session.name, exercises: session.exercises,
      minutes: session.durationSeconds === null ? "" : String(session.durationSeconds / 60) };
  });
  const draftRef = useRef(draft);
  const [busy, setBusy] = useState(false), busyRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState(session.exercises[0]?.id), [notesId, setNotesId] = useState<string | null>(null);
  const alive = useRef(true), revision = useRef(0);
  useEffect(() => {
    alive.current = true;
    if (session.status === "completed") drafts.write(session.id, draftRef.current);
    return () => { alive.current = false; };
  }, [drafts, session.id, session.status]);

  async function persist(value: SessionDraft, currentRevision: number): Promise<boolean> {
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
  function change(build: (previous: SessionDraft) => SessionDraft) {
    if (busyRef.current) return;
    const next = build(draftRef.current);
    draftRef.current = next; setDraft(next);
    const currentRevision = ++revision.current;
    // Persist captured raw text immediately; provider publications never replace local fields.
    if (sessionRef.current.status === "completed") drafts.write(session.id, next);
    else void persist(next, currentRevision);
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
  async function close() {
    if (await flush() && alive.current) { drafts.discard(session.id); onClose(); }
  }
  async function transition(kind: "start" | "complete" | "save" | "discard") {
    if (busyRef.current) return false;
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
    if (!alive.current) return success;
    setBusy(false);
    if (success) { if (kind !== "start") { drafts.discard(session.id); onClose(); } }
    else setError(previous => previous ?? (kind === "start" ? "Couldn't start. Another workout may already be active. Try again."
      : "Couldn't save. Enter a workout name and positive whole reps for each set; weight and minutes must be nonnegative numbers. Your fields are still here. Try again."));
    return success;
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
  function renderExercise(row: SessionExercise, index: number, workspace: boolean) {
    const rowLabel = exerciseRowLabel(draft.exercises, row, index);
    return <View key={row.id} style={{ gap: spacing.layout, minWidth: 0 }}>
      <AppText variant="heading" accessibilityRole="header">{row.exercise.name}</AppText>
      <ExerciseSetTable sets={row.sets} rowLabel={rowLabel} busy={busy}
        onChange={(setId, build) => setChange(row.id, setId, build)}
        onRemove={setId => rowChange(row.id, value => ({ ...value, sets: value.sets.filter(set => set.id !== setId) }))} />
      <ActionRow>
        <ExerciseButton label="Add set" accessibilityLabel={`Add set to ${rowLabel}`} disabled={busy}
          onPress={() => rowChange(row.id, value => ({ ...value,
            sets: [...value.sets, row.exercise.tracking === "single" ? { id: localId(), kind: "single", reps: "", weightKg: "" }
              : { id: localId(), kind: "sides", left: { reps: "", weightKg: "" }, right: { reps: "", weightKg: "" } }] }))} />
        {workspace && <ExerciseButton label="View notes" accessibilityLabel={`View notes for ${rowLabel}`} disabled={busy}
          onPress={() => setNotesId(previous => previous === row.id ? null : row.id)} />}
      </ActionRow>
      {(workspace ? notesId === row.id : Boolean(row.exercise.notes)) && <AppText variant="caption" muted>{row.exercise.notes || "No notes for this exercise."}</AppText>}
      <ActionRow>
        <ExerciseButton label="Up" accessibilityLabel={`Move ${rowLabel} in workout up`} disabled={busy || index === 0} onPress={() => move(index, -1)} />
        <ExerciseButton label="Down" accessibilityLabel={`Move ${rowLabel} in workout down`} disabled={busy || index === draft.exercises.length - 1} onPress={() => move(index, 1)} />
      </ActionRow>
      <DeleteButton label="Remove exercise" accessibilityLabel={`Remove ${rowLabel} from workout`} confirmAccessibilityLabel="Confirm remove exercise" disabled={busy}
        onDelete={() => change(value => ({ ...value, exercises: value.exercises.filter(item => item.id !== row.id) }))} />
      {workspace && <View testID="exercise-video-placeholder" accessibilityLabel="No exercise video available"
        style={{ minHeight: 220, borderWidth: 1, borderColor: colors.border, borderRadius: radius.panel,
          backgroundColor: colors.background, alignItems: "center", justifyContent: "center", padding: spacing.layout }}>
        <AppText muted style={{ textAlign: "center" }}>No video available</AppText>
      </View>}
    </View>;
  }
  const compact = session.status === "planned" && !manual;
  const selected = draft.exercises.find(row => row.id === selectedId) ?? draft.exercises[0];
  return <Panel testID="session-editor">
    {compact ? <View testID="planned-workout-card" style={{ gap: spacing.sm }}>
      <AppText variant="heading" accessibilityRole="header">{draft.name}</AppText>
      <AppText variant="caption" muted>{draft.exercises.length} exercises · {session.date}</AppText>
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <View style={{ flex: 1, minWidth: 0 }}><ExerciseButton label="Start workout" primary onPress={() => void transition("start")} disabled={busy} /></View>
        <View style={{ flex: 1, minWidth: 0 }}><ExerciseButton label="Log completed workout" onPress={() => onManual?.()} disabled={busy || !onManual} /></View>
      </View>
    </View> : <>
      <AppText variant="heading" accessibilityRole="header">{session.status === "completed" ? "Edit completed workout" : session.status === "active" ? draft.name : "Log workout"}</AppText>
      <AppText variant="caption" muted>{session.date} · {session.status === "active" ? "In progress" : session.status === "completed" ? "Completed" : "Enter your completed sets"}</AppText>
      {session.status !== "active" && <>
        <ExerciseField label="Workout name" value={draft.name} onChange={name => change(value => ({ ...value, name }))} disabled={busy} />
        <ExerciseField label="Duration in minutes (optional)" value={draft.minutes}
          onChange={minutes => change(value => ({ ...value, minutes }))} numeric disabled={busy} />
      </>}
      {session.status === "active" ? <WorkoutWorkspace exercises={draft.exercises} selectedId={selected?.id} onSelect={setSelectedId}
        onEnd={() => void transition("complete")} busy={busy}>
        {selected ? renderExercise(selected, draft.exercises.indexOf(selected), true)
          : <AppText muted>This workout has no exercises.</AppText>}
      </WorkoutWorkspace> : draft.exercises.map((row, index) => renderExercise(row, index, false))}
      <AppText variant="caption" muted>Blank weight means bodyweight. Left and right repetitions can differ; an unused side may stay blank.</AppText>
      {session.status === "active" && <ExerciseField label="Workout name" value={draft.name}
        onChange={name => change(value => ({ ...value, name }))} disabled={busy} />}
      <ActionRow>
        {session.status === "planned" && <ExerciseButton label="Start workout" onPress={() => void transition("start")} disabled={busy} />}
        {session.status !== "active" && <ExerciseButton label={session.status === "completed" ? "Save changes" : "Log completed workout"}
          onPress={() => void transition(session.status === "completed" ? "save" : "complete")} primary disabled={busy} />}
        <ExerciseButton label="Close workout" onPress={() => void close()} disabled={busy} />
        {session.status !== "completed" && <DeleteButton label="Discard workout" confirmAccessibilityLabel="Confirm discard workout"
          onDelete={() => transition("discard")} disabled={busy} />}
      </ActionRow>
    </>}
    <ExerciseError message={error} />
    {error && session.status !== "completed" && <ExerciseButton label="Retry draft save" onPress={() => void flush()} disabled={busy} />}
  </Panel>;
}
