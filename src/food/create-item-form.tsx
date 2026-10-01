import { View } from "react-native";
import { CreateFoodForm } from "./create-form";
import { CreateMealForm } from "./create-meal-form";
import type { CustomFood } from "./custom-model.ts";
import type { CatalogKind, CustomMeal } from "./meal-model.ts";

export function CreateItemForm({ kind, onCancel, onSaved }: {
  kind: CatalogKind; onCancel: () => void; onSaved: (item: CustomFood | CustomMeal) => void;
}) {
  // Both drafts stay mounted while switching categories; only the selected form is visible.
  return <>
    <View style={{ display: kind === "food" ? "flex" : "none" }} accessibilityElementsHidden={kind !== "food"}
      importantForAccessibility={kind === "food" ? "auto" : "no-hide-descendants"}>
      <CreateFoodForm onCancel={onCancel} onSaved={onSaved} />
    </View>
    <View style={{ display: kind === "meal" ? "flex" : "none" }} accessibilityElementsHidden={kind !== "meal"}
      importantForAccessibility={kind === "meal" ? "auto" : "no-hide-descendants"}>
      <CreateMealForm onCancel={onCancel} onSaved={onSaved} />
    </View>
  </>;
}
