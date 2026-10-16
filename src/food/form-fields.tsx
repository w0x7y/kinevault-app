import { View } from "react-native";
import { TextField } from "../components/text-field";
import { useTheme } from "../theme/provider";
import { spacing } from "../theme/tokens";
import type { Nutrition } from "./catalog.ts";

const nutritionFields = [
  { key: "calories", label: "Calories (kcal)" },
  { key: "carbs", label: "Carbs (g)" },
  { key: "protein", label: "Protein (g)" },
  { key: "fat", label: "Fat (g)" },
] as const;

export function NutritionFields({
  values,
  errors,
  onChange,
  disabled,
}: {
  values: Record<keyof Nutrition, string>;
  errors: Partial<Record<keyof Nutrition, string>>;
  onChange: (key: keyof Nutrition, value: string) => void;
  disabled: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", gap: spacing.md }}
    >
      {nutritionFields.map(({ key, label }) => (
        <View key={key} style={{ flexGrow: 1, flexBasis: "45%", minWidth: 0 }}>
          <TextField
            label={label}
            value={values[key]}
            onChange={(value) => onChange(key, value)}
            error={errors[key]}
            disabled={disabled}
            kind="decimal"
            labelColor={key === "calories" ? undefined : colors[key]}
          />
        </View>
      ))}
    </View>
  );
}
