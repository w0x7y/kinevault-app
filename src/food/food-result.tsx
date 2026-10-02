import { useState } from "react";
import { Pressable, View } from "react-native";
import { AppText } from "../components/ui";
import { Icon } from "../components/icon";
import { useTheme } from "../theme/provider";
import { radius, spacing } from "../theme/tokens";
import { beverageForFood } from "./beverage.ts";
import type { CatalogFood } from "./catalog.ts";
import type { CatalogKind } from "./meal-model.ts";

export const genericDrinkNotice = "Generic drinks use approximate nutrition. Use Scan for your exact product.";

export function FoodResult({ food, onSelect, kind = "food", action = "view", disabled = false, genericMatch = false }: {
  food: CatalogFood; onSelect: () => void; kind?: CatalogKind; action?: "view" | "add"; disabled?: boolean; genericMatch?: boolean;
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const beverage = beverageForFood(food);
  const macros = action === "add" ? food.per100g : beverage?.kind === "known-volume" ? beverage.per100ml : beverage ? undefined : food.per100g;
  const unit = action === "add" || !beverage ? "g" : "ml";
  const grams = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 1 });
  return (
    <Pressable testID="food-result" accessibilityRole="button"
      accessibilityLabel={`${action === "add" ? `Add ${food.name} to meal` : `View nutrition for ${food.name}`}${food.customId ? `, custom ${kind}` : ""}${food.importSource?.method === "barcode" ? ", imported by barcode" : ""}`}
      accessibilityHint={`${action === "add" ? "Adds this food as an ingredient" : beverage ? "Enter the drink amount in millilitres" : "Choose a serving size or enter a weight"}${genericMatch ? `. ${genericDrinkNotice}` : ""}`}
      disabled={disabled} accessibilityState={{ disabled }} onPress={onSelect}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={({ pressed }) => ({ minHeight: 88, padding: spacing.layout, gap: spacing.xs,
        borderWidth: 1, borderRadius: radius.control, borderColor: focused ? colors.ring : colors.border,
        backgroundColor: pressed ? colors.accent : colors.background })}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <AppText variant="label" style={{ flex: 1 }}>{food.name}</AppText>
        {food.customId && <Icon testID="custom-food-icon" name="user-pen" size={14} color={colors.primary} />}
        {food.importSource?.method === "barcode" && <Icon testID="scanned-food-icon" name="barcode" size={14} color={colors.primary} />}
      </View>
      <AppText variant="caption" muted>{food.brand ? `${food.brand} · ` : ""}{food.category} · {macros ? `${Math.round(macros.calories)} kcal per 100 ${unit}` : "Enter label nutrition per 100 ml"}</AppText>
      {macros && <AppText variant="caption" muted>Carbs {grams(macros.carbs)} g · Protein {grams(macros.protein)} g · Fat {grams(macros.fat)} g</AppText>}
      {genericMatch && <AppText testID="generic-drink-match" variant="caption" muted>Generic</AppText>}
    </Pressable>
  );
}
