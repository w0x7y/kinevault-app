import { AppButton } from "../components/button";
import { View } from "react-native";
import { parseDay } from "../calendar/dates.ts";
import { AppText } from "../components/ui";
import { meals } from "../daily/model.ts";
import { useTheme } from "../theme/provider";
import { spacing } from "../theme/tokens";
import type { CatalogKind } from "./meal-model.ts";
import type { FoodLoggingAttemptView } from "./use-logging-attempt";

export function FoodLoggingControls({
  attempt: { attempt, preparation, failed, submittable, saving, busy },
  onSaved,
  itemKind = "food",
}: {
  attempt: FoodLoggingAttemptView;
  itemKind?: CatalogKind;
  onSaved: () => void;
}) {
  const { date, meal, operation } = preparation;
  const { colors } = useTheme();
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
                    onPress={() => attempt.chooseMeal(option.key)}
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
          saving
            ? `Saving ${itemKind}...`
            : operation === "edit"
              ? "Save changes"
              : preparation.measurement === "volume"
                ? "Log drink to Drinks"
                : `Log ${itemKind} to ${meals.find((option) => option.key === meal)?.label}`
        }
        disabled={!submittable}
        onPress={() => {
          void attempt.submit().then((saved) => {
            if (saved) onSaved();
          });
        }}
      />
    </View>
  );
}
