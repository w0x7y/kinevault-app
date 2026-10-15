import { useState } from "react";
import { TextInput, View } from "react-native";
import { AppText } from "../components/ui";
import { useTheme } from "../theme/provider";
import { fonts, radius, spacing } from "../theme/tokens";
import type { ExerciseSet } from "./model";

function NumberInput({
  label,
  value,
  placeholder,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      accessibilityLabel={label}
      value={value}
      placeholder={placeholder}
      placeholderTextColor={colors.mutedForeground}
      onChangeText={onChange}
      editable={!disabled}
      inputMode="decimal"
      keyboardType="decimal-pad"
      selectTextOnFocus
      maxLength={32}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      selectionColor={colors.ring}
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 44,
        padding: spacing.xs,
        borderRadius: radius.control,
        borderWidth: focused ? 2 : 1,
        borderColor: focused ? colors.ring : colors.input,
        backgroundColor: colors.background,
        color: colors.foreground,
        fontFamily: fonts.regular,
        fontSize: 18,
        textAlign: "center",
      }}
    />
  );
}

/** A blank set shows what was lifted last time, or failing that the set above, as a hint. */
function hint(
  sets: ExerciseSet[],
  previous: ExerciseSet[],
  index: number,
  side: "single" | "left" | "right",
) {
  const source = previous[index] ?? sets[index - 1];
  if (!source) return { reps: undefined, weightKg: undefined };
  const values = source.kind === "single" ? source : source[side === "single" ? "left" : side];
  return { reps: values.reps || undefined, weightKg: values.weightKg || undefined };
}

export function ExerciseSetTable({
  sets,
  previous = [],
  rowLabel,
  busy,
  onChange,
}: {
  sets: ExerciseSet[];
  previous?: ExerciseSet[];
  rowLabel: string;
  busy: boolean;
  onChange: (setId: string, build: (set: ExerciseSet) => ExerciseSet) => void;
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: "row", gap: spacing.xs, alignItems: "center" }}>
        <AppText variant="label" muted style={{ width: 40 }}>
          Set
        </AppText>
        <AppText variant="label" muted style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
          Reps
        </AppText>
        <AppText variant="label" muted style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
          Weight (kg)
        </AppText>
      </View>
      {sets.length === 0 && (
        <AppText variant="caption" muted>
          Add a set to enter repetitions and weight.
        </AppText>
      )}
      {sets.map((set, index) => {
        const prefix = `${rowLabel} set ${index + 1}`;
        return (
          <View key={set.id} style={{ gap: spacing.xs }}>
            {set.kind === "single" ? (
              <View style={{ flexDirection: "row", gap: spacing.xs, alignItems: "center" }}>
                <AppText variant="label" style={{ width: 40, fontSize: 16 }}>
                  {index + 1}
                </AppText>
                <NumberInput
                  label={`${prefix} reps`}
                  value={set.reps}
                  placeholder={hint(sets, previous, index, "single").reps}
                  disabled={busy}
                  onChange={(reps) =>
                    onChange(set.id, (previous) =>
                      previous.kind === "single" ? { ...previous, reps } : previous,
                    )
                  }
                />
                <NumberInput
                  label={`${prefix} weight (kg)`}
                  value={set.weightKg}
                  placeholder={hint(sets, previous, index, "single").weightKg}
                  disabled={busy}
                  onChange={(weightKg) =>
                    onChange(set.id, (previous) =>
                      previous.kind === "single" ? { ...previous, weightKg } : previous,
                    )
                  }
                />
              </View>
            ) : (
              <>
                <AppText variant="label">Set {index + 1}</AppText>
                {(["left", "right"] as const).map((side) => (
                  <View
                    key={side}
                    style={{ flexDirection: "row", gap: spacing.xs, alignItems: "center" }}
                  >
                    <AppText variant="caption" muted style={{ width: 40 }}>
                      {side === "left" ? "Left" : "Right"}
                    </AppText>
                    <NumberInput
                      label={`${prefix} ${side} reps`}
                      value={set[side].reps}
                      placeholder={hint(sets, previous, index, side).reps}
                      disabled={busy}
                      onChange={(reps) =>
                        onChange(set.id, (previous) =>
                          previous.kind === "sides"
                            ? { ...previous, [side]: { ...previous[side], reps } }
                            : previous,
                        )
                      }
                    />
                    <NumberInput
                      label={`${prefix} ${side} weight (kg)`}
                      value={set[side].weightKg}
                      placeholder={hint(sets, previous, index, side).weightKg}
                      disabled={busy}
                      onChange={(weightKg) =>
                        onChange(set.id, (previous) =>
                          previous.kind === "sides"
                            ? { ...previous, [side]: { ...previous[side], weightKg } }
                            : previous,
                        )
                      }
                    />
                  </View>
                ))}
              </>
            )}
          </View>
        );
      })}
    </View>
  );
}
