import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { AppText, Panel, Screen } from "../../components/ui";
import { useDayActivity } from "../../daily/use-day";
import { SearchActions } from "../../daily/search-actions";
import { WorkoutWidget } from "../../daily/workout-widget";
import { ExerciseButton } from "../../exercise/controls";
import { ExerciseForm, WorkoutForm } from "../../exercise/library-forms";
import type { ExerciseDefinition, WorkoutTemplate } from "../../exercise/model";
import { useExercises } from "../../exercise/provider";
import { createCompletedSessionDrafts } from "../../exercise/session-drafts";
import { SessionEditor, type SessionEditorHandle } from "../../exercise/session-editor";
import { ActiveWorkoutTimer } from "../../exercise/timer";
import { WorkoutLibrary } from "../../exercise/workout-library";
import { spacing } from "../../theme/tokens";

type Content = { kind: "exercise"; exercise?: ExerciseDefinition } | { kind: "workout"; workout?: WorkoutTemplate }
  | { kind: "library"; date: string } | { kind: "session"; id: string };
type OpenPanel = { content: Content; token: number };

export default function ExerciseScreen() {
  const activity = useDayActivity(), store = useExercises();
  const [completedDrafts] = useState(createCompletedSessionDrafts);
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
  function close(token: number) { if (alive.current && panelRef.current?.token === token) { ++request.current; setPanel(null); } }
  function created(token: number, id: string) {
    if (alive.current && panelRef.current?.token === token) { ++request.current; setPanel({ content: { kind: "session", id }, token: ++sequence.current }); }
  }
  const document = store.state.kind === "ready" ? store.state.document : null;
  useEffect(() => { if (document) completedDrafts.prune(document.sessions.map(session => session.id)); }, [document, completedDrafts]);
  const active = document?.sessions.find(session => session.status === "active");
  const activeOnDate = active?.date === activity.date ? active : null;
  const normalized = query.trim().toLocaleLowerCase();
  const matches = document?.exercises.filter(exercise => [exercise.name, exercise.muscleGroup, exercise.equipment, exercise.notes]
    .some(text => text.toLocaleLowerCase().includes(normalized))) ?? [];
  const content = panel?.content;
  const editingSession = content?.kind === "session" ? document?.sessions.find(session => session.id === content.id) : null;
  const exerciseLibrary = document && Boolean(normalized) && <Panel testID="exercise-library">
    <AppText variant="heading" accessibilityRole="header">Exercise search results</AppText>
    {matches.length === 0 ? <AppText muted>No exercises match your search.</AppText> : matches.map(exercise => <View key={exercise.id} style={{ gap: spacing.layout }}>
        <ExerciseButton label={exercise.name} accessibilityLabel={`Edit exercise ${exercise.name}`}
          onPress={() => void open({ kind: "exercise", exercise })} />
        {Boolean(exercise.muscleGroup || exercise.equipment) && <AppText variant="caption" muted>{[exercise.muscleGroup, exercise.equipment].filter(Boolean).join(" · ")}</AppText>}
      </View>)}
  </Panel>;
  return <Screen title="Exercise" showTitle={false} adjustKeyboardInsets>
    {active && <ActiveWorkoutTimer session={active} onOpen={() => void open({ kind: "session", id: active.id })} />}
    <SearchActions kind="exercise" query={query} onQueryChange={setQuery} disabled={!document}
      onCreateExercise={() => void open({ kind: "exercise" })} onCreateWorkout={() => void open({ kind: "workout" })}
      onSavedWorkouts={() => void open({ kind: "library", date: activity.date })} />
    {exerciseLibrary}
    <WorkoutWidget workout={activity.workout} detailed showEmptyGuidance activeWorkoutName={activeOnDate?.name || (activeOnDate ? "Active workout" : undefined)}
      sourceState={activity.workoutState} onRetry={store.retryLoad} />
    {document && panel && <View key={panel.token}>
      {content?.kind === "exercise" && <ExerciseForm exercise={content.exercise} onClose={() => close(panel.token)} />}
      {content?.kind === "workout" && <WorkoutForm workout={content.workout} onClose={() => close(panel.token)} />}
      {content?.kind === "library" && <WorkoutLibrary date={content.date} onClose={() => close(panel.token)}
        onEdit={workout => void open({ kind: "workout", workout })} onAdded={id => created(panel.token, id)}
        onOpen={id => void open({ kind: "session", id })} />}
      {content?.kind === "session" && (editingSession ? <SessionEditor drafts={completedDrafts} session={editingSession} editorRef={editorRef} onClose={() => close(panel.token)} />
        : <Panel><AppText>This workout is no longer available.</AppText><ExerciseButton label="Close workout" onPress={() => close(panel.token)} /></Panel>)}
    </View>}
  </Screen>;
}
