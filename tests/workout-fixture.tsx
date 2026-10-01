// Isolated Metro test entry. It supplies data directly to the real widget;
// the app's selected days intentionally remain empty until logging exists.
import { registerRootComponent } from "expo";
import { useState } from "react";
import { ScrollView, TextInput } from "react-native";
import { ThemeProvider } from "../src/theme/provider";
import { WorkoutWidget } from "../src/daily/workout-widget";
import { interpretWorkout } from "../src/daily/workout";

const workout = interpretWorkout({
  name: "Strength fixture", durationSeconds: 1800, exercises: [
    { id: "squat", name: "Squat", sets: [
      { weightKg: 40, reps: 10, completed: true },
      { weightKg: 60, reps: 8, completed: true },
      { weightKg: 100, reps: 5, completed: false },
    ] },
    { id: "press", name: "Press", sets: [{ weightKg: 30, reps: 12, completed: true }] },
    { id: "pushup", name: "Push-up", sets: [
      { weightKg: 0, reps: 15, completed: true },
      { weightKg: 0, reps: 10, completed: true },
    ] },
    { id: "pullup", name: "Pull-up", sets: [
      { weightKg: 0, reps: 8, completed: true },
      { weightKg: 10, reps: 6, completed: true },
    ] },
    { id: "planned", name: "Planned row", sets: [{ weightKg: 40, reps: 12, completed: false }] },
  ],
});

function WorkoutFixture() {
  const [query, setQuery] = useState("");
  return (
    <ThemeProvider>
      <ScrollView contentContainerStyle={{ padding: 12, gap: 12 }}>
        <WorkoutWidget workout={workout} />
        <TextInput
          accessibilityLabel="Filter completed exercises"
          value={query}
          onChangeText={setQuery}
        />
        <WorkoutWidget workout={workout} detailed query={query} />
      </ScrollView>
    </ThemeProvider>
  );
}

registerRootComponent(WorkoutFixture);
