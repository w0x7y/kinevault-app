import { AppButton } from "../components/button";
import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { AppText } from "../components/ui";
import { spacing } from "../theme/tokens";
import { foodKey, type CatalogFood } from "./catalog.ts";
import { useCustomFoods } from "./custom-provider";
import { TextField } from "../components/text-field";
import { FoodResult, GenericNotice } from "./food-result";
import { useTheme } from "../theme/provider";

export function IngredientSearch({
  onAdd,
  disabled,
}: {
  onAdd: (food: CatalogFood) => void;
  disabled: boolean;
}) {
  const { selection } = useCustomFoods();
  const { colors } = useTheme();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const result = useMemo(
    () => selection.search({ purpose: "ingredient", query, page }),
    [selection, query, page],
  );
  if (page !== result.page) setPage(result.page);
  return (
    <View style={{ gap: spacing.layout }}>
      <TextField
        label="Search ingredients"
        value={query}
        disabled={disabled}
        onChange={(value) => {
          setQuery(value);
          setPage(0);
        }}
      />
      {query.trim().length >= 2 && (
        <View style={{ gap: spacing.sm }}>
          <AppText variant="caption" muted accessibilityLiveRegion="polite">
            {result.total
              ? `${result.total.toLocaleString()} foods. Nutrition per 100 g. Tap a food to add it.`
              : result.exclusions.volumeOnly
                ? "No matching foods with gram nutrition."
                : "No foods found. Try a different name."}
          </AppText>
          {result.rows.some((row) => row.genericMatch) && <GenericNotice />}
          {result.exclusions.volumeOnly > 0 && (
            <AppText variant="caption" muted>
              Drinks with label nutrition per ml need a reliable gram weight conversion to use as
              ingredients.
            </AppText>
          )}
          {result.rows.map(({ food, kind, genericMatch }, index) => (
            <View
              key={foodKey(food)}
              style={{
                borderTopWidth: index ? StyleSheet.hairlineWidth : 0,
                borderColor: colors.border,
              }}
            >
              <FoodResult
                food={food}
                kind={kind}
                action="add"
                disabled={disabled}
                genericMatch={genericMatch}
                onSelect={() => {
                  onAdd(food);
                  setQuery("");
                  setPage(0);
                }}
              />
            </View>
          ))}
          {result.pageCount > 1 && (
            <View
              style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.layout }}
            >
              <AppButton
                icon="chevron-left"
                label="Previous"
                accessibilityLabel="Previous ingredient results"
                disabled={disabled || result.page === 0}
                onPress={() => setPage(result.page - 1)}
              />
              <AppButton
                icon="chevron-right"
                label="Next"
                accessibilityLabel="Next ingredient results"
                disabled={disabled || result.page + 1 >= result.pageCount}
                onPress={() => setPage(result.page + 1)}
              />
            </View>
          )}
        </View>
      )}
    </View>
  );
}
