import { AppText, Panel } from "../components/ui";
import { useCustomFoods } from "./custom-provider";
import { FoodButton } from "./food-button";

export function CustomFoodStatus() {
  const foods = useCustomFoods();
  if (foods.state.kind === "ready") return null;
  return <Panel accessibilityRole={foods.state.kind === "error" ? "alert" : undefined}>
    {foods.state.kind === "loading" ? <AppText accessibilityLiveRegion="polite">Loading your custom foods...</AppText> : <>
      <AppText variant="heading" accessibilityRole="header">Couldn't load your custom foods</AppText>
      <AppText muted>Retry to access saved foods and meals and create new ones. You can still search the USDA database.</AppText>
      <FoodButton label="Retry custom foods" onPress={foods.retryLoad} />
    </>}
  </Panel>;
}
