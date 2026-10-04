import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { AppText, Panel, Screen } from "../../components/ui";
import { useDayActivity } from "../../daily/use-day";
import { SearchActions } from "../../daily/search-actions";
import { WorkoutWidget } from "../../daily/workout-widget";
import { ActionRow, ExerciseButton } from "../../exercise/controls";
import { ExerciseForm, WorkoutForm } from "../../exercise/library-forms";
import type { ExerciseDefinition, WorkoutTemplate } from "../../exercise/model";
import { NewSession } from "../../exercise/new-session";
import { useExercises } from "../../exercise/provider";
import { SessionEditor, type SessionEditorHandle } from "../../exercise/session-editor";
import { SessionList } from "../../exercise/session-list";
import { SessionPicker } from "../../exercise/session-picker";
import { ActiveWorkoutTimer } from "../../exercise/timer";
import { WorkoutLibrary } from "../../exercise/workout-library";
import { spacing } from "../../theme/tokens";

type Content = { kind: "exercise"; exercise?: ExerciseDefinition } | { kind: "workout"; workout?: WorkoutTemplate }
  | { kind: "library"; date: string } | { kind: "picker"; date: string; exercise: ExerciseDefinition }
  | { kind: "session"; id: string; addedExercise?: ExerciseDefinition } | { kind: "new-session"; date: string };
type OpenPanel = { content: Content; token: number };

export default function ExerciseScreen() {
  const activity = useDayActivity(), store = useExercises();
  const [query, setQuery] = useState(""), [panel, setPanel] = useState<OpenPanel | null>(null);
  const editorRef = useRef<SessionEditorHandle | null>(null), request = useRef(0), sequence = useRef(0), panelRef = useRef(panel);
  const alive = useRef(true);
  panelRef.current = panel;
  useEffect(() => { alive.current = true; return () => { alive.current = false; ++request.current; }; }, []);
  async function open(content: Content) {
    const ticket = ++request.current;
    if (editorRef.current && !(await editorRef.current.flush())) return;
    if (alive.current && ticket === request.current) setPanel({ content, token: ++sequence.current });
  }
  function close(token: number) { if (panelRef.current?.token === token) { ++request.current; setPanel(null); } }
  function created(token: number, id: string, addedExercise?: ExerciseDefinition) {
    if (panelRef.current?.token === token) { ++request.current; setPanel({ content: { kind: "session", id, addedExercise }, token: ++sequence.current }); }
  }
  async function start(id: string) {
    const ticket = ++request.current;
    if (editorRef.current && !(await editorRef.current.flush())) return false;
    if (!alive.current || ticket !== request.current) return false;
    const result = await store.startSession(id);
    if (result && alive.current && ticket === request.current) setPanel({ content: { kind: "session", id }, token: ++sequence.current });
    return result;
  }
  const document = store.state.kind === "ready" ? store.state.document : null;
  const active = document?.sessions.find(session => session.status === "active");
  const sessions = document?.sessions.filter(session => session.date === activity.date) ?? [];
  const normalized = query.trim().toLocaleLowerCase();
  const matches = document?.exercises.filter(exercise => [exercise.name, exercise.muscleGroup, exercise.equipment, exercise.notes]
    .some(text => text.toLocaleLowerCase().includes(normalized))) ?? [];
  const content = panel?.content;
  const editingSession = content?.kind === "session" ? document?.sessions.find(session => session.id === content.id) : null;
  const exerciseLibrary = document && <Panel testID="exercise-library">
    <AppText variant="heading" accessibilityRole="header">{normalized ? "Exercise search results" : "Your exercises"}</AppText>
    {document.exercises.length === 0 ? <AppText muted>No exercises yet. Create your first exercise to begin.</AppText>
      : matches.length === 0 ? <AppText muted>No exercises match your search.</AppText> : matches.map(exercise => <View key={exercise.id} style={{ gap: spacing.layout }}>
        <ExerciseButton label={exercise.name} accessibilityLabel={`Select exercise ${exercise.name}`}
          onPress={() => void open({ kind: "picker", date: activity.date, exercise })} />
        {Boolean(exercise.muscleGroup || exercise.equipment) && <AppText variant="caption" muted>{[exercise.muscleGroup, exercise.equipment].filter(Boolean).join(" · ")}</AppText>}
        <ActionRow><ExerciseButton label="Edit exercise" accessibilityLabel={`Edit exercise ${exercise.name}`}
          onPress={() => void open({ kind: "exercise", exercise })} /></ActionRow>
      </View>)}
  </Panel>;
  return <Screen title="Exercise" showTitle={false} adjustKeyboardInsets>
    {active && <ActiveWorkoutTimer session={active} onOpen={() => void open({ kind: "session", id: active.id })} />}
    <SearchActions kind="exercise" query={query} onQueryChange={setQuery} disabled={!document}
      onCreateExercise={() => void open({ kind: "exercise" })} onCreateWorkout={() => void open({ kind: "workout" })}
      onSavedWorkouts={() => void open({ kind: "library", date: activity.date })} />
    {Boolean(normalized) && exerciseLibrary}
    <WorkoutWidget workout={activity.workout} detailed sourceState={activity.workoutState} onRetry={store.retryLoad} />
    {document && panel && <View key={panel.token}>
      {content?.kind === "exercise" && <ExerciseForm exercise={content.exercise} onClose={() => close(panel.token)} />}
      {content?.kind === "workout" && <WorkoutForm workout={content.workout} onClose={() => close(panel.token)} />}
      {content?.kind === "library" && <WorkoutLibrary date={content.date} onClose={() => close(panel.token)}
        onEdit={workout => void open({ kind: "workout", workout })} onAdded={id => created(panel.token, id)} />}
      {content?.kind === "picker" && <SessionPicker date={content.date} exercise={content.exercise} onClose={() => close(panel.token)} onAdded={(id, exercise) => created(panel.token, id, exercise)} />}
      {content?.kind === "new-session" && <NewSession date={content.date} onClose={() => close(panel.token)} onCreated={id => created(panel.token, id)} />}
      {content?.kind === "session" && (editingSession ? <SessionEditor session={editingSession} addedExercise={content.addedExercise} editorRef={editorRef} onClose={() => close(panel.token)} />
        : <Panel><AppText>This session is no longer available.</AppText><ExerciseButton label="Close session" onPress={() => close(panel.token)} /></Panel>)}
    </View>}
    {document && <SessionList sessions={sessions} onStart={start} onOpen={id => void open({ kind: "session", id })}
      onNew={() => void open({ kind: "new-session", date: activity.date })} />}
    {!normalized && exerciseLibrary}
  </Screen>;
}
