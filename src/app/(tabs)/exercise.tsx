import { AppButton } from "../../components/button";
import { StepFade, useLayoutMotion } from "../../components/motion";
import { useRef } from "react";
import { View, type ScrollView } from "react-native";
import Animated from "react-native-reanimated";
import { SheetPage } from "../../components/sheet-page";
import { AppText, Panel, Screen, ScreenTitle } from "../../components/ui";
import { useDayActivity } from "../../daily/use-day";
import { SearchActions } from "../../daily/search-actions";
import { WorkoutWidget } from "../../daily/workout-widget";
import { WorkoutImport } from "../../exercise/import/workout-import";
import { ExerciseForm, WorkoutForm } from "../../exercise/library-forms";
import { LiveWorkoutCard } from "../../exercise/live-workout-card";
import { ExerciseSearchResults } from "../../exercise/search-results";
import { SessionEditor } from "../../exercise/session-editor";
import { ActiveWorkoutTimer } from "../../exercise/timer";
import { useExerciseTabView } from "../../exercise/use-exercise-tab-view";
import { WorkoutLibrary } from "../../exercise/workout-library";
import { useRouteRequest } from "../../navigation/use-route-request";

export default function ExerciseScreen() {
  const activity = useDayActivity();
  const { tab, view } = useExerciseTabView(activity.date);
  const open = tab.requestView;
  const scrollRef = useRef<ScrollView>(null),
    resultsTop = useRef(0);
  const ready = { ready: view.loaded };
  useRouteRequest("workoutMenu", ready, (date) => {
    void tab.openWorkoutMenu(date);
  });
  // `/exercise?workoutImport=tracked` opens the import sheet, e.g. from a Settings shortcut.
  useRouteRequest("workoutImport", ready, (source) => {
    void tab.openImport(source);
  });
  // `/exercise?liveWorkout=<id>` opens the Active workout's page, e.g. from the header timer.
  useRouteRequest("liveWorkout", ready, (id) => {
    void tab.openLiveWorkout(id);
  });
  const { inline, sheet } = view;
  // Ending (or discarding) the live workout swaps its card for the day's card, which fades in
  // where the live card was.
  const { fade } = useLayoutMotion();
  const page = sheet?.page;
  function scrollToResults() {
    scrollRef.current?.scrollTo({ y: resultsTop.current, animated: false });
  }
  return (
    <Screen title="Exercise" scrollRef={scrollRef} adjustKeyboardInsets>
      <ScreenTitle title="Daily workout log" trailing={activity.workout.summary} />
      <SearchActions
        kind="exercise"
        query={view.query}
        onQueryChange={tab.search}
        disabled={!view.loaded}
        onCreateExercise={() => void open({ kind: "exercise" })}
        onCreateWorkout={() => void open({ kind: "workout" })}
        onSavedWorkouts={() => void tab.openLibrary()}
      />
      {view.search && (
        <ExerciseSearchResults
          key={view.search}
          query={view.query}
          exercises={view.exercises}
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
            tile={activity.workout}
            detailed
            onAddWorkout={() => void tab.openLibrary()}
          />
        </Animated.View>
      )}
      {view.plannedCards.map((card) => (
        <View key={card.session.id} testID={`planned-workout-${card.session.id}`}>
          <SessionEditor edit={card.edit} />
        </View>
      ))}
      {view.live && (
        <LiveWorkoutCard
          session={view.live}
          onOpen={() => void open({ kind: "session", id: view.live!.id })}
        />
      )}
      {inline && <SessionEditor key={inline.panel.token} edit={inline.edit} closable />}
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
          onClose={sheet.close}
        >
          {/* The sheet stays up while its page changes (the library opening a workout); each new
              page fades in over the last. */}
          <StepFade step={sheet.panel.token} style={{ flexGrow: 1 }}>
            {page?.kind === "exercise" && (
              <ExerciseForm draft={page.draft} exercise={page.exercise} linkDemo={page.linkDemo} />
            )}
            {page?.kind === "workout" && <WorkoutForm draft={page.draft} workout={page.workout} />}
            {page?.kind === "library" && (
              <WorkoutLibrary
                actions={page.actions}
                date={page.date}
                onEdit={(workout) => void open({ kind: "workout", workout })}
                onOpen={(id) => void open({ kind: "session", id })}
              />
            )}
            {page?.kind === "import" && (
              <WorkoutImport
                flow={page.flow}
                onClose={sheet.close}
                onOpenLibrary={() => void tab.openLibrary()}
              />
            )}
            {page?.kind === "session" &&
              (page.edit ? (
                <SessionEditor edit={page.edit} />
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
