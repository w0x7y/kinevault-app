import { Utensils } from "lucide-react-native";
import { EmptyState, Screen } from "../../components/ui";

export default function FoodScreen() {
  return (
    <Screen
      title="Food"
      description="Keep your meals and nutrition in one place."
    >
      <EmptyState
        icon={Utensils}
        title="Your food journal starts here"
        description="Food logging and calorie tracking are coming in a future version. There are no meals recorded yet."
      />
    </Screen>
  );
}
