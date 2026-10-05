// Isolated Metro test entry using the same persisted-session interpretation as the app.
import { registerRootComponent } from "expo";
import { useState } from "react";
import { ScrollView, TextInput } from "react-native";
import { ThemeProvider } from "../src/theme/provider";
import { WorkoutWidget } from "../src/daily/workout-widget";
import { parseWorkoutSession, type SessionExercise } from "../src/exercise/model";
import { summarizeSessions } from "../src/exercise/summary";

function row(id: string, name: string, values: [number, number][]): SessionExercise {
  return { id, exercise: { id, name, muscleGroup: "", equipment: "", notes: "", tracking: "single" },
    sets: values.map(([weightKg, reps], index) => ({ id: `set-${index}`, kind: "single", weightKg: String(weightKg), reps: String(reps) })) };
}
const completed = parseWorkoutSession({ id: "completed", date: "2026-10-02", status: "completed", startedAt: null,
  name: "Strength fixture", durationSeconds: 1800, exercises: [
    row("squat", "Squat", [[40, 10], [60, 8]]), row("press", "Press", [[30, 12]]),
    row("pushup", "Push-up", [[0, 15], [0, 10]]), row("pullup", "Pull-up", [[0, 8], [10, 6]]),
  ],
});
const planned = parseWorkoutSession({ ...completed, id: "planned", status: "planned", exercises: [row("planned", "Planned row", [[100, 5]])] });
const workout = summarizeSessions([completed, planned]);

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
