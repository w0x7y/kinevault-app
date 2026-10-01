import { useEffect, useState } from "react";
import { Keyboard, TextInput, View } from "react-native";
import { AppText } from "../components/ui";
import { useTheme } from "../theme/provider";
import { fonts, radius, spacing } from "../theme/tokens";
import { nutritionForGrams, parseFoodGrams } from "./catalog.ts";
import { nutritionForEntry, type FoodSaveTarget } from "./log-model.ts";
import { macroCategories } from "../daily/nutrition.ts";
import { FoodButton } from "./food-button";
import { FoodLoggingControls } from "./logging-controls";
import { useFoodLog } from "./log-provider";
import type { CustomMeal } from "./meal-model.ts";
import type { CustomFood } from "./custom-model.ts";
import { useCustomFoods } from "./custom-provider";
import { CustomItemActions } from "./custom-item-actions";
import { CreateFoodForm } from "./create-form";
import { CreateMealForm } from "./create-meal-form";
import { nutritionAmountText } from "./number-input.ts";

const decimal = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 1 });

export function FoodNutritionDetail({ target: originalTarget, onBack, date, onSaved, backLabel = "Back to food results", customMeal: originalMeal, onCatalogEditChange }: {
  target: FoodSaveTarget; onBack: () => void; date: string; onSaved: () => void; backLabel?: string;
  customMeal?: CustomMeal;
  onCatalogEditChange?: (editing: boolean) => void;
}) {
  const { colors } = useTheme();
  const { saving } = useFoodLog();
  const custom = useCustomFoods();
  const customId = originalTarget.kind === "add" ? originalTarget.food.customId : undefined;
  const currentItem = customId && custom.state.kind === "ready" ?
    custom.state.document.foods.find(food => food.customId === customId)
      ?? custom.state.document.meals.find(meal => meal.customId === customId) : undefined;
  // Keep actions mounted until a successful delete can return to results.
  const [originalItem] = useState(() => currentItem);
  const item = currentItem ?? originalItem;
  const target: FoodSaveTarget = originalTarget.kind === "add" && item ? { kind: "add", food: item } : originalTarget;
  const customMeal = item && "ingredients" in item ? item : originalMeal;
  const [editorItem, setEditorItem] = useState<CustomFood | CustomMeal | null>(null);
  useEffect(() => () => onCatalogEditChange?.(false), [onCatalogEditChange]);
  const [amount, setAmount] = useState(target.kind === "edit" ? nutritionAmountText(target.entry.grams) :
    target.food.customId ? nutritionAmountText(target.food.portions[0]?.grams ?? 100) : "100");
  const [focused, setFocused] = useState(false);
  const busy = saving || custom.saving;
  function cancelEdit() {
    setEditorItem(null);
    onCatalogEditChange?.(false);
  }
  function finishEdit(updated: CustomFood | CustomMeal) {
    Keyboard.dismiss();
    setAmount(nutritionAmountText(updated.portions[0].grams));
    cancelEdit();
  }
  if (editorItem) return "ingredients" in editorItem ?
    <CreateMealForm existing={editorItem} onCancel={cancelEdit} onSaved={finishEdit} /> :
    <CreateFoodForm existing={editorItem} onCancel={cancelEdit} onSaved={finishEdit} />;
  const grams = parseFoodGrams(amount);
  const nutrition = grams === null ? null : target.kind === "edit" ? nutritionForEntry(target.entry, grams) : nutritionForGrams(target.food, grams);
  return (
    <View testID="food-nutrition-detail" style={{ gap: spacing.layout }}>
      <FoodButton label={target.kind === "edit" ? "Cancel edit" : backLabel} disabled={busy} onPress={onBack} />
      {target.kind === "edit" && <AppText variant="heading" accessibilityRole="header">Edit logged {customMeal ? "meal" : "food"}</AppText>}
      <AppText variant="heading" accessibilityRole="header" selectable>{target.kind === "edit" ? target.entry.name : target.food.name}</AppText>
      {target.kind === "add" && <AppText variant="caption" muted selectable>{target.food.category}</AppText>}
      {target.kind === "add" && item && <CustomItemActions item={item} disabled={saving}
        onEdit={() => { setEditorItem(item); onCatalogEditChange?.(true); }} onDeleted={onBack} />}
      <View style={{ gap: spacing.xs }}>
        <AppText variant="label">Amount (g)</AppText>
        <TextInput accessibilityLabel="Amount (g)" accessibilityHint="Changes the nutrition preview for this weight"
          value={amount} onChangeText={setAmount} editable={!busy} inputMode="decimal" keyboardType="decimal-pad"
          maxLength={16} selectTextOnFocus returnKeyType="done"
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          selectionColor={colors.ring}
          style={{ minHeight: 48, padding: spacing.layout, borderWidth: 1, borderRadius: radius.control,
            borderColor: grams === null ? colors.error : focused ? colors.ring : colors.border,
            backgroundColor: colors.background, color: colors.foreground, fontFamily: fonts.regular, fontSize: 16 }} />
      </View>
      {nutrition && grams !== null ? (
        <View style={{ gap: spacing.layout }}>
          <AppText variant="caption" muted selectable>Nutrition for {decimal(grams)} g</AppText>
          <AppText variant="heading" selectable>{Math.round(nutrition.calories).toLocaleString()} kcal</AppText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.layout }}>
            {macroCategories.map(({ key, label }) => (
              <View key={key} style={{ flexGrow: 1, gap: spacing.xs }}>
                <AppText variant="label" style={{ color: colors[key] }}>{label}</AppText>
                <AppText selectable>{decimal(nutrition[key])} g</AppText>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <AppText variant="caption" accessibilityRole="alert" style={{ color: colors.error }}>
          Enter an amount greater than 0 and up to 10,000 g.
        </AppText>
      )}
      <FoodLoggingControls target={target} grams={grams} date={date} onSaved={onSaved} itemKind={customMeal ? "meal" : "food"} />
      {customMeal && target.kind === "add" && <View style={{ gap: spacing.sm }}>
        <AppText variant="label" accessibilityRole="header">Ingredients</AppText>
        {customMeal.ingredients.map(ingredient => <AppText key={ingredient.id} variant="caption" muted selectable>
          {ingredient.food.name} · {decimal(ingredient.grams * (grams ?? customMeal.portions[0].grams) / customMeal.portions[0].grams)} g
        </AppText>)}
        {Object.keys(customMeal.overrides).length > 0 && <AppText variant="caption" muted>Includes your nutrition overrides.</AppText>}
      </View>}
      {target.kind === "add" && <>
      <AppText variant="label" accessibilityRole="header">Serving sizes</AppText>
      <View style={{ gap: spacing.sm }}>
        <FoodButton label="100 g" selected={grams === 100} disabled={busy} onPress={() => setAmount("100")} />
        {target.food.portions.map(portion => (
          <FoodButton key={`${portion.label}-${portion.grams}`} label={`${portion.label}, ${decimal(portion.grams)} g`}
            selected={grams === portion.grams} disabled={busy} onPress={() => setAmount(nutritionAmountText(portion.grams))} />
        ))}
      </View>
      </>}
    </View>
  );
}
