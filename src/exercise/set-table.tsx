import { useState } from "react";
import { TextInput, View } from "react-native";
import { AppText } from "../components/ui";
import { useTheme } from "../theme/provider";
import { fonts, radius, spacing } from "../theme/tokens";
import type { ExerciseSet } from "./model";

function NumberInput({ label, value, onChange, disabled }: {
  label: string; value: string; onChange: (value: string) => void; disabled: boolean;
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return <TextInput accessibilityLabel={label} value={value} onChangeText={onChange} editable={!disabled}
    inputMode="decimal" keyboardType="decimal-pad" selectTextOnFocus maxLength={32}
    onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} selectionColor={colors.ring}
    style={{ flex: 1, minWidth: 0, minHeight: 44, padding: spacing.xs, borderWidth: 1, borderRadius: radius.control,
      borderColor: focused ? colors.ring : colors.border, backgroundColor: colors.background,
      color: colors.foreground, fontFamily: fonts.regular, fontSize: 16, textAlign: "center" }} />;
}

export function ExerciseSetTable({ sets, rowLabel, busy, onChange }: {
  sets: ExerciseSet[]; rowLabel: string; busy: boolean;
  onChange: (setId: string, build: (set: ExerciseSet) => ExerciseSet) => void;
}) {
  return <View style={{ gap: spacing.sm }}>
    <View style={{ flexDirection: "row", gap: spacing.xs, alignItems: "center" }}>
      <AppText variant="caption" style={{ width: 32 }}>Set</AppText>
      <AppText variant="label" style={{ flex: 1, minWidth: 0, textAlign: "center" }}>Reps</AppText>
      <AppText variant="label" style={{ flex: 1, minWidth: 0, textAlign: "center" }}>Weight (kg)</AppText>
    </View>
    {sets.length === 0 && <AppText variant="caption" muted>Add a set to enter repetitions and weight.</AppText>}
    {sets.map((set, index) => {
      const prefix = `${rowLabel} set ${index + 1}`;
      return <View key={set.id} style={{ gap: spacing.xs }}>
        {set.kind === "single" ? <View style={{ flexDirection: "row", gap: spacing.xs, alignItems: "center" }}>
          <AppText variant="caption" style={{ width: 32 }}>{index + 1}</AppText>
          <NumberInput label={`${prefix} reps`} value={set.reps} disabled={busy}
            onChange={reps => onChange(set.id, previous => previous.kind === "single" ? { ...previous, reps } : previous)} />
          <NumberInput label={`${prefix} weight (kg)`} value={set.weightKg} disabled={busy}
            onChange={weightKg => onChange(set.id, previous => previous.kind === "single" ? { ...previous, weightKg } : previous)} />
        </View> : <>
          <AppText variant="caption">Set {index + 1}</AppText>
          {(["left", "right"] as const).map(side => <View key={side} style={{ flexDirection: "row", gap: spacing.xs, alignItems: "center" }}>
            <AppText variant="caption" style={{ width: 32 }}>{side === "left" ? "Left" : "Right"}</AppText>
            <NumberInput label={`${prefix} ${side} reps`} value={set[side].reps} disabled={busy}
              onChange={reps => onChange(set.id, previous => previous.kind === "sides" ? { ...previous, [side]: { ...previous[side], reps } } : previous)} />
            <NumberInput label={`${prefix} ${side} weight (kg)`} value={set[side].weightKg} disabled={busy}
              onChange={weightKg => onChange(set.id, previous => previous.kind === "sides" ? { ...previous, [side]: { ...previous[side], weightKg } } : previous)} />
          </View>)}
        </>}
      </View>;
    })}
  </View>;
}
