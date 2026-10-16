import { Icon } from "../components/icon";
import { Tappable } from "../components/tappable";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import { useAppear, useStateTransition } from "../components/motion";
import { AppText } from "../components/ui";
import { useTheme } from "../theme/provider";
import { fonts, radius, spacing } from "../theme/tokens";

export function Choice({
  label,
  description,
  selected,
  onPress,
  disabled = false,
  invalid = false,
}: {
  label: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  /** Outlines the card in red while its group has an unanswered error. */
  invalid?: boolean;
}) {
  const { colors } = useTheme();
  // The card's outline and fill ease to their new state; the check pops in.
  const transition = useStateTransition(["borderColor", "backgroundColor"], 150);
  const checkIn = useAppear("pop", { duration: 150 });
  return (
    <Tappable
      role="radio"
      label={label}
      checked={selected}
      disabled={disabled}
      onPress={onPress}
      eases={["borderColor", "backgroundColor"]}
      style={({ pressed, focused }) => ({
        minHeight: 62,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.card,
        borderRadius: radius.control + 2,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.layout,
        borderWidth: focused || selected ? 2 : invalid ? 1.5 : 1,
        borderColor: selected ? colors.primary : invalid ? colors.error : colors.border,
        backgroundColor: pressed && !selected ? colors.muted : colors.card,
      })}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <AppText variant="label" style={{ fontFamily: fonts.bold, fontSize: 16, lineHeight: 22 }}>
          {label}
        </AppText>
        {description && (
          <AppText muted style={{ fontSize: 14, lineHeight: 20 }}>
            {description}
          </AppText>
        )}
      </View>
      <Animated.View
        style={[
          {
            width: 24,
            height: 24,
            borderRadius: 12,
            borderWidth: 1.5,
            borderColor: selected ? colors.primary : invalid ? colors.error : colors.input,
            backgroundColor: selected ? colors.primary : colors.card,
            alignItems: "center",
            justifyContent: "center",
          },
          transition,
        ]}
      >
        {selected && (
          <Animated.View style={checkIn}>
            <Icon name="check" size={14} color={colors.primaryForeground} />
          </Animated.View>
        )}
      </Animated.View>
    </Tappable>
  );
}
