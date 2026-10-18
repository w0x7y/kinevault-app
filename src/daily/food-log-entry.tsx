import { useCallback, useRef } from "react";
import { useFocusEffect } from "expo-router";
import { BackHandler, Platform, View, type StyleProp, type ViewStyle } from "react-native";
import Animated from "react-native-reanimated";
import { AppButton, ButtonRow, IconButton } from "../components/button";
import { useLayoutMotion, useReducedMotion, useStateTransition } from "../components/motion";
import { AppText } from "../components/ui";
import { fonts, spacing } from "../theme/tokens";
import type { FoodEntry } from "./model";
import type { FoodEntryRemoval } from "../food/tab-view";
import { InlineMessage } from "../components/inline-message";

/** How long a removed entry takes to fade before its meal closes up. */
const leaveDuration = 160;

export function FoodLogEntry({
  food,
  mealLabel,
  fresh = false,
  saving,
  removal,
  onEdit,
  onArm,
  onCancel,
  onConfirm,
  style,
}: {
  food: FoodEntry;
  mealLabel: string;
  /** Just logged while the log was on screen: the entry rises into its meal. */
  fresh?: boolean;
  saving: boolean;
  /** This entry's removal, from the Food tab view. */
  removal: FoodEntryRemoval["state"] | null;
  onEdit: (entry: FoodEntry) => void;
  onArm: () => void;
  onCancel: () => void;
  /** Removes the entry once `leave` (its fade) has played. */
  onConfirm: (leave: () => Promise<void>) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const motion = useLayoutMotion();
  const fadeOut = useStateTransition(["opacity"], leaveDuration);
  const armed = removal !== null;
  const busy = removal === "removing";
  const failed = removal === "failed";
  // A confirmed entry fades where it is, then leaves; the meal closes up once it has gone.
  const leaving = busy && !reduced;
  const confirm = () =>
    onConfirm(() =>
      reduced ? Promise.resolve() : new Promise((resolve) => setTimeout(resolve, leaveDuration)),
    );
  const disabled = saving || busy;
  const trashButton = useRef<View>(null);
  const cancelButton = useRef<View>(null);
  useFocusEffect(
    useCallback(() => {
      if (!armed) return;
      if (Platform.OS === "web" && !disabled) cancelButton.current?.focus();
      const close = () => {
        if (disabled) return;
        onCancel();
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
    }, [armed, disabled, onCancel, food.id]),
  );
  return (
    <Animated.View
      entering={fresh ? motion.enter() : undefined}
      style={[style, { opacity: leaving ? 0 : 1, ...fadeOut }]}
    >
      <View
        testID={`food-log-entry-${food.id}`}
        nativeID={`food-log-entry-${food.id}`}
        style={{ gap: spacing.sm, paddingTop: 2 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <AppText
              variant="label"
              style={{ fontSize: 15, lineHeight: 21, fontFamily: fonts.semibold }}
              selectable
            >
              {food.name}
            </AppText>
            <AppText variant="caption" muted selectable style={{ fontVariant: ["tabular-nums"] }}>
              {food.measurement === "volume"
                ? `${food.drinkMl.toLocaleString()} ml`
                : food.meal === "drinks" && food.drinkMl !== undefined
                  ? `${food.drinkMl.toLocaleString()} ml`
                  : `${food.grams.toLocaleString(undefined, { maximumFractionDigits: 1 })} g`}{" "}
              · {Math.round(food.calories).toLocaleString()} kcal
            </AppText>
          </View>
          {/* The round targets overhang the card padding so the icons sit near its edge. */}
          <View style={{ flexDirection: "row", flexShrink: 0, gap: 0, marginRight: -spacing.sm }}>
            <IconButton
              label={`Edit ${food.name} in ${mealLabel}`}
              icon="pen"
              disabled={disabled}
              onPress={() => onEdit(food)}
            />
            <IconButton
              ref={trashButton}
              label={`Remove ${food.name} from ${mealLabel}`}
              icon="trash-can"
              disabled={disabled}
              expanded={armed}
              destructive
              onPress={onArm}
            />
          </View>
        </View>
        {armed && (
          <Animated.View
            entering={motion.fade}
            style={{ gap: spacing.sm, paddingBottom: spacing.xs }}
          >
            <AppText
              variant="caption"
              accessibilityRole="alert"
              style={{ fontFamily: fonts.semibold }}
            >
              Remove {food.name} from {mealLabel}?
            </AppText>
            <ButtonRow>
              <AppButton
                ref={cancelButton}
                label="Cancel"
                accessibilityLabel={`Cancel removing ${food.name} from ${mealLabel}`}
                disabled={disabled}
                onPress={() => {
                  onCancel();
                  if (Platform.OS === "web") trashButton.current?.focus();
                }}
                fill
              />
              <AppButton
                label="Remove"
                accessibilityLabel={`Confirm remove ${food.name} from ${mealLabel}`}
                disabled={disabled}
                busy={busy}
                onPress={confirm}
                tone="destructive"
                fill
              />
            </ButtonRow>
          </Animated.View>
        )}
        {failed && <InlineMessage>Couldn't remove this entry. Try again.</InlineMessage>}
      </View>
    </Animated.View>
  );
}
