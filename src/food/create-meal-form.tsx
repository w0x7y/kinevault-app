import { AppButton } from "../components/button";
import { DeleteButton } from "../components/delete-button";
import { useRef } from "react";
import { StyleSheet, View } from "react-native";
import { AppText } from "../components/ui";
import { useTheme } from "../theme/provider";
import { spacing } from "../theme/tokens";
import type { CatalogFood, Nutrition } from "./catalog.ts";
import { previewMeal, type CustomMeal, type MealDraft } from "./meal-model.ts";
import { defaultAmount } from "./logging-attempt.ts";
import { useCustomFoods } from "./custom-provider";
import { InlineMessage } from "../components/inline-message";
import { TextField } from "../components/text-field";
import { NutritionFields } from "./form-fields";
import { IngredientSearch } from "./ingredient-search";
import { DetailedNutrientFields } from "./detailed-nutrient-fields";
import { unknownNutrients } from "./nutrients.ts";
import { Section } from "./food-ui";
import { FormFooter } from "./create-form";

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
      ingredients: [...draft.ingredients, { id, food, amount: defaultAmount(food) }],
    });
  }
  // A save finishing while the tab hides this form still reaches the page that started it.
  async function save() {
    await drafts.save(handle, (item) => {
      if ("ingredients" in item) onSaved(item);
    });
  }
  return (
    <View testID="create-meal-form" style={{ gap: spacing.layout }}>
      <AppText variant="caption" muted style={{ paddingHorizontal: spacing.xs }}>
        Combine foods into a meal you can log again. The ingredient amounts make one complete meal.
      </AppText>
      <Section title="Details">
        <TextField
          label="Meal name"
          value={draft.name}
          error={errors.name}
          disabled={busy}
          onChange={(name) => change({ ...draft, name })}
        />
      </Section>
      <Section title="Ingredients" titleRole="header">
        {draft.ingredients.length === 0 ? (
          <AppText variant="caption" muted>
            No foods added yet. Search below to add your first ingredient.
          </AppText>
        ) : (
          <View>
            {draft.ingredients.map((ingredient, index) => (
              <View
                key={ingredient.id}
                style={{
                  paddingTop: index ? spacing.md : 0,
                  paddingBottom: spacing.md,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderColor: colors.border,
                }}
              >
                <TextField
                  label={`Amount for ${ingredient.food.name} (g)`}
                  value={ingredient.amount}
                  error={errors.amounts?.[ingredient.id]}
                  kind="decimal"
                  disabled={busy}
                  onChange={(amount) =>
                    change({
                      ...draft,
                      ingredients: draft.ingredients.map((item) =>
                        item.id === ingredient.id ? { ...item, amount } : item,
                      ),
                    })
                  }
                  action={
                    <View style={{ flexShrink: 0 }}>
                      <DeleteButton
                        label="Remove"
                        accessibilityLabel={`Remove ${ingredient.food.name} from meal`}
                        disabled={busy}
                        confirmAccessibilityLabel={`Confirm remove ${ingredient.food.name} from meal`}
                        onDelete={() =>
                          change({
                            ...draft,
                            ingredients: draft.ingredients.filter(
                              (item) => item.id !== ingredient.id,
                            ),
                          })
                        }
                      />
                    </View>
                  }
                />
              </View>
            ))}
          </View>
        )}
        {errors.ingredients && <InlineMessage>{errors.ingredients}</InlineMessage>}
        <IngredientSearch onAdd={add} disabled={busy} />
      </Section>
      <Section
        title="Nutrition for the whole meal"
        titleRole="header"
        description={`${calculated ? `${numberText(calculated.grams)} g in total. ` : ""}Calculated from ingredients. Edit any value to override it.`}
      >
        <NutritionFields
          values={values}
          errors={errors}
          disabled={busy || draft.ingredients.length === 0}
          onChange={(key, value) =>
            change({ ...draft, overrides: { ...draft.overrides, [key]: value } })
          }
        />
        {Object.keys(draft.overrides).length > 0 && (
          <AppButton
            label="Use calculated nutrition"
            icon="rotate-left"
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
      </Section>
      <FormFooter
        note={
          existing
            ? "Changes apply to future logging. Existing log entries keep their original nutrition."
            : "Saved to your meals and available in search. Saving won't add it to your daily log."
        }
        error={error}
        busy={busy}
        onCancel={() => {
          drafts.discard(handle);
          onCancel();
        }}
        saveLabel={busy ? "Saving meal..." : existing ? "Save meal changes" : "Save meal"}
        saveDisabled={busy || foods.state.kind !== "ready"}
        onSave={() => {
          void save();
        }}
      />
    </View>
  );
}
