import { View } from "react-native";
import { Icon } from "../components/icon";
import { IconWell } from "../components/icon-well";
import { Tappable } from "../components/tappable";
import { AppText, Overline } from "../components/ui";
import { useTheme } from "../theme/provider";
import { cardShadow, fonts, radius, spacing } from "../theme/tokens";

/** A card row that reopens an unsaved food or meal draft where it was left. */
export function ResumeDraft({
  name,
  disabled,
  onPress,
}: {
  name: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Tappable
      label={`Resume draft: ${name}`}
      disabled={disabled}
      onPress={onPress}
      ring="outline"
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        minHeight: 64,
        paddingVertical: spacing.md,
        paddingLeft: spacing.md,
        paddingRight: spacing.card,
        borderRadius: radius.panel,
        borderWidth: 1,
        borderColor: colors.border,
        borderStyle: "dashed",
        backgroundColor: pressed ? colors.muted : colors.card,
        boxShadow: cardShadow(colors),
      })}
    >
      <IconWell icon="pen" color={colors.primary} size="large" />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Overline>Resume draft</Overline>
        <AppText variant="label" numberOfLines={1} style={{ fontFamily: fonts.bold, fontSize: 15 }}>
          {name}
        </AppText>
      </View>
      <Icon name="chevron-right" size={16} color={colors.mutedForeground} />
    </Tappable>
  );
}
