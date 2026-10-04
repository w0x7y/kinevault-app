import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { View } from "react-native";
import { AppText, Panel } from "../components/ui";
import { DeleteButton } from "../components/delete-button";
import { useTheme } from "../theme/provider";
import { radius, spacing } from "../theme/tokens";
import { createEmptySet, durationFromMinutes, isBlankSet, type ExerciseSet, type SessionExercise, type WorkoutSession } from "./model";
import type { CompletedSessionDrafts, SessionDraft } from "./session-drafts";
import { useExercises } from "./provider";
import { ExerciseButton, ExerciseError, ExerciseField, ExerciseIconButton } from "./controls";
import { ExerciseSetTable } from "./set-table";
import { exerciseRowLabel, WorkoutWorkspace } from "./workout-workspace";
import { ActiveWorkoutTimer } from "./timer";

export type SessionEditorHandle = { flush: () => Promise<boolean> };
function localId() { return `set-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`; }

export function SessionEditor({ session, drafts, editorRef, onClose, manual = false, onManual, initialSettings = false, onSettings }: {
  session: WorkoutSession; drafts: CompletedSessionDrafts; editorRef?: Ref<SessionEditorHandle>; onClose: () => void;
  manual?: boolean; onManual?: () => void; initialSettings?: boolean; onSettings?: () => void;
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
  const [settingsOpen, setSettingsOpen] = useState(initialSettings), [settingsError, setSettingsError] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, string>>(() => Object.fromEntries(session.exercises.map(row => [row.id, String(row.sets.length)])));
  const countsRef = useRef(counts);
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
    if (alive.current && revision.current === currentRevision) setError(!result ? "Couldn't save your draft. Your fields are still here. Retry draft save before leaving the workout."
      : invalidMinutes ? "Enter a nonnegative duration in minutes or leave it blank before leaving the workout. Your sets have been saved." : null);
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
  function countProblem(row: SessionExercise, raw: string): string | null {
    const text = raw.trim(), count = Number(text);
    if (!/^\d+$/.test(text) || !Number.isSafeInteger(count) || count < 0 || count > 100) return `Enter a whole planned set count from 0 to 100 for ${row.exercise.name}.`;
    const lastEntered = row.sets.reduce((last, set, index) => isBlankSet(set) ? last : index, -1);
    return count <= lastEntered ? `${row.exercise.name} has entered values in later sets. Keep at least ${lastEntered + 1} sets.` : null;
  }
  function validateSettings() {
    if (!settingsOpen || manual || sessionRef.current.status !== "planned") return true;
    const problem = draftRef.current.exercises.map(row => countProblem(row, countsRef.current[row.id] ?? String(row.sets.length))).find(Boolean) ?? null;
    setSettingsError(problem);
    return !problem;
  }
  function changeCount(rowId: string, raw: string) {
    if (busyRef.current) return;
    const next = { ...countsRef.current, [rowId]: raw };
    countsRef.current = next; setCounts(next);
    const row = draftRef.current.exercises.find(item => item.id === rowId);
    if (!row) return;
    const problem = countProblem(row, raw);
    if (!problem) {
      const count = Number(raw.trim());
      rowChange(rowId, value => ({ ...value, sets: count <= value.sets.length ? value.sets.slice(0, count)
        : [...value.sets, ...Array.from({ length: count - value.sets.length }, () => createEmptySet(value.exercise.tracking, localId()))] }));
    }
    validateSettings();
  }
  async function flush() {
    if (busyRef.current) return false;
    if (!validateSettings()) return false;
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
    if (kind !== "discard" && !validateSettings()) return false;
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
  function renderExercise(row: SessionExercise, index: number) {
    const rowLabel = exerciseRowLabel(draft.exercises, row, index);
    return <View key={row.id} style={{ gap: spacing.layout, minWidth: 0 }}>
      <View testID="exercise-detail-heading" style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, minWidth: 0 }}>
        <AppText variant="heading" accessibilityRole="header" style={{ flex: 1, minWidth: 0 }}>{row.exercise.name}</AppText>
        <ExerciseIconButton icon="plus" label={`Add set to ${rowLabel}`} disabled={busy}
          onPress={() => rowChange(row.id, value => ({ ...value,
            sets: [...value.sets, createEmptySet(row.exercise.tracking, localId())] }))} />
        <ExerciseIconButton icon="note-sticky" label={`View notes for ${rowLabel}`} disabled={busy}
          onPress={() => setNotesId(previous => previous === row.id ? null : row.id)} />
      </View>
      <ExerciseSetTable sets={row.sets} rowLabel={rowLabel} busy={busy}
        onChange={(setId, build) => setChange(row.id, setId, build)} />
      {notesId === row.id && <AppText variant="caption" muted>{row.exercise.notes || "No notes for this exercise."}</AppText>}
      <View testID="exercise-video-placeholder" accessibilityLabel="No exercise video available"
        style={{ minHeight: 220, borderWidth: 1, borderColor: colors.border, borderRadius: radius.panel,
          backgroundColor: colors.background, alignItems: "center", justifyContent: "center", padding: spacing.layout }}>
        <AppText muted style={{ textAlign: "center" }}>No video available</AppText>
      </View>
    </View>;
  }
  const compact = session.status === "planned" && !manual;
  const selected = draft.exercises.find(row => row.id === selectedId) ?? draft.exercises[0];
  const feedback = <>
    <ExerciseError message={error} />
    {error && session.status !== "completed" && <ExerciseButton label="Retry draft save" onPress={() => void flush()} disabled={busy} />}
  </>;
  const active = session.status === "active";
  const toolbar = !active && <>
    <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
      <ExerciseIconButton label="Settings" icon="gear" disabled={busy} onPress={() => setSettingsOpen(previous => !previous)} />
      <ExerciseIconButton label="Cancel" icon="xmark" disabled={busy} onPress={() => void close()} />
      {session.status === "planned" && <View style={{ flex: 1, minWidth: 0 }}><ExerciseButton label="Start workout"
        onPress={() => void transition("start")} disabled={busy} /></View>}
    </View>
    {settingsOpen && <View testID="workout-log-settings" style={{ gap: spacing.layout }}>
      <ExerciseField label="Workout name" value={draft.name} onChange={name => change(value => ({ ...value, name }))} disabled={busy} />
      <ExerciseField label="Duration in minutes (optional)" value={draft.minutes}
        onChange={minutes => change(value => ({ ...value, minutes }))} numeric disabled={busy} />
    </View>}
  </>;
  const actions = <View testID="workout-log-actions" style={{ flexDirection: "row", gap: spacing.sm }}>
    {session.status !== "completed" && <View style={{ flex: 1, minWidth: 0 }}><DeleteButton label="Discard workout"
      confirmAccessibilityLabel="Confirm discard workout" onDelete={() => transition("discard")} disabled={busy} fill /></View>}
    <View style={{ flex: 1, minWidth: 0 }}><ExerciseButton label={active ? "End workout" : session.status === "completed" ? "Save changes" : "Log completed workout"}
      onPress={() => void transition(active || session.status === "planned" ? "complete" : "save")} primary disabled={busy} fill /></View>
  </View>;
  return <Panel testID="session-editor">
    {compact ? <View testID="planned-workout-card" style={{ gap: spacing.sm }}>
      <AppText variant="heading" accessibilityRole="header">{draft.name}</AppText>
      <AppText variant="caption" muted>{draft.exercises.length} exercises · {session.date}</AppText>
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <View style={{ flex: 1, minWidth: 0 }}><ExerciseButton label="Start workout" primary onPress={() => void transition("start")} disabled={busy} /></View>
        <View style={{ flex: 1, minWidth: 0 }}><ExerciseButton label="Log completed workout" onPress={() => onManual?.()} disabled={busy || !onManual} /></View>
      </View>
      <ExerciseButton label="Settings" onPress={() => onSettings ? onSettings() : setSettingsOpen(true)} disabled={busy} />
      {settingsOpen && <View testID="planned-workout-settings" style={{ gap: spacing.layout }}>
        <AppText variant="label">Planned sets</AppText>
        {draft.exercises.map((row, index) => <ExerciseField key={row.id} label={`Planned sets for ${exerciseRowLabel(draft.exercises, row, index)}`}
          value={counts[row.id] ?? String(row.sets.length)} onChange={raw => changeCount(row.id, raw)} numeric disabled={busy} />)}
        <ExerciseError message={settingsError} />
        <ExerciseButton label="Save settings" onPress={() => { void (async () => {
          if (await flush() && alive.current) setSettingsOpen(false);
        })(); }} disabled={busy} />
      </View>}
      {feedback}
    </View> : <WorkoutWorkspace name={draft.name} testID={active ? "active-workout-workspace" : session.status === "completed" ? "completed-workout-workspace" : "manual-workout-workspace"}
      headerRight={active ? <ActiveWorkoutTimer session={session} /> : <AppText variant="caption" muted accessibilityLabel="Workout duration">{draft.minutes.trim() ? `${draft.minutes} min` : "Duration not set"}</AppText>}
      toolbar={toolbar} exercises={draft.exercises} selectedId={selected?.id} onSelect={setSelectedId}
      busy={busy} feedback={feedback} actions={actions}>
      {selected ? renderExercise(selected, draft.exercises.indexOf(selected))
        : <AppText muted>This workout has no exercises.</AppText>}
    </WorkoutWorkspace>}
  </Panel>;
}
