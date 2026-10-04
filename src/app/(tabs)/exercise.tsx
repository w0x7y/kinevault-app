import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { View, type ScrollView } from "react-native";
import { parseDay } from "../../calendar/dates";
import { AppText, Panel, Screen } from "../../components/ui";
import { useDayActivity } from "../../daily/use-day";
import { SearchActions } from "../../daily/search-actions";
import { WorkoutWidget } from "../../daily/workout-widget";
import { ExerciseButton } from "../../exercise/controls";
import { ExerciseForm, WorkoutForm } from "../../exercise/library-forms";
import type { ExerciseDefinition, WorkoutTemplate } from "../../exercise/model";
import { useExercises } from "../../exercise/provider";
import { ExerciseSearchResults } from "../../exercise/search-results";
import { createCompletedSessionDrafts } from "../../exercise/session-drafts";
import { SessionEditor, type SessionEditorHandle } from "../../exercise/session-editor";
import { ActiveWorkoutTimer } from "../../exercise/timer";
import { WorkoutLibrary } from "../../exercise/workout-library";

type Content = { kind: "exercise"; exercise?: ExerciseDefinition } | { kind: "workout"; workout?: WorkoutTemplate }
  | { kind: "library"; date: string } | { kind: "session"; id: string };
type OpenPanel = { content: Content; token: number };

export default function ExerciseScreen() {
  const activity = useDayActivity(), store = useExercises();
  const { workoutMenu } = useLocalSearchParams<{ workoutMenu?: string | string[] }>();
  const router = useRouter();
  const consumedWorkoutMenu = useRef<string | string[] | null>(null);
  const [completedDrafts] = useState(createCompletedSessionDrafts);
  const [query, setQuery] = useState(""), [panel, setPanel] = useState<OpenPanel | null>(null);
  const scrollRef = useRef<ScrollView>(null), resultsTop = useRef(0), scrolledPanel = useRef<number | null>(null);
  const editorRef = useRef<SessionEditorHandle | null>(null), request = useRef(0), sequence = useRef(0), panelRef = useRef(panel);
  const alive = useRef(true);
  panelRef.current = panel;
  useEffect(() => { alive.current = true; return () => { alive.current = false; ++request.current; }; }, []);
  const open = useCallback(async (content: Content) => {
    const ticket = ++request.current;
    if (editorRef.current && !(await editorRef.current.flush())) return;
    if (alive.current && ticket === request.current) setPanel({ content, token: ++sequence.current });
  }, []);
  function close(token: number) { if (alive.current && panelRef.current?.token === token) { ++request.current; setPanel(null); } }
  function created(token: number, id: string) {
    if (alive.current && panelRef.current?.token === token) { ++request.current; setPanel({ content: { kind: "session", id }, token: ++sequence.current }); }
  }
  const document = store.state.kind === "ready" ? store.state.document : null;
  useEffect(() => {
    if (workoutMenu === undefined) { consumedWorkoutMenu.current = null; return; }
    if (!document || consumedWorkoutMenu.current === workoutMenu) return;
    consumedWorkoutMenu.current = workoutMenu;
    router.setParams({ workoutMenu: undefined });
    if (typeof workoutMenu !== "string") return;
    try { parseDay(workoutMenu); } catch { return; }
    void open({ kind: "library", date: workoutMenu });
  }, [workoutMenu, document, router, open]);
  useEffect(() => { if (document) completedDrafts.prune(document.sessions.map(session => session.id)); }, [document, completedDrafts]);
  const active = document?.sessions.find(session => session.status === "active");
  const activeOnDate = active?.date === activity.date ? active : null;
  const normalized = query.trim().toLocaleLowerCase();
  const content = panel?.content;
  const editingSession = content?.kind === "session" ? document?.sessions.find(session => session.id === content.id) : null;
  function scrollToResults() { scrollRef.current?.scrollTo({ y: resultsTop.current, animated: false }); }
  return <Screen title="Exercise" showTitle={false} scrollRef={scrollRef} adjustKeyboardInsets>
    {active && <ActiveWorkoutTimer session={active} onOpen={() => void open({ kind: "session", id: active.id })} />}
    <SearchActions kind="exercise" query={query} onQueryChange={setQuery} disabled={!document}
      onCreateExercise={() => void open({ kind: "exercise" })} onCreateWorkout={() => void open({ kind: "workout" })}
      onSavedWorkouts={() => void open({ kind: "library", date: activity.date })} />
    {document && Boolean(normalized) && <ExerciseSearchResults key={normalized} query={query} exercises={document.exercises}
      onLayout={event => { resultsTop.current = event.nativeEvent.layout.y; }} onNavigate={scrollToResults}
      onSelect={exercise => void open({ kind: "exercise", exercise })} />}
    <WorkoutWidget workout={activity.workout} detailed showEmptyGuidance activeWorkoutName={activeOnDate?.name || (activeOnDate ? "Active workout" : undefined)}
      sourceState={activity.workoutState} onRetry={store.retryLoad} onAddWorkout={() => void open({ kind: "library", date: activity.date })} />
    {document && panel && <View key={panel.token} onLayout={event => {
      if ((content?.kind === "exercise" || content?.kind === "library") && scrolledPanel.current !== panel.token) {
        scrolledPanel.current = panel.token;
        scrollRef.current?.scrollTo({ y: event.nativeEvent.layout.y, animated: false });
      }
    }}>
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
