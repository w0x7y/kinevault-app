import { Dumbbell } from "lucide-react-native";
import { EmptyState, Screen } from "../../components/ui";

export default function ExerciseScreen() {
  return (
    <Screen title="Exercise" pose="exercise">
      <EmptyState
        icon={Dumbbell}
        title="Workout logging isn't ready yet"
        description="You'll be able to track your workouts here."
      />
    </Screen>
  );
}
