import { StyleSheet, View } from "react-native";
import { Icon } from "../components/icon";
import { AppText, Overline } from "../components/ui";
import { useTheme } from "../theme/provider";
import { radius, spacing } from "../theme/tokens";

/** A section label inside a form; groups the fields below it. */
export function SectionLabel({ children }: { children: string }) {
  return <Overline style={{ marginTop: spacing.xs }}>{children}</Overline>;
}

/** A hairline between rows of a list inside a card. */
export function Hairline() {
  const { colors } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />;
}

/** An exercise's notes, revealed by its notes button. */
export function ExerciseNotes({ notes }: { notes: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: radius.tile + 2,
        backgroundColor: colors.muted,
      }}
    >
      <Icon name="note-sticky" size={16} color={colors.mutedForeground} style={{ marginTop: 1 }} />
      <AppText variant="caption" muted={!notes} style={{ flex: 1 }}>
        {notes || "No notes for this exercise."}
      </AppText>
    </View>
  );
}
