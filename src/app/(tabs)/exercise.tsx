import { AppButton } from "../../components/button";
import { useRef, useState } from "react";
import { View, type ScrollView } from "react-native";
import { parseDay } from "../../calendar/dates";
import { AppText, Panel, Screen } from "../../components/ui";
import { useDayActivity } from "../../daily/use-day";
import { SearchActions } from "../../daily/search-actions";
import { WorkoutWidget } from "../../daily/workout-widget";
import { exerciseDayLayout } from "../../exercise/day-layout";
import { WorkoutImport } from "../../exercise/import/workout-import";
import { ExerciseForm, WorkoutForm } from "../../exercise/library-forms";
import { useExercises } from "../../exercise/provider";
import { ExerciseSearchResults } from "../../exercise/search-results";
import { SessionEditor } from "../../exercise/session-editor";
import { useWorkoutEditing } from "../../exercise/use-workout-editing";
import { WorkoutLibrary } from "../../exercise/workout-library";
import { useRouteRequest } from "../../navigation/use-route-request";

export default function ExerciseScreen() {
  const activity = useDayActivity(),
    store = useExercises();
  const { editing, panel: openPanel } = useWorkoutEditing();
  const open = editing.requestView;
  const [query, setQuery] = useState("");
  const scrollRef = useRef<ScrollView>(null),
    resultsTop = useRef(0),
    scrolledPanel = useRef<number | null>(null);
  const document = store.state.kind === "ready" ? store.state.document : null;
  useRouteRequest("workoutMenu", { ready: document !== null }, (date) => {
    try {
      parseDay(date);
    } catch {
      return;
    }
    void open({ kind: "library", date });
  });
  // `/exercise?workoutImport=tracked` opens the import panel, e.g. from a Settings shortcut.
  // An import already open keeps its link, preview or pending save.
  const importOpen = openPanel?.content.kind === "import";
  useRouteRequest("workoutImport", { ready: document !== null }, (source) => {
    if (importOpen) return;
    void open({ kind: "import", source });
  });
  const layout = exerciseDayLayout({
    document,
    date: activity.date,
    panel: openPanel,
    query,
    workoutState: activity.workoutState,
    workoutName: activity.workout.name,
  });
  const { panel, editingSession } = layout;
  const content = panel?.content;
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
      {document && layout.search && (
        <ExerciseSearchResults
          key={layout.search}
          query={query}
          exercises={document.exercises}
          onLayout={(event) => {
            resultsTop.current = event.nativeEvent.layout.y;
          }}
          onNavigate={scrollToResults}
          onSelect={(exercise) => void open({ kind: "exercise", exercise })}
        />
      )}
      {layout.showDailyWorkout && (
        <WorkoutWidget
          workout={activity.workout}
          detailed
          showEmptyGuidance
          activeWorkoutName={activity.activeWorkoutName}
          sourceState={activity.workoutState}
          onRetry={store.retryLoad}
          onAddWorkout={() => void open({ kind: "library", date: activity.date })}
        />
      )}
      {layout.plannedCards.map((session) => (
        <View key={session.id} testID={`planned-workout-${session.id}`}>
          <SessionEditor editing={editing} session={session} />
        </View>
      ))}
      {layout.workspace && (
        <SessionEditor
          key={`workspace-${layout.workspace.id}`}
          editing={editing}
          session={layout.workspace}
        />
      )}
      {layout.showImport && (
        <AppButton
          label="Import workouts"
          accessibilityHint="Adds a workout shared from another app to your saved workouts"
          onPress={() => void open({ kind: "import" })}
        />
      )}
      {panel && (
        <View
          key={panel.token}
          onLayout={(event) => {
            if (
              (content?.kind === "exercise" ||
                content?.kind === "library" ||
                content?.kind === "import") &&
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
              linkDemo={content.linkDemo}
              onClose={() =>
                content.returnTo ? void open(content.returnTo) : editing.closeView(panel.token)
              }
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
          {content?.kind === "import" && (
            <WorkoutImport
              initialSource={content.source}
              onClose={() => editing.closeView(panel.token)}
              onOpenLibrary={() => void open({ kind: "library", date: activity.date })}
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
                <AppButton label="Close workout" onPress={() => editing.closeView(panel.token)} />
              </Panel>
            ))}
        </View>
      )}
    </Screen>
  );
}
