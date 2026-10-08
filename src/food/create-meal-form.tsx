import { DeleteButton } from "../components/delete-button";
import { useEffect, useRef } from "react";
import { View } from "react-native";
import { AppText } from "../components/ui";
import { useTheme } from "../theme/provider";
import { spacing } from "../theme/tokens";
import type { CatalogFood, Nutrition } from "./catalog.ts";
import { previewMeal, type CustomMeal, type MealDraft } from "./meal-model.ts";
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

export function CreateMealForm({
  onCancel,
  onSaved,
  session,
}: {
  onCancel: () => void;
  onSaved: (meal: CustomMeal) => void;
  session: MealDraftSession;
}) {
  const foods = useCustomFoods();
  const { colors } = useTheme();
  const drafts = useFoodDrafts();
  const { draft, existing, handle, errors, error } = session;
  const sequence = useRef(0);
  const busy = foods.saving || session.saving;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const calculated = previewMeal(draft.ingredients);
  const values: Record<keyof Nutrition, string> = {
    calories: "0",
    carbs: "0",
    protein: "0",
    fat: "0",
  };
  for (const key of ["calories", "carbs", "protein", "fat"] as const)
    values[key] = draft.overrides[key] ?? numberText(calculated?.nutrition[key] ?? 0);
  function change(next: MealDraft) {
    drafts.changeMeal(handle, next);
  }
  function add(food: CatalogFood) {
    let id: string;
    do {
      id = `ingredient-${++sequence.current}`;
    } while (draft.ingredients.some((ingredient) => ingredient.id === id));
    change({
      ...draft,
      ingredients: [
        ...draft.ingredients,
        {
          id,
          food,
          amount: nutritionAmountText(food.customId ? (food.portions[0]?.grams ?? 100) : 100),
        },
      ],
    });
  }
  async function save() {
    await drafts.save(handle, foods, (item) => {
      if (mounted.current && "ingredients" in item) onSaved(item);
    });
  }
  return (
    <View testID="create-meal-form" style={{ gap: spacing.layout }}>
      <AppText variant="heading" accessibilityRole="header">
        {existing ? "Edit custom meal" : "Create meal"}
      </AppText>
      <AppText muted>
        Combine foods into a meal you can log again. The ingredient amounts make one complete meal.
      </AppText>
      <FoodField
        label="Meal name"
        value={draft.name}
        error={errors.name}
        disabled={busy}
        onChange={(name) => change({ ...draft, name })}
      />
      <AppText variant="label" accessibilityRole="header">
        Ingredients
      </AppText>
      {draft.ingredients.length === 0 && (
        <AppText muted>No foods added yet. Search below to add your first ingredient.</AppText>
      )}
      {draft.ingredients.map((ingredient) => (
        <View key={ingredient.id} style={{ gap: spacing.sm }}>
          <FoodField
            label={`Amount for ${ingredient.food.name} (g)`}
            value={ingredient.amount}
            error={errors.amounts?.[ingredient.id]}
            numeric
            disabled={busy}
            onChange={(amount) =>
              change({
                ...draft,
                ingredients: draft.ingredients.map((item) =>
                  item.id === ingredient.id ? { ...item, amount } : item,
                ),
              })
            }
          />
          <DeleteButton
            label="Remove ingredient"
            accessibilityLabel={`Remove ${ingredient.food.name} from meal`}
            disabled={busy}
            confirmAccessibilityLabel={`Confirm remove ${ingredient.food.name} from meal`}
            onDelete={() =>
              change({
                ...draft,
                ingredients: draft.ingredients.filter((item) => item.id !== ingredient.id),
              })
            }
          />
        </View>
      ))}
      {errors.ingredients && (
        <AppText variant="caption" accessibilityRole="alert" style={{ color: colors.error }}>
          {errors.ingredients}
        </AppText>
      )}
      <IngredientSearch onAdd={add} disabled={busy} />
      <AppText variant="label" accessibilityRole="header">
        Nutrition for the whole meal
      </AppText>
      <AppText variant="caption" muted>
        {calculated ? `${numberText(calculated.grams)} g in total. ` : ""}Calculated from
        ingredients. Edit any value to override it.
      </AppText>
      <NutritionFields
        values={values}
        errors={errors}
        disabled={busy || draft.ingredients.length === 0}
        onChange={(key, value) =>
          change({ ...draft, overrides: { ...draft.overrides, [key]: value } })
        }
      />
      {Object.keys(draft.overrides).length > 0 && (
        <FoodButton
          label="Use calculated nutrition"
          disabled={busy}
          onPress={() => change({ ...draft, overrides: {} })}
        />
      )}
      <DetailedNutrientFields
        values={draft.detailOverrides}
        errors={errors.detailOverrides}
        disabled={busy || draft.ingredients.length === 0}
        calculated={calculated?.nutrition.details ?? unknownNutrients}
        onChange={(key, value) =>
          change({ ...draft, detailOverrides: { ...draft.detailOverrides, [key]: value } })
        }
        onReset={() => change({ ...draft, detailOverrides: {} })}
      />
      <AppText variant="caption" muted>
        {existing
          ? "Changes apply to future logging. Existing log entries keep their original nutrition."
          : "Saved on this device and available in meal search. Saving won't add it to your daily log."}
      </AppText>
      {error && (
        <AppText accessibilityRole="alert" style={{ color: colors.error }}>
          {error}
        </AppText>
      )}
      <FoodButton
        primary
        label={busy ? "Saving meal..." : existing ? "Save meal changes" : "Save meal"}
        disabled={busy || foods.state.kind !== "ready"}
        onPress={() => {
          void save();
        }}
      />
      <FoodButton
        label="Cancel"
        disabled={busy}
        onPress={() => {
          drafts.discard(handle);
          onCancel();
        }}
      />
    </View>
  );
}
