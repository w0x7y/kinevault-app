import { useState } from "react";
import { TextInput, View } from "react-native";
import Animated, { LayoutAnimationConfig } from "react-native-reanimated";
import { IconButton } from "../components/button";
import { Tappable } from "../components/tappable";
import { useLayoutMotion, useStateTransition } from "../components/motion";
import { inputSurface } from "../components/text-field";
import { AppText, Overline } from "../components/ui";
import { useTheme } from "../theme/provider";
import { fonts, radius, spacing } from "../theme/tokens";
import { formatElapsed, type ExerciseSet, type SetHint } from "./model";
import type { ShownClock } from "./workout-editing";
import {
  isBlankSet,
  setLines,
  timedSeconds,
  trackingMode,
  withHintValues,
  type SetField,
  type SetLine,
  type TrackingMode,
} from "./tracking";

const badgeColumn = 32;
/** A left/right set's lines are badged L1 and R1. */
const sideLetter = { left: "L", right: "R" } as const;

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

/**
 * The set number (L1 and R1 on a left/right set); it fills in ink once the set has values. With
 * `fill`, pressing it copies last workout's values into the line's blank fields.
 */
function SetBadge({
  label,
  done,
  fill,
}: {
  label: string;
  done: boolean;
  fill?: { label: string; onPress: () => void };
}) {
  const { colors } = useTheme();
  const transition = useStateTransition(["backgroundColor"]);
  const badge = (
    <Animated.View
      style={{
        minWidth: 28,
        height: 28,
        paddingHorizontal: 3,
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
        {label}
      </AppText>
    </Animated.View>
  );
  const column = { width: badgeColumn, minHeight: 48, justifyContent: "center" } as const;
  if (!fill) return <View style={column}>{badge}</View>;
  // The 44 pt target overhangs the narrower column so the fields keep their width.
  const overhang = (44 - badgeColumn) / 2;
  return (
    <Tappable
      label={fill.label}
      hint="Fills this set with your last workout's values"
      ring="outline"
      onPress={fill.onPress}
      style={{
        ...column,
        width: 44,
        marginHorizontal: -overhang,
        paddingHorizontal: overhang,
      }}
    >
      {badge}
    </Tappable>
  );
}

/** The running clock in place of a timed set's seconds field. */
function ClockFace({ clock, label }: { clock: ShownClock; label: string }) {
  const { colors } = useTheme();
  const time = formatElapsed(clock.seconds);
  return (
    <View
      accessible
      accessibilityLabel={`${label} ${clock.countdown ? "time left" : "stopwatch"} ${time}`}
      style={{
        flex: 1,
        minHeight: 48,
        borderRadius: radius.tile + 2,
        borderWidth: 2,
        borderColor: colors.ring,
        backgroundColor: colors.card,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <AppText style={{ fontFamily: fonts.extrabold, fontSize: 20, fontVariant: ["tabular-nums"] }}>
        {time}
      </AppText>
    </View>
  );
}

/**
 * The sets of one exercise in its Tracking mode's columns. A timed set's button starts its clock:
 * a countdown from the entered seconds, or a stopwatch on a blank set.
 */
export function ExerciseSetTable({
  tracking,
  sets,
  hints,
  rowLabel,
  busy,
  clock,
  onChange,
  onFill,
  onClock,
}: {
  tracking: TrackingMode;
  sets: ExerciseSet[];
  /** A blank field's hint for each set (see `setHints`). */
  hints: SetHint[];
  rowLabel: string;
  busy: boolean;
  clock: ShownClock | null;
  onChange: (setId: string, side: SetLine["side"], field: SetField, value: string) => void;
  /** Copies a line's hint into its blank fields. */
  onFill: (setId: string, side: SetLine["side"]) => void;
  onClock: (setId: string) => void;
}) {
  const mode = trackingMode(tracking);
  const rise = useLayoutMotion().enter();
  const columns = { flexDirection: "row", gap: spacing.sm, alignItems: "center" } as const;
  const cell = { flex: 1, minWidth: 0, textAlign: "center" } as const;
  // A set's lines: a badge, then the fields.
  const setRow = [columns, { gap: spacing.xs }];
  const fields = [columns, { flex: 1, minWidth: 0 }];
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={setRow}>
        <Overline style={{ width: badgeColumn }}>Set</Overline>
        <View style={fields}>
          {mode.columns.map((column) => (
            <Overline key={column.field} style={cell}>
              {column.label}
            </Overline>
          ))}
          {mode.clock && <View style={{ width: 44 }} />}
        </View>
      </View>
      {sets.length === 0 && (
        <AppText variant="caption" muted>
          {mode.clock ? "Add a set to time it." : "Add a set to enter repetitions and weight."}
        </AppText>
      )}
      {/* Sets already there when the table opens are simply there; an added set rises in. */}
      <LayoutAnimationConfig skipEntering>
        {sets.map((set, index) => {
          const prefix = `${rowLabel} set ${index + 1}`;
          const running = clock?.setId === set.id ? clock : null;
          const countdown = timedSeconds(set);
          return (
            <Animated.View key={set.id} entering={rise} style={{ gap: spacing.xs + 2 }}>
              {setLines(set).map((line, lineIndex) => {
                const label = line.side ? `${prefix} ${line.side}` : prefix;
                const hint = hints[index]?.[lineIndex];
                // Last workout's values would fill a field still blank.
                const fillable = hint !== undefined && withHintValues(set, hint) !== set;
                return (
                  <View key={line.side ?? "set"} style={setRow}>
                    <SetBadge
                      label={`${line.side ? sideLetter[line.side] : ""}${index + 1}`}
                      done={!isBlankSet(set)}
                      fill={
                        fillable && !busy
                          ? {
                              label: `Fill ${label} from last workout`,
                              onPress: () => onFill(set.id, line.side),
                            }
                          : undefined
                      }
                    />
                    <View style={fields}>
                      {mode.columns.map((column) =>
                        running && column.field === "seconds" ? (
                          <ClockFace key={column.field} clock={running} label={prefix} />
                        ) : (
                          <NumberInput
                            key={column.field}
                            label={`${label} ${column.name}`}
                            value={line.values[column.field] ?? ""}
                            placeholder={hint?.values[column.field]}
                            disabled={busy}
                            onChange={(value) => onChange(set.id, line.side, column.field, value)}
                          />
                        ),
                      )}
                      {mode.clock && (
                        <IconButton
                          appearance="secondary"
                          icon={running ? "stop" : countdown !== null ? "play" : "stopwatch"}
                          label={
                            running
                              ? `Stop ${prefix} clock`
                              : countdown !== null
                                ? `Start ${formatElapsed(countdown)} timer for ${prefix}`
                                : `Start stopwatch for ${prefix}`
                          }
                          disabled={busy}
                          onPress={() => onClock(set.id)}
                        />
                      )}
                    </View>
                  </View>
                );
              })}
            </Animated.View>
          );
        })}
      </LayoutAnimationConfig>
    </View>
  );
}
