import { useMemo, useState } from "react";
import { Pressable, View, type ViewProps } from "react-native";
import { AppText, Panel } from "../components/ui";
import { Icon } from "../components/icon";
import { useTheme } from "../theme/provider";
import { radius, spacing } from "../theme/tokens";
import { foodKey, foodPageSize, type CatalogFood } from "./catalog.ts";
import { foodSource } from "./database";
import { useCustomFoods } from "./custom-provider";
import { FoodButton } from "./food-button";
import { FoodNutritionDetail } from "./nutrition-detail";
import type { CatalogKind } from "./meal-model.ts";

export function FoodSearchResults({ kind = "food", query, onLayout, onNavigate, date, onLogged, onCatalogEditChange }: {
  kind?: CatalogKind;
  query: string;
  onLayout: ViewProps["onLayout"];
  onNavigate: () => void;
  date: string;
  onLogged: () => void;
  onCatalogEditChange?: (editing: boolean) => void;
}) {
  const { colors } = useTheme();
  const { catalog, mealCatalog, state } = useCustomFoods();
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<CatalogFood | null>(null);
  const result = useMemo(() => {
    if (kind === "food") return catalog.search(query, page);
    if (query.trim()) return mealCatalog.search(query, page);
    const meals = state.kind === "ready" ? state.document.meals : [];
    return { items: meals.slice(page * foodPageSize, (page + 1) * foodPageSize), total: meals.length };
  }, [catalog, mealCatalog, state, kind, query, page]);
  const lastPage = Math.max(0, Math.ceil(result.total / foodPageSize) - 1);
  if (page > lastPage) setPage(lastPage);
  const selectedMeal = kind === "meal" && state.kind === "ready" ? state.document.meals.find(meal => meal.customId === selected?.customId) : undefined;
  function changePage(nextPage: number) {
    setPage(nextPage);
    onNavigate();
  }
  function selectFood(food: CatalogFood | null) {
    setSelected(food);
    onNavigate();
  }
  if (kind === "meal" && state.kind !== "ready") return null;
  return (
    <Panel testID="food-catalog-results" onLayout={onLayout} style={{ gap: spacing.layout }}>
      {selected ? <FoodNutritionDetail target={{ kind: "add", food: selected }} customMeal={selectedMeal} date={date}
        onCatalogEditChange={onCatalogEditChange}
        onSaved={onLogged} onBack={() => selectFood(null)} backLabel={kind === "meal" ? "Back to meal results" : "Back to food results"} /> : (
        <>
          <AppText variant="heading" accessibilityRole="header">{kind === "meal" ? "Saved meals" : "Food database"}</AppText>
          <AppText variant="caption" muted accessibilityLiveRegion="polite">
            {kind === "meal" && !query.trim() ? result.total ? `${result.total} saved meals. Nutrition per 100 g.` :
              "No meals created yet. Tap Create food/meal to build your first meal." :
              query.trim().length < 2 ? `Type at least two letters to search ${kind === "meal" ? "meals" : "foods"}.` :
              result.total ? `${result.total.toLocaleString()} matching ${kind === "meal" ? "meals" : "foods"}. Nutrition per 100 g.` :
              kind === "meal" ? "No meals found. Try another name or create a meal." : "No foods found. Try a simpler name or a different preparation."}
          </AppText>
          {result.items.map(food => <FoodResult key={foodKey(food)} kind={kind} food={food} onSelect={() => selectFood(food)} />)}
          {result.total > foodPageSize && (
            <View style={{ gap: spacing.sm }}>
              <AppText variant="caption" muted>Showing {page * foodPageSize + 1} to {Math.min((page + 1) * foodPageSize, result.total)} of {result.total.toLocaleString()}</AppText>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.layout }}>
                <FoodButton label="Previous" accessibilityLabel={`Previous ${kind} results`} disabled={page === 0} onPress={() => changePage(page - 1)} />
                <FoodButton label="Next" accessibilityLabel={`Next ${kind} results`} disabled={(page + 1) * foodPageSize >= result.total} onPress={() => changePage(page + 1)} />
              </View>
            </View>
          )}
        </>
      )}
      <View style={{ borderTopWidth: 1, borderColor: colors.border, paddingTop: spacing.layout }}>
        <AppText variant="caption" muted selectable>{kind === "meal" ? "Custom meals · Nutrition from ingredients and your overrides" :
          selected?.customId ? "Custom food · Nutrition entered by you" :
          `${foodSource.name} · ${foodSource.dataset}`}</AppText>
      </View>
    </Panel>
  );
}

export function FoodResult({ food, onSelect, kind = "food", action = "view", disabled = false }: {
  food: CatalogFood; onSelect: () => void; kind?: CatalogKind; action?: "view" | "add"; disabled?: boolean;
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const macros = food.per100g;
  const grams = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 1 });
  return (
    <Pressable testID="food-result" accessibilityRole="button"
      accessibilityLabel={`${action === "add" ? `Add ${food.name} to meal` : `View nutrition for ${food.name}`}${food.customId ? `, custom ${kind}` : ""}`}
      accessibilityHint={action === "add" ? "Adds this food as an ingredient" : "Choose a serving size or enter a weight"}
      disabled={disabled} accessibilityState={{ disabled }} onPress={onSelect}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={({ pressed }) => ({ minHeight: 88, padding: spacing.layout, gap: spacing.xs,
        borderWidth: 1, borderRadius: radius.control, borderColor: focused ? colors.ring : colors.border,
        backgroundColor: pressed ? colors.accent : colors.background })}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <AppText variant="label" style={{ flex: 1 }}>{food.name}</AppText>
        {food.customId && <Icon testID="custom-food-icon" name="user-pen" size={14} color={colors.primary} />}
      </View>
      <AppText variant="caption" muted>{food.category} · {Math.round(macros.calories)} kcal</AppText>
      <AppText variant="caption" muted>Carbs {grams(macros.carbs)} g · Protein {grams(macros.protein)} g · Fat {grams(macros.fat)} g</AppText>
    </Pressable>
  );
}
