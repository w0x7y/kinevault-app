import { useState } from "react";
import { TextInput, View } from "react-native";
import { AppText } from "../components/ui";
import { useTheme } from "../theme/provider";
import { fonts, radius, spacing } from "../theme/tokens";
import type { Nutrition } from "./catalog.ts";

const nutritionFields = [
  { key: "calories", label: "Calories (kcal)" }, { key: "carbs", label: "Carbs (g)" },
  { key: "protein", label: "Protein (g)" }, { key: "fat", label: "Fat (g)" },
] as const;

export function NutritionFields({ values, errors, onChange, disabled }: {
  values: Record<keyof Nutrition, string>; errors: Partial<Record<keyof Nutrition, string>>;
  onChange: (key: keyof Nutrition, value: string) => void; disabled: boolean;
}) {
  const { colors } = useTheme();
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.layout }}>
    {nutritionFields.map(({ key, label }) => <View key={key} style={{ flexGrow: 1, flexBasis: "45%", minWidth: 0 }}>
      <FoodField label={label} value={values[key]} onChange={value => onChange(key, value)}
        error={errors[key]} disabled={disabled} numeric color={key === "calories" ? undefined : colors[key]} />
    </View>)}
  </View>;
}

export function FoodField({ label, value, onChange, error, disabled, numeric, color }: {
  label: string; value: string; onChange: (value: string) => void; error?: string;
  disabled: boolean; numeric?: boolean; color?: string;
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return <View style={{ gap: spacing.xs }}>
    <AppText variant="label" style={color ? { color } : undefined}>{label}</AppText>
    <TextInput accessibilityLabel={label} accessibilityHint={error}
      aria-invalid={Boolean(error)} value={value} onChangeText={onChange} editable={!disabled}
      inputMode={numeric ? "decimal" : "text"} keyboardType={numeric ? "decimal-pad" : "default"}
      maxLength={numeric ? 16 : 400} selectTextOnFocus={numeric} returnKeyType="done"
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} selectionColor={colors.ring}
      style={{ minHeight: 48, minWidth: 0, padding: spacing.layout, borderWidth: 1, borderRadius: radius.control,
        borderColor: error ? colors.error : focused ? colors.ring : colors.border,
        backgroundColor: colors.background, color: colors.foreground, fontFamily: fonts.regular, fontSize: 16 }} />
    {error && <AppText variant="caption" accessibilityRole="alert" style={{ color: colors.error }}>{error}</AppText>}
  </View>;
}
