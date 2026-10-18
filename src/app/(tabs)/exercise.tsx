import { AppButton } from "../../components/button";
import { StepFade, useLayoutMotion } from "../../components/motion";
import { useRef } from "react";
import { View, type ScrollView } from "react-native";
import Animated from "react-native-reanimated";
import { SheetPage } from "../../components/sheet-page";
import { AppText, Panel, Screen, ScreenTitle } from "../../components/ui";
import { useDayActivity } from "../../daily/use-day";
import { SearchActions } from "../../daily/search-actions";
import { WorkoutWidget, workoutSummary } from "../../daily/workout-widget";
import { WorkoutImport } from "../../exercise/import/workout-import";
import { ExerciseForm, WorkoutForm } from "../../exercise/library-forms";
import { LiveWorkoutCard } from "../../exercise/live-workout-card";
import { useExercises } from "../../exercise/provider";
import { ExerciseSearchResults } from "../../exercise/search-results";
import { SessionEditor } from "../../exercise/session-editor";
import { ActiveWorkoutTimer } from "../../exercise/timer";
import { useExerciseTabView } from "../../exercise/use-workout-editing";
import { WorkoutLibrary } from "../../exercise/workout-library";
import { useRouteRequest } from "../../navigation/use-route-request";

export default function ExerciseScreen() {
  const activity = useDayActivity(),
    store = useExercises();
  const { tab, view } = useExerciseTabView(activity.date);
  const { drafts } = tab;
  const open = tab.requestView;
  const scrollRef = useRef<ScrollView>(null),
    resultsTop = useRef(0);
  const document = store.state.kind === "ready" ? store.state.document : null;
  useRouteRequest("workoutMenu", { ready: document !== null }, (date) => {
    void tab.openWorkoutMenu(date);
  });
  // `/exercise?workoutImport=tracked` opens the import sheet, e.g. from a Settings shortcut.
  useRouteRequest("workoutImport", { ready: document !== null }, (source) => {
    void tab.openImport(source);
  });
  // `/exercise?liveWorkout=<id>` opens the Active workout's page, e.g. from the header timer.
  useRouteRequest("liveWorkout", { ready: document !== null }, (id) => {
    void tab.openLiveWorkout(id);
  });
  const { inline, sheet } = view;
  // Ending (or discarding) the live workout swaps its card for the day's card, which fades in
  // where the live card was.
  const { fade } = useLayoutMotion();
  const content = sheet?.panel.content;
  function scrollToResults() {
    scrollRef.current?.scrollTo({ y: resultsTop.current, animated: false });
  }
  return (
    <Screen title="Exercise" showTitle={false} scrollRef={scrollRef} adjustKeyboardInsets>
      <ScreenTitle
        title="Daily workout log"
        trailing={workoutSummary(activity.workout, activity.workoutState)}
      />
      <SearchActions
        kind="exercise"
        query={view.query}
        onQueryChange={tab.search}
        disabled={!document}
        onCreateExercise={() => void open({ kind: "exercise" })}
        onCreateWorkout={() => void open({ kind: "workout" })}
        onSavedWorkouts={() => void open({ kind: "library", date: activity.date })}
      />
      {document && view.search && (
        <ExerciseSearchResults
          key={view.search}
          query={view.query}
          exercises={document.exercises}
          onLayout={(event) => {
            resultsTop.current = event.nativeEvent.layout.y;
          }}
          onNavigate={scrollToResults}
          onSelect={(exercise) => void open({ kind: "exercise", exercise })}
        />
      )}
      {view.showDailyWorkout && (
        <Animated.View entering={view.liveEnded ? fade : undefined}>
          <WorkoutWidget
            workout={activity.workout}
            detailed
            showEmptyGuidance
            activeWorkoutName={activity.activeWorkoutName}
            sourceState={activity.workoutState}
            onRetry={store.retryLoad}
            onAddWorkout={() => void open({ kind: "library", date: activity.date })}
          />
        </Animated.View>
      )}
      {view.plannedCards.map((session) => (
        <View key={session.id} testID={`planned-workout-${session.id}`}>
          <SessionEditor tab={tab} session={session} />
        </View>
      ))}
      {view.live && (
        <LiveWorkoutCard
          session={view.live}
          onOpen={() => void open({ kind: "session", id: view.live!.id })}
        />
      )}
      {inline && (
        <SessionEditor
          key={inline.panel.token}
          tab={tab}
          session={inline.session}
          closeLabel={inline.closeLabel}
        />
      )}
      {view.showImport && (
        <AppButton
          icon="file-import"
          label="Import workouts"
          accessibilityHint="Adds a workout shared from another app to your saved workouts"
          onPress={() => void open({ kind: "import" })}
        />
      )}
      {/* Away from the tab the sheet hides; its page's draft waits with the panel. */}
      {sheet && (
        <SheetPage
          title={sheet.title}
          closeLabel={sheet.closeLabel}
          testID={sheet.testID}
          center={
            sheet.log?.mode === "active" ? (
              <ActiveWorkoutTimer session={sheet.log.session} />
            ) : undefined
          }
          page={sheet.panel.token}
          onClose={() => tab.closeView(sheet.panel.token)}
        >
          {/* The sheet stays up while its page changes (the library opening a workout); each new
              page fades in over the last. */}
          <StepFade step={sheet.panel.token}>
            {content?.kind === "exercise" && (
              <ExerciseForm
                draft={drafts.exercise(sheet.panel.token, content.exercise)}
                exercise={content.exercise}
                linkDemo={content.linkDemo}
              />
            )}
            {content?.kind === "workout" && (
              <WorkoutForm
                draft={drafts.template(sheet.panel.token, content.workout)}
                workout={content.workout}
              />
            )}
            {content?.kind === "library" && (
              <WorkoutLibrary
                actions={drafts.savedWorkouts(sheet.panel.token, content.date)}
                date={content.date}
                onEdit={(workout) => void open({ kind: "workout", workout })}
                onOpen={(id) => void open({ kind: "session", id })}
              />
            )}
            {content?.kind === "import" && (
              <WorkoutImport
                flow={drafts.workoutImport(sheet.panel.token, content.source)}
                onClose={() => tab.closeView(sheet.panel.token)}
                onOpenLibrary={() => void open({ kind: "library", date: activity.date })}
              />
            )}
            {content?.kind === "session" &&
              (sheet.log ? (
                <SessionEditor tab={tab} session={sheet.log.session} />
              ) : (
                <Panel>
                  <AppText>This workout is no longer available.</AppText>
                </Panel>
              ))}
          </StepFade>
        </SheetPage>
      )}
    </Screen>
  );
}
