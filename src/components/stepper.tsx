import { Icon } from "./icon";
import { Tappable } from "./tappable";
import { AppText } from "./ui";
import { useTheme } from "../theme/provider";
import { fonts, radius } from "../theme/tokens";

/** A round ± step beside a hero number field. The visible amount sits inside the accessible name. */
export function Stepper({
  delta,
  unit,
  disabled,
  onPress,
}: {
  delta: number;
  /** Ends the accessible name, e.g. "+250 ml". */
  unit: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Tappable
      label={`${delta > 0 ? "+" : ""}${delta} ${unit}`}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 64,
        height: 64,
        flexShrink: 0,
        borderRadius: radius.pill,
        backgroundColor: pressed ? colors.accent : colors.muted,
        alignItems: "center",
        justifyContent: "center",
      })}
    >
      <Icon name={delta > 0 ? "plus" : "minus"} size={20} color={colors.primary} />
      <AppText
        variant="caption"
        style={{ fontFamily: fonts.bold, fontSize: 11, lineHeight: 13, marginTop: -2 }}
      >
        {Math.abs(delta).toLocaleString()}
      </AppText>
    </Tappable>
  );
}
