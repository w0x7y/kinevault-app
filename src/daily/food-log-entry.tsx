import { useCallback, useRef } from "react";
import { useFocusEffect } from "expo-router";
import { BackHandler, Platform, View } from "react-native";
import { AppButton, ButtonRow, IconButton } from "../components/button";
import { useDeleteConfirmation } from "../components/delete-button";
import { AppText } from "../components/ui";
import { useTheme } from "../theme/provider";
import { spacing } from "../theme/tokens";
import type { FoodEntry } from "./model";

export function FoodLogEntry({
  food,
  mealLabel,
  saving,
  onEdit,
  onRemove,
}: {
  food: FoodEntry;
  mealLabel: string;
  saving: boolean;
  onEdit: (entry: FoodEntry) => void;
  onRemove: (id: string) => Promise<boolean>;
}) {
  const { colors } = useTheme();
  const { armed, busy, failed, arm, cancel, confirm } = useDeleteConfirmation({
    onDelete: () => onRemove(food.id),
    disabled: saving,
  });
  const disabled = saving || busy;
  const trashButton = useRef<View>(null);
  const cancelButton = useRef<View>(null);
  useFocusEffect(
    useCallback(() => {
      if (!armed) return;
      if (Platform.OS === "web" && !disabled) cancelButton.current?.focus();
      const close = () => {
        if (disabled) return;
        cancel();
        if (Platform.OS === "web") trashButton.current?.focus();
      };
      const back = BackHandler.addEventListener("hardwareBackPress", () => {
        close();
        return true;
      });
      const escape = (event: KeyboardEvent) => {
        if (
          event.key === "Escape" &&
          document.getElementById(`food-log-entry-${food.id}`)?.contains(document.activeElement)
        ) {
          event.preventDefault();
          close();
        }
      };
      if (Platform.OS === "web") document.addEventListener("keydown", escape);
      return () => {
        back.remove();
        if (Platform.OS === "web") document.removeEventListener("keydown", escape);
      };
    }, [armed, disabled, cancel, food.id]),
  );
  return (
    <View
      testID={`food-log-entry-${food.id}`}
      nativeID={`food-log-entry-${food.id}`}
      style={{ gap: spacing.sm, paddingVertical: spacing.xs }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
        <View style={{ flex: 1, minWidth: 0, gap: spacing.xs }}>
          <AppText style={{ fontSize: 14 }} selectable>
            {food.name}
          </AppText>
          <AppText variant="caption" muted selectable>
            {food.measurement === "volume"
              ? `${food.drinkMl.toLocaleString()} ml`
              : food.meal === "drinks" && food.drinkMl !== undefined
                ? `${food.drinkMl.toLocaleString()} ml`
                : `${food.grams.toLocaleString(undefined, { maximumFractionDigits: 1 })} g`}{" "}
            · {Math.round(food.calories).toLocaleString()} kcal
          </AppText>
        </View>
        <View style={{ flexDirection: "row", flexShrink: 0, gap: spacing.sm }}>
          <IconButton
            label={`Edit ${food.name} in ${mealLabel}`}
            icon="pen"
            disabled={disabled}
            onPress={() => {
              cancel();
              onEdit(food);
            }}
          />
          <IconButton
            ref={trashButton}
            label={`Remove ${food.name} from ${mealLabel}`}
            icon="trash-can"
            disabled={disabled}
            expanded={armed}
            destructive
            onPress={arm}
          />
        </View>
      </View>
      {armed && (
        <View style={{ gap: spacing.sm }}>
          <AppText variant="caption" accessibilityRole="alert">
            Remove {food.name} from {mealLabel}?
          </AppText>
          <ButtonRow>
            <AppButton
              ref={cancelButton}
              label="Cancel"
              accessibilityLabel={`Cancel removing ${food.name} from ${mealLabel}`}
              disabled={disabled}
              onPress={() => {
                cancel();
                if (Platform.OS === "web") trashButton.current?.focus();
              }}
              fill
            />
            <AppButton
              label="Remove"
              accessibilityLabel={`Confirm remove ${food.name} from ${mealLabel}`}
              disabled={disabled}
              busy={busy}
              onPress={() => void confirm()}
              destructive
              fill
            />
          </ButtonRow>
        </View>
      )}
      {failed && (
        <AppText variant="caption" accessibilityRole="alert" style={{ color: colors.error }}>
          Couldn't remove this entry. Try again.
        </AppText>
      )}
    </View>
  );
}
