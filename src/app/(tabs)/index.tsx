import { Utensils, Dumbbell } from "lucide-react-native";
import { View } from "react-native";
import { AppText, Destination, Panel, Screen } from "../../components/ui";

export default function TodayScreen() {
  return (
    <Screen
      title="Today"
      description="A place for your nutrition and movement, together."
    >
      <Panel>
        <AppText variant="heading" accessibilityRole="header">
          Welcome to KineVault Track
        </AppText>
        <AppText muted>
          This is the first step toward your daily food and exercise journal.
          Explore the app and choose the appearance that works for you.
        </AppText>
        <AppText variant="caption" muted>
          Food and exercise logging are coming in a future version.
        </AppText>
      </Panel>
      <View style={{ gap: 16 }}>
        <Destination
          href="/food"
          title="Food"
          description="Your future food and nutrition journal."
          icon={Utensils}
        />
        <Destination
          href="/exercise"
          title="Exercise"
          description="Your future exercise and workout journal."
          icon={Dumbbell}
        />
      </View>
      <AppText variant="caption" muted>
        No entries yet. Your daily summary will appear here when tracking is
        available.
      </AppText>
    </Screen>
  );
}
