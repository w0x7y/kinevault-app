import { Utensils, Dumbbell } from "lucide-react-native";
import { View } from "react-native";
import { AppText, Destination, Screen } from "../../components/ui";

export default function TodayScreen() {
  return (
    <Screen title="Today" pose="today">
      <View style={{ gap: 16 }}>
        <Destination
          href="/food"
          title="Food"
          description="Meals and calories"
          icon={Utensils}
        />
        <Destination
          href="/exercise"
          title="Exercise"
          description="Workouts and activity"
          icon={Dumbbell}
        />
      </View>
      <AppText muted>Food and workout logging aren't ready yet.</AppText>
    </Screen>
  );
}
