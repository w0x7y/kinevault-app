import { Utensils } from "lucide-react-native";
import { EmptyState, Screen } from "../../components/ui";

export default function FoodScreen() {
  return (
    <Screen title="Food">
      <EmptyState
        icon={Utensils}
        title="Food logging isn't ready yet"
        description="You'll be able to track meals and calories here."
      />
    </Screen>
  );
}
