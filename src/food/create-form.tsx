import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { AppText } from "../components/ui";
import { useTheme } from "../theme/provider";
import { spacing } from "../theme/tokens";
import { customFoodFromDraft, type CustomFood, type CustomFoodDraft, type CustomFoodErrors } from "./custom-model.ts";
import { useCustomFoods } from "./custom-provider";
import { FoodButton } from "./food-button";
import { FoodField, NutritionFields } from "./form-fields";
import { DetailedNutrientFields } from "./detailed-nutrient-fields";
import { ProductAttribution } from "./product-attribution";

import { useFoodDrafts } from "./draft-provider";
import type { FoodDraftSession } from "./catalog-drafts.ts";

export function CreateFoodForm({ onCancel, onSaved, session }: {
  onCancel: () => void; onSaved: (food: CustomFood) => void; session: FoodDraftSession;
}) {
  const foods = useCustomFoods();
  const { colors } = useTheme();
  const drafts = useFoodDrafts();
  const { draft, existing, volumeBased, handle } = session;
  const [errors, setErrors] = useState<CustomFoodErrors>({});
  const [attempted, setAttempted] = useState(false);
  const [failed, setFailed] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  function changeDraft(next: CustomFoodDraft) {
    drafts.changeFood(handle, next);
    if (attempted) {
      const result = customFoodFromDraft(next, "validation");
      setErrors(result.ok ? {} : result.errors);
    }
  }
  function change(key: Exclude<keyof CustomFoodDraft, "details" | "importSource" | "drink">, value: string) {
    changeDraft({ ...draft, [key]: value });
  }
  function changeKind(drink: boolean) {
    const next = drafts.setFoodKind(handle, drink);
    if (attempted && next) {
      const result = customFoodFromDraft(next.draft, "validation");
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
      if (food) drafts.retire(handle);
      if (!mounted.current) return;
      if (food) onSaved(food);
      else setFailed(true);
    } finally { pending.current = false; }
  }
  return (
    <View testID="create-food-form" style={{ gap: spacing.layout }}>
      <AppText variant="heading" accessibilityRole="header">{existing ? "Edit custom food" : "Create food"}</AppText>
      <AppText muted>Save a food or drink to use again. Enter the nutrition from its label.</AppText>
      <FoodField label="Food name" value={draft.name} onChange={value => change("name", value)}
        error={errors.name} disabled={foods.saving} />
      <FoodField label="Brand (optional)" value={draft.brand ?? ""} onChange={value => change("brand", value)}
        error={errors.brand} disabled={foods.saving} />
      {draft.importSource?.provider === "open-food-facts" && <ProductAttribution barcode={draft.importSource.barcode} />}
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <FoodButton label="Solid food" selected={!draft.drink} disabled={foods.saving} onPress={() => changeKind(false)} />
        <FoodButton label="Drink" selected={Boolean(draft.drink)} disabled={foods.saving} onPress={() => changeKind(true)} />
      </View>
      {volumeBased && !draft.drink && <AppText variant="caption" muted>This product lists volume amounts. Choose Drink for a beverage and confirm nutrition per 100 ml, or enter nutrition for a weighed food serving.</AppText>}
      {!draft.drink && <FoodField label="Serving weight (g)" value={draft.servingGrams} onChange={value => change("servingGrams", value)}
        error={errors.servingGrams} disabled={foods.saving} numeric />}
      <AppText variant="label" accessibilityRole="header">{draft.drink ? "Nutrition per 100 ml" : "Nutrition per serving"}</AppText>
      <AppText variant="caption" muted>Enter 0 when the label lists zero. All four values are required.</AppText>
      <NutritionFields values={draft} errors={errors} onChange={change} disabled={foods.saving} />
      <DetailedNutrientFields values={draft.details} errors={errors.details} disabled={foods.saving}
        onChange={(key, value) => changeDraft({ ...draft, details: { ...draft.details, [key]: value } })} />
      <AppText variant="caption" muted>{existing ? "Changes apply to future logging. Existing log entries and saved meal ingredients keep their original nutrition." :
        "Saved on this device and available in food search. Saving won't add it to a meal."}</AppText>
      {failed && <AppText accessibilityRole="alert" style={{ color: colors.error }}>
        {foods.error ?? "Couldn't save your custom food. Your values are still here. Try again."}
      </AppText>}
      <FoodButton primary label={foods.saving ? "Saving food..." : existing ? "Save food changes" : "Save food"}
        disabled={foods.saving || foods.state.kind !== "ready"} onPress={() => { void save(); }} />
      <FoodButton label="Cancel" disabled={foods.saving} onPress={() => { drafts.discard(handle); onCancel(); }} />
    </View>
  );
}
