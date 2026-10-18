import { AppButton } from "../components/button";
import { useSyncExternalStore } from "react";
import { View } from "react-native";
import { parseDay } from "../calendar/dates.ts";
import { AppText, Overline } from "../components/ui";
import { Icon } from "../components/icon";
import { InlineMessage } from "../components/inline-message";
import { Chip } from "../components/chip";
import { meals } from "../daily/model.ts";
import { useTheme } from "../theme/provider";
import { spacing } from "../theme/tokens";
import type { FoodLoggingAttempt } from "./logging-attempt.ts";

export function FoodLoggingControls({
  attempt,
  onLog,
}: {
  attempt: FoodLoggingAttempt;
  onLog: () => void;
}) {
  const { preparation, noun, failed, submittable, saving, busy } = useSyncExternalStore(
    attempt.subscribe,
    attempt.getSnapshot,
    attempt.getSnapshot,
  );
  const { date, meal, operation } = preparation;
  const { colors } = useTheme();
  const day = parseDay(date).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return (
    <View style={{ gap: spacing.layout }}>
      {preparation.measurement === "grams" && (
        <View style={{ gap: spacing.sm }}>
          <Overline accessibilityRole="header">Meal · {day}</Overline>
          <View
            accessibilityLabel="Meal"
            style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}
          >
            {meals
              .filter((option) => option.key !== "drinks")
              .map((option) => (
                <View key={option.key} style={{ flexGrow: 1, flexBasis: "40%", minWidth: 0 }}>
                  <Chip
                    fill
                    icon={option.icon}
                    label={option.label}
                    selected={meal === option.key}
                    disabled={busy}
                    onPress={() => attempt.chooseMeal(option.key)}
                  />
                </View>
              ))}
          </View>
        </View>
      )}
      {preparation.measurement === "volume" && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <Icon name="droplet" size={16} color={colors.water} />
          <AppText variant="caption" muted style={{ flex: 1 }}>
            Logs to Drinks for {day} and adds this amount to your water total.
          </AppText>
        </View>
      )}
      {failed && (
        <InlineMessage>
          {`${operation === "edit" ? "Couldn't save your changes." : `Couldn't log this ${noun}.`} Your amounts and meal are kept. Try again.`}
        </InlineMessage>
      )}
      <AppButton
        tone="primary"
        label={
          // Only this attempt's own write reads as saving; a food-log refresh doesn't.
          saving
            ? `Saving ${noun}...`
            : operation === "edit"
              ? "Save changes"
              : preparation.measurement === "volume"
                ? "Log drink to Drinks"
                : `Log ${noun} to ${meals.find((option) => option.key === meal)?.label}`
        }
        disabled={!submittable}
        onPress={onLog}
      />
    </View>
  );
}
