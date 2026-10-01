import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { AppText } from "../components/ui";
import { useTheme } from "../theme/provider";
import { spacing } from "../theme/tokens";
import { customFoodFromDraft, customFoodToDraft, type CustomFood, type CustomFoodDraft, type CustomFoodErrors } from "./custom-model.ts";
import { useCustomFoods } from "./custom-provider";
import { FoodButton } from "./food-button";
import { FoodField, NutritionFields } from "./form-fields";

const initialDraft: CustomFoodDraft = { name: "", servingGrams: "100", calories: "", carbs: "", protein: "", fat: "" };

export function CreateFoodForm({ onCancel, onSaved, existing }: {
  onCancel: () => void; onSaved: (food: CustomFood) => void; existing?: CustomFood;
}) {
  const foods = useCustomFoods();
  const { colors } = useTheme();
  const [draft, setDraft] = useState(() => existing ? customFoodToDraft(existing) : initialDraft);
  const [errors, setErrors] = useState<CustomFoodErrors>({});
  const [attempted, setAttempted] = useState(false);
  const [failed, setFailed] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  function change(key: keyof CustomFoodDraft, value: string) {
    const next = { ...draft, [key]: value };
    setDraft(next);
    if (attempted) {
      const result = customFoodFromDraft(next, "validation");
      setErrors(result.ok ? {} : result.errors);
    }
  }
  async function save() {
    if (pending.current || foods.saving || foods.state.kind !== "ready") return;
    setAttempted(true);
    setFailed(false);
    const result = customFoodFromDraft(draft, "validation");
    setErrors(result.ok ? {} : result.errors);
    if (!result.ok) return;
    pending.current = true;
    try {
      const food = await (existing ? foods.updateFood(existing.customId, draft) : foods.add(draft));
      if (!mounted.current) return;
      if (food) onSaved(food);
      else setFailed(true);
    } finally { pending.current = false; }
  }
  return (
    <View testID="create-food-form" style={{ gap: spacing.layout }}>
      <AppText variant="heading" accessibilityRole="header">{existing ? "Edit custom food" : "Create food"}</AppText>
      <AppText muted>Save a food to use again. Enter the nutrition for one serving, using its weight in grams.</AppText>
      <FoodField label="Food name" value={draft.name} onChange={value => change("name", value)}
        error={errors.name} disabled={foods.saving} />
      <FoodField label="Serving weight (g)" value={draft.servingGrams} onChange={value => change("servingGrams", value)}
        error={errors.servingGrams} disabled={foods.saving} numeric />
      <AppText variant="label" accessibilityRole="header">Nutrition per serving</AppText>
      <AppText variant="caption" muted>Enter 0 when the label lists zero. All four values are required.</AppText>
      <NutritionFields values={draft} errors={errors} onChange={change} disabled={foods.saving} />
      <AppText variant="caption" muted>{existing ? "Changes apply to future logging. Existing log entries and saved meal ingredients keep their original nutrition." :
        "Saved on this device and available in food search. Saving won't add it to a meal."}</AppText>
      {failed && <AppText accessibilityRole="alert" style={{ color: colors.error }}>
        {foods.error ?? "Couldn't save your custom food. Your values are still here. Try again."}
      </AppText>}
      <FoodButton primary label={foods.saving ? "Saving food..." : existing ? "Save food changes" : "Save food"}
        disabled={foods.saving || foods.state.kind !== "ready"} onPress={() => { void save(); }} />
      <FoodButton label="Cancel" disabled={foods.saving} onPress={onCancel} />
    </View>
  );
}
