import { useMemo, useState } from "react";
import { Pressable, View, type ViewProps } from "react-native";
import { AppText, Panel } from "../components/ui";
import { useTheme } from "../theme/provider";
import { radius, spacing } from "../theme/tokens";
import { foodPageSize, type CatalogFood } from "./catalog.ts";
import { foodDatabase, foodSource } from "./database";
import { FoodButton } from "./food-button";
import { FoodNutritionDetail } from "./nutrition-detail";

export function FoodSearchResults({ query, onLayout, onNavigate, date, onLogged }: {
  query: string;
  onLayout: ViewProps["onLayout"];
  onNavigate: () => void;
  date: string;
  onLogged: () => void;
}) {
  const { colors } = useTheme();
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<CatalogFood | null>(null);
  const result = useMemo(() => foodDatabase.search(query, page), [query, page]);
  function changePage(nextPage: number) {
    setPage(nextPage);
    onNavigate();
  }
  function selectFood(food: CatalogFood | null) {
    setSelected(food);
    onNavigate();
  }
  return (
    <Panel testID="food-catalog-results" onLayout={onLayout} style={{ gap: spacing.layout }}>
      {selected ? <FoodNutritionDetail target={{ kind: "add", food: selected }} date={date} onSaved={onLogged} onBack={() => selectFood(null)} /> : (
        <>
          <AppText variant="heading" accessibilityRole="header">Food database</AppText>
          <AppText variant="caption" muted accessibilityLiveRegion="polite">
            {query.trim().length < 2 ? "Type at least two letters to search foods." :
              result.total ? `${result.total.toLocaleString()} matching foods. Nutrition per 100 g.` :
              "No foods found. Try a simpler name or a different preparation."}
          </AppText>
          {result.items.map(food => <FoodResult key={food.fdcId} food={food} onSelect={() => selectFood(food)} />)}
          {result.total > foodPageSize && (
            <View style={{ gap: spacing.sm }}>
              <AppText variant="caption" muted>Showing {page * foodPageSize + 1} to {Math.min((page + 1) * foodPageSize, result.total)} of {result.total.toLocaleString()}</AppText>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.layout }}>
                <FoodButton label="Previous" accessibilityLabel="Previous food results" disabled={page === 0} onPress={() => changePage(page - 1)} />
                <FoodButton label="Next" accessibilityLabel="Next food results" disabled={(page + 1) * foodPageSize >= result.total} onPress={() => changePage(page + 1)} />
              </View>
            </View>
          )}
        </>
      )}
      <View style={{ borderTopWidth: 1, borderColor: colors.border, paddingTop: spacing.layout }}>
        <AppText variant="caption" muted selectable>{foodSource.name} · {foodSource.dataset}</AppText>
      </View>
    </Panel>
  );
}

function FoodResult({ food, onSelect }: { food: CatalogFood; onSelect: () => void }) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const macros = food.per100g;
  const grams = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 1 });
  return (
    <Pressable testID="food-result" accessibilityRole="button" accessibilityLabel={`View nutrition for ${food.name}`}
      accessibilityHint="Choose a serving size or enter a weight" onPress={onSelect}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={({ pressed }) => ({ minHeight: 88, padding: spacing.layout, gap: spacing.xs,
        borderWidth: 1, borderRadius: radius.control, borderColor: focused ? colors.ring : colors.border,
        backgroundColor: pressed ? colors.accent : colors.background })}>
      <AppText variant="label">{food.name}</AppText>
      <AppText variant="caption" muted>{food.category} · {Math.round(macros.calories)} kcal</AppText>
      <AppText variant="caption" muted>Carbs {grams(macros.carbs)} g · Protein {grams(macros.protein)} g · Fat {grams(macros.fat)} g</AppText>
    </Pressable>
  );
}
