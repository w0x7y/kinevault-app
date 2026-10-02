import { useFoodDrafts } from "./draft-provider";
import { View } from "react-native";
import { CreateFoodForm } from "./create-form";
import { CreateMealForm } from "./create-meal-form";
import type { CustomFood } from "./custom-model.ts";
import type { CustomMeal } from "./meal-model.ts";
import { FoodButton } from "./food-button";
import { useCustomFoods } from "./custom-provider";
import { spacing } from "../theme/tokens";

export function CreateItemForm({ onCancel, onSaved }: {
  onCancel: () => void; onSaved: (item: CustomFood | CustomMeal) => void;
}) {
  const { creationKind: kind, setCreationKind: setKind, session } = useFoodDrafts();
  const { saving } = useCustomFoods();
  return <>
    <View testID="food-creation-switch" style={{ flexDirection: "row", gap: spacing.layout }}>
      <View style={{ flex: 1 }}><FoodButton label="Food" selected={kind === "food"}
        disabled={saving} onPress={() => setKind("food")} /></View>
      <View style={{ flex: 1 }}><FoodButton label="Meal" selected={kind === "meal"}
        disabled={saving} onPress={() => setKind("meal")} /></View>
    </View>
    {session?.kind === "food" ? <CreateFoodForm session={session} onCancel={onCancel} onSaved={onSaved} /> :
      session?.kind === "meal" ? <CreateMealForm session={session} onCancel={onCancel} onSaved={onSaved} /> : null}
  </>;
}
