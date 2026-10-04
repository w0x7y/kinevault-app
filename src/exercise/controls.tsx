import { useState, type PropsWithChildren } from "react";
import { Pressable, TextInput, View } from "react-native";
import { AppText } from "../components/ui";
import { useTheme } from "../theme/provider";
import { fonts, radius, spacing } from "../theme/tokens";

export function ExerciseButton({ label, accessibilityLabel = label, onPress, disabled = false, selected, primary }: {
  label: string; accessibilityLabel?: string; onPress: () => void; disabled?: boolean; selected?: boolean; primary?: boolean;
}) {
  const { colors } = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel}
    accessibilityState={{ disabled, selected }} aria-pressed={selected} disabled={disabled} onPress={onPress}
    style={({ pressed }) => ({ minHeight: 44, padding: spacing.layout, borderWidth: 1, borderRadius: radius.control,
      borderColor: selected ? colors.ring : colors.border, backgroundColor: primary ? colors.primary : pressed || selected ? colors.accent : colors.secondary,
      justifyContent: "center", opacity: disabled ? 0.5 : 1 })}>
    <AppText variant="label" style={{ textAlign: "center", color: primary ? colors.primaryForeground : colors.secondaryForeground }}>{label}</AppText>
  </Pressable>;
}
export function ExerciseField({ label, value, onChange, numeric, disabled = false, multiline = false }: {
  label: string; value: string; onChange: (value: string) => void; numeric?: boolean; disabled?: boolean; multiline?: boolean;
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return <View style={{ gap: spacing.xs, minWidth: 0 }}>
    <AppText variant="label">{label}</AppText>
    <TextInput accessibilityLabel={label} value={value} onChangeText={onChange} editable={!disabled}
      inputMode={numeric ? "decimal" : "text"} keyboardType={numeric ? "decimal-pad" : "default"}
      multiline={multiline} maxLength={numeric ? 32 : multiline ? 4000 : 400} selectTextOnFocus={numeric}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} selectionColor={colors.ring}
      style={{ minHeight: multiline ? 96 : 48, minWidth: 0, padding: spacing.layout, borderWidth: 1, borderRadius: radius.control,
        borderColor: focused ? colors.ring : colors.border, backgroundColor: colors.background,
        color: colors.foreground, fontFamily: fonts.regular, fontSize: 16 }} />
  </View>;
}
export function ActionRow({ children }: PropsWithChildren) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.layout }}>{children}</View>;
}
export function ExerciseError({ message }: { message: string | null }) {
  const { colors } = useTheme();
  return message ? <AppText accessibilityRole="alert" style={{ color: colors.error }}>{message}</AppText> : null;
}
export function ConfirmAction({ question, label, onConfirm, onCancel, disabled }: {
  question: string; label: string; onConfirm: () => void; onCancel: () => void; disabled?: boolean;
}) {
  return <View style={{ gap: spacing.layout }}><AppText>{question}</AppText><ActionRow>
    <ExerciseButton label={label} onPress={onConfirm} disabled={disabled} />
    <ExerciseButton label="Cancel" onPress={onCancel} disabled={disabled} />
  </ActionRow></View>;
}
