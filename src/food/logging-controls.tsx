import { AppButton } from "../components/button";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { parseDay } from "../calendar/dates.ts";
import { AppText } from "../components/ui";
import { meals, type Meal } from "../daily/model.ts";
import { useTheme } from "../theme/provider";
import { spacing } from "../theme/tokens";
import type { FoodLoggingPreparation } from "./logging-preparation.ts";
import { useFoodLog } from "./log-provider";
import { useCustomFoods } from "./custom-provider";
import type { CatalogKind } from "./meal-model.ts";

export function FoodLoggingControls({
  preparation,
  onSaved,
  itemKind = "food",
  onMealChange,
}: {
  preparation: FoodLoggingPreparation;
  itemKind?: CatalogKind;
  onMealChange: (meal: Meal) => void;
  onSaved: () => void;
}) {
  const { date, meal, operation } = preparation;
  const log = useFoodLog();
  const custom = useCustomFoods();
  const busy = log.saving || custom.saving;
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function save() {
    if (pending.current || preparation.status !== "ready" || busy || log.state.kind !== "ready")
      return;
    pending.current = true;
    setFailed(false);
    try {
      const { write } = preparation;
      const saved = await (write.kind === "edit" ? log.edit(write.input) : log.add(write.input));
      if (!mounted.current) return;
      if (saved) onSaved();
      else setFailed(true);
    } catch {
      if (mounted.current) setFailed(true);
    } finally {
      pending.current = false;
    }
  }
  return (
    <View style={{ gap: spacing.layout }}>
      {preparation.measurement === "grams" && (
        <>
          <AppText variant="label" accessibilityRole="header">
            Meal for{" "}
            {parseDay(date).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </AppText>
          <View
            accessibilityLabel="Meal"
            style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}
          >
            {meals
              .filter((option) => option.key !== "drinks")
              .map((option) => (
                <View key={option.key} style={{ flexGrow: 1, flexBasis: "45%" }}>
                  <AppButton
                    fill
                    label={option.label}
                    accessibilityLabel={option.label}
                    selected={meal === option.key}
                    disabled={busy}
                    onPress={() => onMealChange(option.key)}
                  />
                </View>
              ))}
          </View>
        </>
      )}
      {preparation.measurement === "volume" && (
        <AppText variant="caption" muted>
          Logs to Drinks for{" "}
          {parseDay(date).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}{" "}
          and adds this amount to your water total.
        </AppText>
      )}
      {failed && (
        <AppText variant="caption" accessibilityRole="alert" style={{ color: colors.error }}>
          {operation === "edit" ? "Couldn't save your changes." : `Couldn't log this ${itemKind}.`}{" "}
          Your amounts and meal are kept. Try again.
        </AppText>
      )}
      <AppButton
        primary
        label={
          log.saving
            ? `Saving ${itemKind}...`
            : operation === "edit"
              ? "Save changes"
              : preparation.measurement === "volume"
                ? "Log drink to Drinks"
                : `Log ${itemKind} to ${meals.find((option) => option.key === meal)?.label}`
        }
        disabled={preparation.status !== "ready" || busy || log.state.kind !== "ready"}
        onPress={() => {
          void save();
        }}
      />
    </View>
  );
}
