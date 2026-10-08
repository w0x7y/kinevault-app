import type { Meal } from "../daily/model";
import { useMemo, useState } from "react";
import { Keyboard, View, type ViewProps } from "react-native";
import { AppText, Panel } from "../components/ui";
import { useTheme } from "../theme/provider";
import { spacing } from "../theme/tokens";
import { foodKey, foodPageSize, type CatalogFood } from "./catalog.ts";
import { foodSource } from "./database";
import { useCustomFoods } from "./custom-provider";
import { FoodButton } from "./food-button";
import { FoodResult, genericDrinkNotice } from "./food-result";
import { FoodNutritionDetail } from "./nutrition-detail";

export function FoodSearchResults({
  query,
  onLayout,
  onNavigate,
  date,
  onLogged,
  onCatalogEditChange,
  initialMeal,
}: {
  query: string;
  initialMeal?: Meal;
  onLayout: ViewProps["onLayout"];
  onNavigate: () => void;
  date: string;
  onLogged: () => void;
  onCatalogEditChange?: (editing: boolean) => void;
}) {
  const { colors } = useTheme();
  const { selection } = useCustomFoods();
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<CatalogFood | null>(null);
  const result = useMemo(
    () => selection.search({ purpose: "logging", query, page }),
    [selection, query, page],
  );
  const hasGenericMatches = result.rows.some((row) => row.genericMatch);
  if (page !== result.page) setPage(result.page);
  const selectedItem = selected?.customId ? selection.savedItem(selected.customId) : undefined;
  function changePage(nextPage: number) {
    setPage(nextPage);
    onNavigate();
  }
  function selectFood(food: CatalogFood | null) {
    Keyboard.dismiss();
    setSelected(food);
    onNavigate();
  }
  return (
    <Panel testID="food-catalog-results" onLayout={onLayout} style={{ gap: spacing.layout }}>
      {selected ? (
        <FoodNutritionDetail
          initialMeal={initialMeal}
          target={{ kind: "add", food: selected }}
          date={date}
          onCatalogEditChange={onCatalogEditChange}
          onSaved={onLogged}
          onBack={() => selectFood(null)}
          backLabel="Back to food results"
        />
      ) : (
        <>
          <AppText variant="heading" accessibilityRole="header">
            Food database
          </AppText>
          <AppText variant="caption" muted accessibilityLiveRegion="polite">
            {query.trim().length < 2
              ? "Type at least two letters to search foods and meals."
              : result.total
                ? `${result.total.toLocaleString()} matching foods and meals.`
                : "No foods or meals found. Try a simpler name or a different preparation."}
          </AppText>
          {hasGenericMatches && <AppText muted>{genericDrinkNotice}</AppText>}
          {result.rows.map(({ food, kind, genericMatch }) => (
            <FoodResult
              key={foodKey(food)}
              kind={kind}
              genericMatch={genericMatch}
              food={food}
              onSelect={() => selectFood(food)}
            />
          ))}
          {result.pageCount > 1 && (
            <View style={{ gap: spacing.sm }}>
              <AppText variant="caption" muted>
                Showing {result.page * foodPageSize + 1} to{" "}
                {Math.min((result.page + 1) * foodPageSize, result.total)} of{" "}
                {result.total.toLocaleString()}
              </AppText>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  gap: spacing.layout,
                }}
              >
                <FoodButton
                  label="Previous"
                  accessibilityLabel="Previous food results"
                  disabled={result.page === 0}
                  onPress={() => changePage(result.page - 1)}
                />
                <FoodButton
                  label="Next"
                  accessibilityLabel="Next food results"
                  disabled={result.page + 1 >= result.pageCount}
                  onPress={() => changePage(result.page + 1)}
                />
              </View>
            </View>
          )}
        </>
      )}
      <View style={{ borderTopWidth: 1, borderColor: colors.border, paddingTop: spacing.layout }}>
        <AppText variant="caption" muted selectable>
          {selectedItem?.kind === "meal"
            ? "Custom meal · Nutrition from ingredients and your overrides"
            : selected?.customId
              ? "Custom food · Nutrition entered by you"
              : `${foodSource.name} · ${foodSource.dataset}`}
        </AppText>
      </View>
    </Panel>
  );
}
