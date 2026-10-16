import { View } from "react-native";
import { AppText } from "../components/ui";
import { Icon } from "../components/icon";
import { Tappable } from "../components/tappable";
import { useTheme } from "../theme/provider";
import { fonts, radius, spacing } from "../theme/tokens";
import { Badge } from "./food-ui";
import { beverageForFood } from "./beverage.ts";
import type { CatalogFood } from "./catalog.ts";
import type { CatalogKind } from "./meal-model.ts";

export const genericDrinkNotice =
  "Generic drinks use approximate nutrition. Use Scan for your exact product.";

export function FoodResult({
  food,
  onSelect,
  kind = "food",
  action = "view",
  disabled = false,
  genericMatch = false,
}: {
  food: CatalogFood;
  onSelect: () => void;
  kind?: CatalogKind;
  action?: "view" | "add";
  disabled?: boolean;
  genericMatch?: boolean;
}) {
  const { colors } = useTheme();
  const beverage = beverageForFood(food);
  const macros =
    action === "add"
      ? food.per100g
      : beverage?.kind === "known-volume"
        ? beverage.per100ml
        : beverage
          ? undefined
          : food.per100g;
  const unit = action === "add" || !beverage ? "g" : "ml";
  const grams = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 1 });
  return (
    <Tappable
      testID="food-result"
      label={`${action === "add" ? `Add ${food.name} to meal` : `View nutrition for ${food.name}`}${food.customId ? `, custom ${kind}` : ""}${food.importSource?.method === "barcode" ? ", imported by barcode" : ""}`}
      hint={`${action === "add" ? "Adds this food as an ingredient" : beverage ? "Enter the drink amount in milliliters" : "Choose a serving size or enter a weight"}${genericMatch ? `. ${genericDrinkNotice}` : ""}`}
      disabled={disabled}
      onPress={onSelect}
      feedback="fill"
      style={{
        minHeight: 72,
        marginHorizontal: -spacing.sm,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
        gap: 2,
        borderRadius: radius.control,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
            <AppText
              variant="label"
              style={{ flexShrink: 1, fontSize: 15, lineHeight: 21, fontFamily: fonts.semibold }}
            >
              {food.name}
            </AppText>
            {food.customId && (
              <Badge
                testID="custom-food-icon"
                icon="user-pen"
                label={kind === "meal" ? "Your meal" : "Your food"}
                tone="brand"
              />
            )}
            {food.importSource?.method === "barcode" && (
              <Badge testID="scanned-food-icon" icon="barcode" label="Scanned" />
            )}
            {genericMatch && <Badge testID="generic-drink-match" label="Generic" />}
          </View>
          <AppText variant="caption" muted numberOfLines={2}>
            <AppText variant="caption" style={{ fontFamily: fonts.semibold }}>
              {macros
                ? `${Math.round(macros.calories)} kcal per 100 ${unit}`
                : "Enter label nutrition per 100 ml"}
            </AppText>
            {" · "}
            {food.brand ? `${food.brand} · ` : ""}
            {food.category}
          </AppText>
          {macros && (
            <AppText variant="caption" muted style={{ fontSize: 12, lineHeight: 16 }}>
              Carbs {grams(macros.carbs)} g · Protein {grams(macros.protein)} g · Fat{" "}
              {grams(macros.fat)} g
            </AppText>
          )}
        </View>
        <Icon
          name={action === "add" ? "plus" : "chevron-right"}
          size={action === "add" ? 18 : 16}
          color={colors.mutedForeground}
        />
      </View>
    </Tappable>
  );
}

/** The one explanation shown above generic drink matches. */
export function GenericNotice() {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: radius.tile,
        backgroundColor: colors.muted,
      }}
    >
      <Icon name="circle-info" size={16} color={colors.mutedForeground} />
      <AppText variant="caption" muted style={{ flex: 1 }}>
        {genericDrinkNotice}
      </AppText>
    </View>
  );
}
