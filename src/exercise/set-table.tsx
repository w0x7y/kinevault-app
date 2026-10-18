import { useState } from "react";
import { TextInput, View } from "react-native";
import Animated, { LayoutAnimationConfig } from "react-native-reanimated";
import { useLayoutMotion, useStateTransition } from "../components/motion";
import { inputSurface } from "../components/text-field";
import { AppText, Overline } from "../components/ui";
import { useTheme } from "../theme/provider";
import { fonts, radius, spacing } from "../theme/tokens";
import type { ExerciseSet, SetHint } from "./model";

const badgeColumn = 36;
const sideColumn = 44;

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
  const empty = value === "";
  return (
    <TextInput
      accessibilityLabel={label}
      value={value}
      placeholder={placeholder}
      // Hints are last session's values: lighter, regular weight and slanted, so they never
      // read as something already logged.
      placeholderTextColor={`${colors.mutedForeground}99`}
      onChangeText={onChange}
      editable={!disabled}
      inputMode="decimal"
      keyboardType="decimal-pad"
      selectTextOnFocus
      maxLength={32}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      selectionColor={colors.ring}
      style={[
        inputSurface(colors, { focused }),
        {
          flex: 1,
          minWidth: 0,
          minHeight: 48,
          paddingHorizontal: spacing.xs,
          paddingVertical: spacing.sm,
          borderRadius: radius.tile + 2,
          backgroundColor: focused ? colors.card : empty ? colors.background : colors.card,
          fontFamily: empty ? fonts.regular : fonts.bold,
          fontStyle: empty ? "italic" : "normal",
          fontSize: 17,
          fontVariant: ["tabular-nums"],
          textAlign: "center",
        },
      ]}
    />
  );
}

function logged(set: ExerciseSet) {
  return set.kind === "single"
    ? set.reps !== "" || set.weightKg !== ""
    : [set.left, set.right].some((side) => side.reps !== "" || side.weightKg !== "");
}

/** The set number; it fills in ink once the set has values. */
function SetBadge({ number, done }: { number: number; done: boolean }) {
  const { colors } = useTheme();
  const transition = useStateTransition(["backgroundColor"]);
  return (
    <View style={{ width: badgeColumn, justifyContent: "center" }}>
      <Animated.View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: done ? colors.primary : colors.muted,
          ...transition,
        }}
      >
        <AppText
          variant="caption"
          style={{
            fontFamily: fonts.bold,
            fontVariant: ["tabular-nums"],
            color: done ? colors.primaryForeground : colors.mutedForeground,
          }}
        >
          {number}
        </AppText>
      </Animated.View>
    </View>
  );
}

export function ExerciseSetTable({
  sets,
  hints,
  rowLabel,
  busy,
  onChange,
}: {
  sets: ExerciseSet[];
  /** A blank field's hint for each set (see `setHints`). */
  hints: SetHint[];
  rowLabel: string;
  busy: boolean;
  onChange: (setId: string, build: (set: ExerciseSet) => ExerciseSet) => void;
}) {
  const sided = sets.some((set) => set.kind === "sides");
  const rise = useLayoutMotion().enter();
  const columns = { flexDirection: "row", gap: spacing.sm, alignItems: "center" } as const;
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={columns}>
        <Overline style={{ width: badgeColumn }}>Set</Overline>
        {sided && <View style={{ width: sideColumn }} />}
        <Overline style={{ flex: 1, minWidth: 0, textAlign: "center" }}>Reps</Overline>
        <Overline style={{ flex: 1, minWidth: 0, textAlign: "center" }}>Weight (kg)</Overline>
      </View>
      {sets.length === 0 && (
        <AppText variant="caption" muted>
          Add a set to enter repetitions and weight.
        </AppText>
      )}
      {/* Sets already there when the table opens are simply there; an added set rises in. */}
      <LayoutAnimationConfig skipEntering>
        {sets.map((set, index) => {
          const prefix = `${rowLabel} set ${index + 1}`;
          const hint = hints[index];
          return set.kind === "single" ? (
            <Animated.View key={set.id} entering={rise} style={columns}>
              <SetBadge number={index + 1} done={logged(set)} />
              {sided && <View style={{ width: sideColumn }} />}
              <NumberInput
                label={`${prefix} reps`}
                value={set.reps}
                placeholder={hint.kind === "single" ? hint.reps : undefined}
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
                placeholder={hint.kind === "single" ? hint.weightKg : undefined}
                disabled={busy}
                onChange={(weightKg) =>
                  onChange(set.id, (previous) =>
                    previous.kind === "single" ? { ...previous, weightKg } : previous,
                  )
                }
              />
            </Animated.View>
          ) : (
            <Animated.View
              key={set.id}
              entering={rise}
              style={[columns, { alignItems: "stretch" }]}
            >
              <SetBadge number={index + 1} done={logged(set)} />
              <View style={{ flex: 1, minWidth: 0, gap: spacing.xs + 2 }}>
                {(["left", "right"] as const).map((side) => (
                  <View key={side} style={columns}>
                    <AppText variant="caption" muted style={{ width: sideColumn }}>
                      {side === "left" ? "Left" : "Right"}
                    </AppText>
                    <NumberInput
                      label={`${prefix} ${side} reps`}
                      value={set[side].reps}
                      placeholder={hint.kind === "sides" ? hint[side].reps : undefined}
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
                      placeholder={hint.kind === "sides" ? hint[side].weightKg : undefined}
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
              </View>
            </Animated.View>
          );
        })}
      </LayoutAnimationConfig>
    </View>
  );
}
