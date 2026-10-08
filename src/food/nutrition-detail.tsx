import { useEffect, useState } from "react";
import { Keyboard, TextInput, View } from "react-native";
import { AppText } from "../components/ui";
import { ProductAttribution } from "./product-attribution";
import { useTheme } from "../theme/provider";
import { fonts, radius, spacing } from "../theme/tokens";
import type { FoodSaveTarget } from "./log-model.ts";
import { prepareFoodLogging } from "./logging-preparation.ts";
import type { Meal } from "../daily/model";
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
import { useFoodDrafts } from "./draft-provider";
import { foodDatabase } from "./database";
import { NutritionFields } from "./form-fields";
import type { Nutrition } from "./catalog.ts";
import { nutritionAmountText } from "./number-input.ts";

const decimal = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 1 });

export function FoodNutritionDetail({
  target: originalTarget,
  onBack,
  date,
  onSaved,
  backLabel = "Back to food results",
  onCatalogEditChange,
  initialMeal,
  savedCatalog = false,
}: {
  target: FoodSaveTarget;
  onBack: () => void;
  date: string;
  onSaved: () => void;
  backLabel?: string;
  initialMeal?: Meal;
  savedCatalog?: boolean;
  onCatalogEditChange?: (editing: boolean) => void;
}) {
  const { colors } = useTheme();
  const { saving } = useFoodLog();
  const custom = useCustomFoods();
  const drafts = useFoodDrafts();
  const customId =
    originalTarget.kind === "add" ? originalTarget.food.customId : originalTarget.entry.customId;
  const currentItem = customId ? custom.selection.savedItem(customId) : undefined;
  // Keep actions mounted until a successful delete can return to results.
  const [originalItem] = useState(() => currentItem);
  const item = currentItem ?? originalItem;
  const target: FoodSaveTarget =
    originalTarget.kind === "add" && item ? { kind: "add", food: item.food } : originalTarget;
  const customMeal = item?.kind === "meal" ? item.food : undefined;
  const [editingCatalog, setEditingCatalog] = useState(false);
  useEffect(() => () => onCatalogEditChange?.(false), [onCatalogEditChange]);
  const [labelNutrition, setLabelNutrition] = useState<Record<keyof Nutrition, string>>({
    calories: "",
    carbs: "",
    protein: "",
    fat: "",
  });
  const [amount, setAmount] = useState(
    target.kind === "edit"
      ? nutritionAmountText(target.entry.grams ?? 100)
      : target.food.customId
        ? nutritionAmountText(target.food.portions[0]?.grams ?? 100)
        : "100",
  );
  const [meal, setMeal] = useState<Meal>(
    target.kind === "edit" ? target.entry.meal : (initialMeal ?? "breakfast"),
  );
  const [drinkAmount, setDrinkAmount] = useState(
    target.kind === "edit" && target.entry.drinkMl !== undefined
      ? String(target.entry.drinkMl)
      : "",
  );
  const [servingsExpanded, setServingsExpanded] = useState(false);
  const [catalogSaved, setCatalogSaved] = useState(savedCatalog);
  const [focused, setFocused] = useState(false);
  const busy = saving || custom.saving;
  function changeMeal(nextMeal: Meal) {
    setMeal(nextMeal);
    if (target.kind === "add") drafts.setMealIntent(nextMeal);
  }
  function cancelEdit() {
    setEditingCatalog(false);
    onCatalogEditChange?.(false);
  }
  function finishEdit(updated: CustomFood | CustomMeal) {
    Keyboard.dismiss();
    setCatalogSaved(true);
    setAmount(nutritionAmountText(updated.portions[0]?.grams ?? 100));
    cancelEdit();
  }
  if (editingCatalog && drafts.session)
    return drafts.session.kind === "meal" ? (
      <CreateMealForm session={drafts.session} onCancel={cancelEdit} onSaved={finishEdit} />
    ) : (
      <CreateFoodForm session={drafts.session} onCancel={cancelEdit} onSaved={finishEdit} />
    );
  const preparation = prepareFoodLogging({
    target,
    date,
    fields: { grams: amount, drinkMl: drinkAmount, meal, labelNutrition },
    findFood: foodDatabase.getById,
    catalogItem: currentItem?.food,
  });
  const grams = preparation.measurement === "grams" ? preparation.amount : null;
  const invalidDrinkAmount =
    preparation.measurement === "volume" &&
    preparation.status === "invalid" &&
    preparation.reason === "amount";
  const portions = target.kind === "add" ? target.food.portions : [];
  const hundredGramPortion = portions.find((portion) => portion.grams === 100);
  const sourcePortions = portions.filter((portion) => portion !== hundredGramPortion);
  const visiblePortions = servingsExpanded ? sourcePortions : sourcePortions.slice(0, 2);
  return (
    <View testID="food-nutrition-detail" style={{ gap: spacing.layout }}>
      <FoodButton
        label={target.kind === "edit" ? "Cancel edit" : backLabel}
        disabled={busy}
        onPress={onBack}
      />
      {target.kind === "edit" && (
        <AppText variant="heading" accessibilityRole="header">
          Edit logged{" "}
          {preparation.measurement === "volume" ? "drink" : customMeal ? "meal" : "food"}
        </AppText>
      )}
      <AppText variant="heading" accessibilityRole="header" selectable>
        {target.kind === "edit" ? target.entry.name : target.food.name}
      </AppText>
      {target.kind === "add" && (
        <AppText variant="caption" muted selectable>
          {target.food.category}
        </AppText>
      )}
      {target.kind === "add" && target.food.brand && (
        <AppText variant="caption" muted selectable>
          {target.food.brand}
        </AppText>
      )}
      {target.kind === "add" && target.food.importSource?.provider === "open-food-facts" && (
        <ProductAttribution barcode={target.food.importSource.barcode} />
      )}
      {target.kind === "add" && item && (
        <CustomItemActions
          item={item.food}
          disabled={saving}
          onEdit={() => {
            const session = drafts.open(
              item.kind === "meal"
                ? { kind: "edit-meal", item: item.food }
                : { kind: "edit-food", item: item.food },
            );
            setMeal(session.mealIntent);
            setEditingCatalog(true);
            onCatalogEditChange?.(true);
          }}
          onDeleted={onBack}
        />
      )}
      {catalogSaved && (
        <AppText variant="caption" accessibilityLiveRegion="polite">
          Saved to your {customMeal ? "meals" : "foods"}
        </AppText>
      )}
      {preparation.measurement === "volume" && (
        <View style={{ gap: spacing.xs }}>
          <AppText variant="label">Drink amount (ml)</AppText>
          <TextInput
            accessibilityLabel="Drink amount (ml)"
            accessibilityHint="Changes nutrition and adds this volume to the selected day's water total."
            value={drinkAmount}
            onChangeText={setDrinkAmount}
            editable={!busy}
            inputMode="numeric"
            keyboardType="number-pad"
            maxLength={16}
            selectTextOnFocus
            returnKeyType="done"
            selectionColor={colors.ring}
            style={{
              minHeight: 48,
              padding: spacing.layout,
              borderWidth: 1,
              borderRadius: radius.control,
              borderColor: invalidDrinkAmount ? colors.error : colors.border,
              backgroundColor: colors.background,
              color: colors.foreground,
              fontFamily: fonts.regular,
              fontSize: 16,
            }}
          />
          <AppText variant="caption" muted>
            Enter whole millilitres. Nutrition and your water total use this amount.
          </AppText>
          {invalidDrinkAmount && (
            <AppText variant="caption" accessibilityRole="alert" style={{ color: colors.error }}>
              Enter a whole number from 1 to 10,000 ml.
            </AppText>
          )}
        </View>
      )}
      {preparation.measurement === "volume" && preparation.label.kind === "required" && (
        <View style={{ gap: spacing.sm }}>
          <AppText variant="label">Nutrition per 100 ml</AppText>
          <AppText variant="caption" muted>
            This drink has no reliable volume nutrition. Enter all four values from its label. Enter
            0 only when the label lists zero.
          </AppText>
          <NutritionFields
            values={labelNutrition}
            errors={{}}
            disabled={busy}
            onChange={(key, value) =>
              setLabelNutrition((current) => ({ ...current, [key]: value }))
            }
          />
        </View>
      )}
      {preparation.measurement === "grams" && (
        <View style={{ gap: spacing.xs }}>
          <AppText variant="label">Amount (g)</AppText>
          <TextInput
            accessibilityLabel="Amount (g)"
            accessibilityHint="Changes the nutrition preview for this weight"
            value={amount}
            onChangeText={setAmount}
            editable={!busy}
            inputMode="decimal"
            keyboardType="decimal-pad"
            maxLength={16}
            selectTextOnFocus
            returnKeyType="done"
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            selectionColor={colors.ring}
            style={{
              minHeight: 48,
              padding: spacing.layout,
              borderWidth: 1,
              borderRadius: radius.control,
              borderColor: grams === null ? colors.error : focused ? colors.ring : colors.border,
              backgroundColor: colors.background,
              color: colors.foreground,
              fontFamily: fonts.regular,
              fontSize: 16,
            }}
          />
        </View>
      )}
      {target.kind === "add" && preparation.measurement === "grams" && (
        <View style={{ gap: spacing.sm }}>
          <AppText variant="label" accessibilityRole="header">
            Serving sizes
          </AppText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            <View style={{ flexGrow: 1, flexBasis: "45%" }}>
              <FoodButton
                label={hundredGramPortion ? `${hundredGramPortion.label}, 100 g` : "100 g"}
                selected={grams === 100}
                disabled={busy}
                onPress={() => setAmount("100")}
              />
            </View>
            {visiblePortions.map((portion) => (
              <View
                key={`${portion.label}-${portion.grams}`}
                style={{ flexGrow: 1, flexBasis: "45%" }}
              >
                <FoodButton
                  label={`${portion.label}, ${decimal(portion.grams)} g`}
                  selected={grams === portion.grams}
                  disabled={busy}
                  onPress={() => setAmount(nutritionAmountText(portion.grams))}
                />
              </View>
            ))}
          </View>
          {sourcePortions.length > 2 && (
            <FoodButton
              label={servingsExpanded ? "Fewer serving sizes" : "More serving sizes"}
              expanded={servingsExpanded}
              disabled={busy}
              onPress={() => setServingsExpanded((expanded) => !expanded)}
            />
          )}
        </View>
      )}
      {preparation.status === "ready" ? (
        <View style={{ gap: spacing.layout }}>
          <AppText variant="caption" muted selectable>
            Nutrition for {decimal(preparation.amount)}{" "}
            {preparation.measurement === "volume" ? "ml" : "g"}
          </AppText>
          <AppText variant="heading" selectable>
            {Math.round(preparation.nutrition.calories).toLocaleString()} kcal
          </AppText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.layout }}>
            {macroCategories.map(({ key, label }) => (
              <View key={key} style={{ flexGrow: 1, gap: spacing.xs }}>
                <AppText variant="label" style={{ color: colors[key] }}>
                  {label}
                </AppText>
                <AppText selectable>{decimal(preparation.nutrition[key])} g</AppText>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <AppText
          variant="caption"
          accessibilityRole={preparation.measurement === "volume" ? undefined : "alert"}
          muted={preparation.measurement === "volume"}
          style={preparation.measurement === "volume" ? undefined : { color: colors.error }}
        >
          {preparation.message}
        </AppText>
      )}
      <FoodLoggingControls
        preparation={preparation}
        onMealChange={changeMeal}
        onSaved={onSaved}
        itemKind={customMeal ? "meal" : "food"}
      />
      {customMeal && target.kind === "add" && (
        <View style={{ gap: spacing.sm }}>
          <AppText variant="label" accessibilityRole="header">
            Ingredients
          </AppText>
          {customMeal.ingredients.map((ingredient) => (
            <AppText key={ingredient.id} variant="caption" muted selectable>
              {ingredient.food.name} ·{" "}
              {decimal(
                (ingredient.grams * (grams ?? customMeal.portions[0].grams)) /
                  customMeal.portions[0].grams,
              )}{" "}
              g
            </AppText>
          ))}
          {Object.keys(customMeal.overrides).length > 0 && (
            <AppText variant="caption" muted>
              Includes your nutrition overrides.
            </AppText>
          )}
        </View>
      )}
    </View>
  );
}
