import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { AppText } from "../components/ui";
import { useTheme } from "../theme/provider";
import { radius, spacing } from "../theme/tokens";
import {
  type DetailedNutrientDraft,
  type DetailedNutrientErrors,
} from "./detailed-nutrient-drafts.ts";
import {
  detailedNutrients,
  type DetailedNutrientKey,
  type DetailedNutrients,
} from "./nutrients.ts";
import { nutritionAmountText } from "./number-input.ts";
import { FoodField } from "./form-fields";
import { FoodButton } from "./food-button";

export function DetailedNutrientFields({
  values = {},
  errors,
  onChange,
  disabled,
  calculated,
  onReset,
}: {
  values?: DetailedNutrientDraft;
  errors?: DetailedNutrientErrors;
  onChange: (key: DetailedNutrientKey, value: string) => void;
  disabled: boolean;
  calculated?: DetailedNutrients;
  onReset?: () => void;
}) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(() =>
    Object.values(values).some((value) => value?.trim()),
  );
  const [focused, setFocused] = useState(false);
  // Validation runs on the entire draft, even when inputs are hidden.
  useEffect(() => {
    if (errors && Object.keys(errors).length) setExpanded(true);
  }, [errors]);
  const isMeal = onReset !== undefined;
  return (
    <View style={{ gap: spacing.layout }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="More nutrients"
        accessibilityState={{ disabled, expanded }}
        aria-expanded={expanded}
        disabled={disabled}
        onPress={() => setExpanded((value) => !value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={({ pressed }) => ({
          minHeight: 44,
          padding: spacing.layout,
          borderWidth: 1,
          borderRadius: radius.control,
          borderColor: focused ? colors.ring : colors.border,
          backgroundColor: pressed ? colors.accent : colors.secondary,
          justifyContent: "center",
          opacity: disabled ? 0.5 : 1,
        })}
      >
        <AppText variant="label" style={{ color: colors.secondaryForeground }}>
          {expanded ? "More nutrients (hide)" : "More nutrients"}
        </AppText>
      </Pressable>
      {expanded && (
        <View style={{ gap: spacing.layout }}>
          <AppText variant="caption" muted>
            {isMeal
              ? "Amounts are for the whole meal. Edit a value to override it. Clear a field to use its calculated amount."
              : "Optional amounts per serving. Leave unknown values blank. Enter 0 when the label lists zero."}
          </AppText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.layout }}>
            {detailedNutrients.map(({ key, label, unit }) => {
              const amount = calculated?.[key] ?? null;
              const calculatedText =
                amount === null ? "" : nutritionAmountText(Number(amount.toPrecision(15)));
              const value = values[key] ?? calculatedText;
              return (
                <View
                  key={key}
                  style={{ flexGrow: 1, flexBasis: "45%", minWidth: 0, gap: spacing.xs }}
                >
                  <FoodField
                    label={`${label} (${unit})`}
                    value={value}
                    error={errors?.[key]}
                    disabled={disabled}
                    numeric
                    onChange={(input) => onChange(key, input)}
                  />
                  {isMeal && (
                    <AppText variant="caption" muted>
                      {amount === null
                        ? "Calculated amount unknown"
                        : `Calculated: ${calculatedText} ${unit}`}
                    </AppText>
                  )}
                </View>
              );
            })}
          </View>
          {onReset && Object.values(values).some((value) => value?.trim()) && (
            <FoodButton
              label="Use calculated detailed nutrients"
              onPress={onReset}
              disabled={disabled}
            />
          )}
        </View>
      )}
    </View>
  );
}
