import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { AppText } from "../components/ui";
import { useTheme } from "../theme/provider";
import { spacing } from "../theme/tokens";
import type { CatalogFood, Nutrition } from "./catalog.ts";
import { mealFromDraft, previewMeal, type CustomMeal, type MealDraft, type MealErrors } from "./meal-model.ts";
import { nutritionAmountText } from "./number-input.ts";
import { useCustomFoods } from "./custom-provider";
import { FoodField, NutritionFields } from "./form-fields";
import { FoodButton } from "./food-button";
import { IngredientSearch } from "./ingredient-search";
import { DetailedNutrientFields } from "./detailed-nutrient-fields";
import { unknownNutrients } from "./nutrients.ts";

import { useFoodDrafts } from "./draft-provider";
import type { MealDraftSession } from "./catalog-drafts.ts";

const numberText = (value: number) => String(Number(value.toFixed(4)));

export function CreateMealForm({ onCancel, onSaved, session }: {
  onCancel: () => void; onSaved: (meal: CustomMeal) => void; session: MealDraftSession;
}) {
  const foods = useCustomFoods();
  const { colors } = useTheme();
  const drafts = useFoodDrafts();
  const { draft, existing, handle } = session;
  const [errors, setErrors] = useState<MealErrors>({});
  const [attempted, setAttempted] = useState(false);
  const [failed, setFailed] = useState(false);
  const sequence = useRef(0);
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const calculated = previewMeal(draft.ingredients);
  const values: Record<keyof Nutrition, string> = { calories: "0", carbs: "0", protein: "0", fat: "0" };
  for (const key of ["calories", "carbs", "protein", "fat"] as const)
    values[key] = draft.overrides[key] ?? numberText(calculated?.nutrition[key] ?? 0);
  function change(next: MealDraft) {
    drafts.changeMeal(handle, next);
    if (attempted) {
      const result = mealFromDraft(next, "validation");
      setErrors(result.ok ? {} : result.errors);
    }
  }
  function add(food: CatalogFood) {
    let id: string;
    do { id = `ingredient-${++sequence.current}`; } while (draft.ingredients.some(ingredient => ingredient.id === id));
    change({ ...draft, ingredients: [...draft.ingredients, {
      id, food, amount: nutritionAmountText(food.customId ? food.portions[0]?.grams ?? 100 : 100),
    }] });
  }
  async function save() {
    if (pending.current || foods.saving || foods.state.kind !== "ready") return;
    setAttempted(true);
    setFailed(false);
    const result = mealFromDraft(draft, "validation");
    setErrors(result.ok ? {} : result.errors);
    if (!result.ok) return;
    pending.current = true;
    try {
      const meal = await (existing ? foods.updateMeal(existing.customId, draft) : foods.addMeal(draft));
      if (meal) drafts.retire(handle);
      if (!mounted.current) return;
      if (meal) onSaved(meal);
      else setFailed(true);
    } finally { pending.current = false; }
  }
  return <View testID="create-meal-form" style={{ gap: spacing.layout }}>
    <AppText variant="heading" accessibilityRole="header">{existing ? "Edit custom meal" : "Create meal"}</AppText>
    <AppText muted>Combine foods into a meal you can log again. The ingredient amounts make one complete meal.</AppText>
    <FoodField label="Meal name" value={draft.name} error={errors.name} disabled={foods.saving}
      onChange={name => change({ ...draft, name })} />
    <AppText variant="label" accessibilityRole="header">Ingredients</AppText>
    {draft.ingredients.length === 0 && <AppText muted>No foods added yet. Search below to add your first ingredient.</AppText>}
    {draft.ingredients.map(ingredient => <View key={ingredient.id} style={{ gap: spacing.sm }}>
      <FoodField label={`Amount for ${ingredient.food.name} (g)`} value={ingredient.amount}
        error={errors.amounts?.[ingredient.id]} numeric disabled={foods.saving}
        onChange={amount => change({ ...draft, ingredients: draft.ingredients.map(item => item.id === ingredient.id ? { ...item, amount } : item) })} />
      <FoodButton label="Remove ingredient" accessibilityLabel={`Remove ${ingredient.food.name} from meal`} disabled={foods.saving}
        onPress={() => change({ ...draft, ingredients: draft.ingredients.filter(item => item.id !== ingredient.id) })} />
    </View>)}
    {errors.ingredients && <AppText variant="caption" accessibilityRole="alert" style={{ color: colors.error }}>{errors.ingredients}</AppText>}
    <IngredientSearch onAdd={add} disabled={foods.saving} />
    <AppText variant="label" accessibilityRole="header">Nutrition for the whole meal</AppText>
    <AppText variant="caption" muted>
      {calculated ? `${numberText(calculated.grams)} g in total. ` : ""}Calculated from ingredients. Edit any value to override it.
    </AppText>
    <NutritionFields values={values} errors={errors} disabled={foods.saving || draft.ingredients.length === 0}
      onChange={(key, value) => change({ ...draft, overrides: { ...draft.overrides, [key]: value } })} />
    {Object.keys(draft.overrides).length > 0 && <FoodButton label="Use calculated nutrition" disabled={foods.saving}
      onPress={() => change({ ...draft, overrides: {} })} />}
    <DetailedNutrientFields values={draft.detailOverrides} errors={errors.detailOverrides}
      disabled={foods.saving || draft.ingredients.length === 0} calculated={calculated?.nutrition.details ?? unknownNutrients}
      onChange={(key, value) => change({ ...draft, detailOverrides: { ...draft.detailOverrides, [key]: value } })}
      onReset={() => change({ ...draft, detailOverrides: {} })} />
    <AppText variant="caption" muted>{existing ? "Changes apply to future logging. Existing log entries keep their original nutrition." :
      "Saved on this device and available in meal search. Saving won't add it to your daily log."}</AppText>
    {failed && <AppText accessibilityRole="alert" style={{ color: colors.error }}>
      {foods.error ?? "Couldn't save your meal. Your ingredients and values are still here. Try again."}
    </AppText>}
    <FoodButton primary label={foods.saving ? "Saving meal..." : existing ? "Save meal changes" : "Save meal"}
      disabled={foods.saving || foods.state.kind !== "ready"} onPress={() => { void save(); }} />
    <FoodButton label="Cancel" disabled={foods.saving} onPress={() => { drafts.discard(handle); onCancel(); }} />
  </View>;
}
