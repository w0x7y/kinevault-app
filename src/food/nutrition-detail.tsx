import { useState } from "react";
import { TextInput, View } from "react-native";
import { AppText } from "../components/ui";
import { useTheme } from "../theme/provider";
import { fonts, radius, spacing } from "../theme/tokens";
import { nutritionForGrams, parseFoodGrams } from "./catalog.ts";
import { nutritionForEntry, type FoodSaveTarget } from "./log-model.ts";
import { macroCategories } from "../daily/nutrition.ts";
import { FoodButton } from "./food-button";
import { FoodLoggingControls } from "./logging-controls";
import { useFoodLog } from "./log-provider";

const decimal = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 1 });

export function FoodNutritionDetail({ target, onBack, date, onSaved }: { target: FoodSaveTarget; onBack: () => void; date: string; onSaved: () => void }) {
  const { colors } = useTheme();
  const { saving } = useFoodLog();
  const [amount, setAmount] = useState(target.kind === "edit" ? String(target.entry.grams) : "100");
  const [focused, setFocused] = useState(false);
  const grams = parseFoodGrams(amount);
  const nutrition = grams === null ? null : target.kind === "edit" ? nutritionForEntry(target.entry, grams) : nutritionForGrams(target.food, grams);
  return (
    <View testID="food-nutrition-detail" style={{ gap: spacing.layout }}>
      <FoodButton label={target.kind === "edit" ? "Cancel edit" : "Back to food results"} disabled={saving} onPress={onBack} />
      {target.kind === "edit" && <AppText variant="heading" accessibilityRole="header">Edit logged food</AppText>}
      <AppText variant="heading" accessibilityRole="header" selectable>{target.kind === "edit" ? target.entry.name : target.food.name}</AppText>
      {target.kind === "add" && <AppText variant="caption" muted selectable>{target.food.category}</AppText>}
      <View style={{ gap: spacing.xs }}>
        <AppText variant="label">Amount (g)</AppText>
        <TextInput accessibilityLabel="Amount (g)" accessibilityHint="Changes the nutrition preview for this weight"
          value={amount} onChangeText={setAmount} editable={!saving} inputMode="decimal" keyboardType="decimal-pad"
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
      <FoodLoggingControls target={target} grams={grams} date={date} onSaved={onSaved} />
      {target.kind === "add" && <>
      <AppText variant="label" accessibilityRole="header">Serving sizes</AppText>
      <View style={{ gap: spacing.sm }}>
        <FoodButton label="100 g" selected={grams === 100} disabled={saving} onPress={() => setAmount("100")} />
        {target.food.portions.map(portion => (
          <FoodButton key={`${portion.label}-${portion.grams}`} label={`${portion.label}, ${decimal(portion.grams)} g`}
            selected={grams === portion.grams} disabled={saving} onPress={() => setAmount(String(portion.grams))} />
        ))}
      </View>
      </>}
    </View>
  );
}
