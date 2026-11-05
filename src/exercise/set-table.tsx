import { useState } from "react";
import { TextInput, View } from "react-native";
import Animated, { LayoutAnimationConfig } from "react-native-reanimated";
import { IconButton, iconButtonSize } from "../components/button";
import { Tappable } from "../components/tappable";
import { useLayoutMotion, useStateTransition } from "../components/motion";
import { inputSurface } from "../components/text-field";
import { AppText, Overline } from "../components/ui";
import { useTheme } from "../theme/provider";
import { fonts, radius, spacing } from "../theme/tokens";
import { useUnits } from "../units/provider";
import { fieldText, savedText } from "../units/units";
import { formatElapsed, type ExerciseSet, type SetHint } from "./model";
import type { ShownClock } from "./set-clock";
import {
  columnText,
  isBlankSet,
  isWarmUp,
  setLines,
  timedSeconds,
  trackingMode,
  withHintValues,
  type SetField,
  type SetLine,
  type TrackingMode,
} from "./tracking";

const badgeColumn = 32;
/** Edit mode's add and remove buttons beside a set: two 48 pt icon buttons. */
const editColumn = iconButtonSize * 2 + spacing.xs;
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
  // Weights and distances save metric figures, so typing "5." comes back as "5". While focused,
  // the field keeps what was typed for as long as it means the saved number.
  const [typed, setTyped] = useState<string | null>(null);
  const shown =
    typed !== null && (typed === value || (typed.trim() !== "" && Number(typed) === Number(value)))
      ? typed
      : value;
  const empty = shown === "";
  return (
    <TextInput
      accessibilityLabel={label}
      value={shown}
      placeholder={placeholder}
      // Hints are last session's values: lighter, regular weight and slanted, so they never
      // read as something already logged.
      placeholderTextColor={`${colors.mutedForeground}99`}
      onChangeText={(text) => {
        setTyped(text);
        onChange(text);
      }}
      editable={!disabled}
      inputMode="decimal"
      keyboardType="decimal-pad"
      selectTextOnFocus
      maxLength={32}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        setTyped(null);
      }}
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

type BadgePress = {
  label: string;
  hint?: string;
  /** A checkbox's state; a button has none. */
  checked?: boolean;
  disabled?: boolean;
  onPress: () => void;
};
/**
 * The set number (L1 and R1 on a left/right set, W on a warm-up); it fills in ink once the set
 * has values. With `press`, it is a button that copies last workout's values into the line's
 * blank fields, or in edit mode a checkbox that marks the set as a warm-up.
 */
