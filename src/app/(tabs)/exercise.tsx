import { Dumbbell } from "lucide-react-native";
import { EmptyState, Screen } from "../../components/ui";

export default function ExerciseScreen() {
  return (
    <Screen
      title="Exercise"
      description="A home for your movement and workout history."
    >
      <EmptyState
        icon={Dumbbell}
        title="Room for your next workout"
        description="Exercise logging is coming in a future version. Your KineVault exercise library is not connected yet."
      />
    </Screen>
  );
}
