import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { View, type ScrollView } from "react-native";
import { parseDay } from "../../calendar/dates";
import { AppText, Panel, Screen } from "../../components/ui";
import { useDayActivity } from "../../daily/use-day";
import { SearchActions } from "../../daily/search-actions";
import { WorkoutWidget } from "../../daily/workout-widget";
import { ExerciseButton } from "../../exercise/controls";
import { ExerciseForm, WorkoutForm } from "../../exercise/library-forms";
import { useExercises } from "../../exercise/provider";
import { ExerciseSearchResults } from "../../exercise/search-results";
import { SessionEditor } from "../../exercise/session-editor";
import { useWorkoutEditing } from "../../exercise/use-workout-editing";
import { WorkoutLibrary } from "../../exercise/workout-library";

export default function ExerciseScreen() {
  const activity = useDayActivity(),
    store = useExercises();
  const { workoutMenu } = useLocalSearchParams<{ workoutMenu?: string | string[] }>();
  const router = useRouter();
  const consumedWorkoutMenu = useRef<string | string[] | null>(null);
  const { editing, panel } = useWorkoutEditing();
  const open = editing.requestView;
  const [query, setQuery] = useState("");
  const scrollRef = useRef<ScrollView>(null),
    resultsTop = useRef(0),
    scrolledPanel = useRef<number | null>(null);
  const document = store.state.kind === "ready" ? store.state.document : null;
  useEffect(() => {
    if (workoutMenu === undefined) {
      consumedWorkoutMenu.current = null;
      return;
    }
    if (!document || consumedWorkoutMenu.current === workoutMenu) return;
    consumedWorkoutMenu.current = workoutMenu;
    router.setParams({ workoutMenu: undefined });
    if (typeof workoutMenu !== "string") return;
    try {
      parseDay(workoutMenu);
    } catch {
      return;
    }
    void open({ kind: "library", date: workoutMenu });
  }, [workoutMenu, document, router, open]);
  const active = document?.sessions.find((session) => session.status === "active");
  const activeOnDate = active?.date === activity.date ? active : null;
  const normalized = query.trim().toLocaleLowerCase();
  const content = panel?.content;
  const planned =
    document?.sessions.filter(
      (session) => session.date === activity.date && session.status === "planned",
    ) ?? [];
  // The edit owner preserves fields across panel, search and calendar changes.
  const defaultWorkspace = !panel ? active : null;
  const showDailyWorkout =
    activity.workoutState !== "ready" ||
    (!panel &&
      !normalized &&
      !defaultWorkspace &&
      (planned.length === 0 || activity.workout.name !== null));
  const editingSession =
    content?.kind === "session"
      ? document?.sessions.find((session) => session.id === content.id)
      : null;
  function scrollToResults() {
    scrollRef.current?.scrollTo({ y: resultsTop.current, animated: false });
  }
  return (
    <Screen title="Exercise" showTitle={false} scrollRef={scrollRef} adjustKeyboardInsets>
      <SearchActions
        kind="exercise"
        query={query}
        onQueryChange={setQuery}
        disabled={!document}
        onCreateExercise={() => void open({ kind: "exercise" })}
        onCreateWorkout={() => void open({ kind: "workout" })}
        onSavedWorkouts={() => void open({ kind: "library", date: activity.date })}
      />
      {document && Boolean(normalized) && (
        <ExerciseSearchResults
          key={normalized}
          query={query}
          exercises={document.exercises}
          onLayout={(event) => {
            resultsTop.current = event.nativeEvent.layout.y;
          }}
          onNavigate={scrollToResults}
          onSelect={(exercise) => void open({ kind: "exercise", exercise })}
        />
      )}
      {showDailyWorkout && (
        <WorkoutWidget
          workout={activity.workout}
          detailed
          showEmptyGuidance
          activeWorkoutName={activeOnDate?.name || (activeOnDate ? "Active workout" : undefined)}
          sourceState={activity.workoutState}
          onRetry={store.retryLoad}
          onAddWorkout={() => void open({ kind: "library", date: activity.date })}
        />
      )}
      {document &&
        !panel &&
        !normalized &&
        !defaultWorkspace &&
        planned.map((session) => (
          <View key={session.id} testID={`planned-workout-${session.id}`}>
            <SessionEditor editing={editing} session={session} />
          </View>
        ))}
      {defaultWorkspace && (
        <SessionEditor
          key={`workspace-${defaultWorkspace.id}`}
          editing={editing}
          session={defaultWorkspace}
        />
      )}
      {document && panel && (
        <View
          key={panel.token}
          onLayout={(event) => {
            if (
              (content?.kind === "exercise" || content?.kind === "library") &&
              scrolledPanel.current !== panel.token
            ) {
              scrolledPanel.current = panel.token;
              scrollRef.current?.scrollTo({ y: event.nativeEvent.layout.y, animated: false });
            }
          }}
        >
          {content?.kind === "exercise" && (
            <ExerciseForm
              exercise={content.exercise}
              onClose={() => editing.closeView(panel.token)}
            />
          )}
          {content?.kind === "workout" && (
            <WorkoutForm workout={content.workout} onClose={() => editing.closeView(panel.token)} />
          )}
          {content?.kind === "library" && (
            <WorkoutLibrary
              date={content.date}
              onClose={() => editing.closeView(panel.token)}
              onEdit={(workout) => void open({ kind: "workout", workout })}
              onAdded={(id) => editing.createdSession(panel.token, id)}
              onOpen={(id) => void open({ kind: "session", id })}
            />
          )}
          {content?.kind === "session" &&
            (editingSession ? (
              <SessionEditor
                editing={editing}
                session={editingSession}
                manual={content.manual}
                initialSettings={content.settings}
              />
            ) : (
              <Panel>
                <AppText>This workout is no longer available.</AppText>
                <ExerciseButton
                  label="Close workout"
                  onPress={() => editing.closeView(panel.token)}
                />
              </Panel>
            ))}
        </View>
      )}
    </Screen>
  );
}