function SetBadge({
  label,
  warmUp,
  done,
  press,
}: {
  label: string;
  warmUp: boolean;
  done: boolean;
  press?: BadgePress;
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
        accessibilityLabel={warmUp ? "Warm-up" : undefined}
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
  if (!press) return <View style={column}>{badge}</View>;
  // The 44 pt target overhangs the narrower column so the fields keep their width.
  const overhang = (44 - badgeColumn) / 2;
  return (
    <Tappable
      role={press.checked === undefined ? "button" : "checkbox"}
      label={press.label}
      hint={press.hint}
      checked={press.checked}
      disabled={press.disabled}
      ring="outline"
      onPress={press.onPress}
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
 * The sets of one exercise in its Tracking mode's columns. Outside edit mode a Timed or Cardio
 * set's button starts its clock: a countdown from the entered seconds, or a stopwatch on a blank
 * set. In edit mode a weighted set's number marks it as a warm-up.
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
  editing,
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
  /** Edit mode: add a set after this one, remove it, or mark it as a warm-up or not. */
  editing?: {
    onAdd: (setId: string) => void;
    onRemove: (setId: string) => void;
    onWarmUp: (setId: string) => void;
  };
}) {
  const mode = trackingMode(tracking);
  const { units } = useUnits();
  // A weight or distance shows and is typed in the chosen units; other values as saved.
  const shown = (column: (typeof mode.columns)[number], value: string | undefined) =>
    column.quantity && value !== undefined ? fieldText(column.quantity, value, units) : value;
  // Edit mode's add and remove buttons take the clock button's place, so a Cardio set's two
  // fields still fit at 320 pt. A running clock keeps running and still shows its face.
  const clockButton = mode.clock && !editing;
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
          {mode.columns.map((column) => {
            const text = columnText(column, units);
            return (
              <Overline key={column.field} style={cell}>
                {editing ? (text.short ?? text.label) : text.label}
              </Overline>
            );
          })}
          {clockButton && <View style={{ width: iconButtonSize }} />}
          {editing && <View style={{ width: editColumn }} />}
        </View>
      </View>
      {sets.length === 0 ? (
        <AppText variant="caption" muted>
          {mode.clock ? "Add a set to time it." : "Add a set to enter repetitions and weight."}
        </AppText>
      ) : (
        editing &&
        mode.weighted && (
          <AppText variant="caption" muted>
            Tap a set&apos;s number to mark it as a warm-up.
          </AppText>
        )
      )}
      {/* Sets already there when the table opens are simply there; an added set rises in. */}
      <LayoutAnimationConfig skipEntering>
        {sets.map((set, index) => {
          const prefix = `${rowLabel} set ${index + 1}`;
          const running = clock?.setId === set.id ? clock : null;
          const countdown = timedSeconds(set);
          const warmUp = isWarmUp(set);
          return (
            <Animated.View key={set.id} entering={rise} style={{ gap: spacing.xs + 2 }}>
              {setLines(set).map((line, lineIndex) => {
                const label = line.side ? `${prefix} ${line.side}` : prefix;
                const hint = hints[index]?.[lineIndex];
                // Last workout's values would fill a field still blank.
                const fillable = hint !== undefined && withHintValues(set, hint) !== set;
                let press: BadgePress | undefined;
                // In edit mode a weighted set's number marks a warm-up: a left/right set's first
                // line holds the checkbox for the whole set.
                if (editing && mode.weighted) {
                  if (lineIndex === 0)
                    press = {
                      label: `${prefix} warm-up`,
                      checked: warmUp,
                      disabled: busy,
                      onPress: () => editing.onWarmUp(set.id),
                    };
                } else if (fillable && !busy)
                  press = {
                    label: `Fill ${label} from last workout`,
                    hint: "Fills this set with your last workout's values",
                    onPress: () => onFill(set.id, line.side),
                  };
                return (
                  <View key={line.side ?? "set"} style={setRow}>
                    <SetBadge
                      label={`${line.side ? sideLetter[line.side] : ""}${warmUp ? "W" : index + 1}`}
                      warmUp={warmUp}
                      done={!isBlankSet(set)}
                      press={press}
                    />
                    <View style={fields}>
                      {mode.columns.map((column) =>
                        running && column.field === "seconds" ? (
                          <ClockFace key={column.field} clock={running} label={prefix} />
                        ) : (
                          <NumberInput
                            key={column.field}
                            label={`${label} ${columnText(column, units).name}`}
                            value={shown(column, line.values[column.field]) ?? ""}
                            placeholder={shown(column, hint?.values[column.field])}
                            disabled={busy}
                            onChange={(value) =>
                              onChange(
                                set.id,
                                line.side,
                                column.field,
                                column.quantity ? savedText(column.quantity, value, units) : value,
                              )
                            }
                          />
                        ),
                      )}
                      {clockButton && (
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
                      {/* A left/right set's buttons sit on its first line; the second keeps the column. */}
                      {editing &&
                        (lineIndex === 0 ? (
                          <View style={{ flexDirection: "row", gap: spacing.xs }}>
                            <IconButton
                              appearance="secondary"
                              icon="plus"
                              label={`Add set after ${prefix}`}
                              disabled={busy}
                              onPress={() => editing.onAdd(set.id)}
                            />
                            <IconButton
                              appearance="secondary"
                              icon="minus"
                              label={`Remove ${prefix}`}
                              disabled={busy}
                              onPress={() => editing.onRemove(set.id)}
                            />
                          </View>
                        ) : (
                          <View style={{ width: editColumn }} />
                        ))}
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
