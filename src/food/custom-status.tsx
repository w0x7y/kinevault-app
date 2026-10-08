import { AppText, Panel } from "../components/ui";
import { useCustomFoods } from "./custom-provider";
import { FoodButton } from "./food-button";
import { KineLoading } from "../components/kine-loading";

export function CustomFoodStatus() {
  const foods = useCustomFoods();
  if (foods.state.kind === "ready") return null;
  if (foods.state.kind === "loading")
    return <KineLoading compact label="Loading your custom foods..." />;
  return (
    <Panel accessibilityRole="alert">
      <AppText variant="heading" accessibilityRole="header">
        Couldn't load your custom foods
      </AppText>
      <AppText muted>
        Retry to access saved foods and meals and create new ones. You can still search the USDA
        database.
      </AppText>
      <FoodButton label="Retry custom foods" onPress={foods.retryLoad} />
    </Panel>
  );
}
