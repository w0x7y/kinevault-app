import { useState } from "react";
import { TextInput, View } from "react-native";
import Animated, { LayoutAnimationConfig } from "react-native-reanimated";
import { IconButton } from "../components/button";
import { useLayoutMotion, useStateTransition } from "../components/motion";
import { inputSurface } from "../components/text-field";
import { AppText, Overline } from "../components/ui";
import { useTheme } from "../theme/provider";
import { fonts, radius, spacing } from "../theme/tokens";
import { formatElapsed, type ExerciseSet, type SetHint } from "./model";
import {
  isBlankSet,
  setLines,
  trackingMode,
  type SetField,
  type SetLine,
  type TrackingMode,
} from "./tracking";

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

/** A running set clock as the table shows it. */
export type ShownClock = { setId: string; seconds: number; countdown: boolean };

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
  onClock: (setId: string) => void;
}) {
  const mode = trackingMode(tracking);
  const rise = useLayoutMotion().enter();
  const columns = { flexDirection: "row", gap: spacing.sm, alignItems: "center" } as const;
  const cell = { flex: 1, minWidth: 0, textAlign: "center" } as const;
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={columns}>
        <Overline style={{ width: badgeColumn }}>Set</Overline>
        {mode.sided && <View style={{ width: sideColumn }} />}
        {mode.columns.map((column) => (
          <Overline key={column.field} style={cell}>
            {column.label}
          </Overline>
        ))}
        {mode.clock && <View style={{ width: 44 }} />}
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
          const entered = set.kind === "time" && Number(set.seconds.trim()) > 0;
          return (
            <Animated.View
              key={set.id}
              entering={rise}
              style={[columns, { alignItems: "stretch" }]}
            >
              <SetBadge number={index + 1} done={!isBlankSet(set)} />
              <View style={{ flex: 1, minWidth: 0, gap: spacing.xs + 2 }}>
                {setLines(set).map((line, lineIndex) => {
                  const label = line.side ? `${prefix} ${line.side}` : prefix;
                  return (
                    <View key={line.side ?? "set"} style={columns}>
                      {mode.sided && (
                        <AppText variant="caption" muted style={{ width: sideColumn }}>
                          {line.side === "left" ? "Left" : "Right"}
                        </AppText>
                      )}
                      {mode.columns.map((column) =>
                        running && column.field === "seconds" ? (
                          <ClockFace key={column.field} clock={running} label={prefix} />
                        ) : (
                          <NumberInput
                            key={column.field}
                            label={`${label} ${column.name}`}
                            value={line.values[column.field] ?? ""}
                            placeholder={hints[index]?.[lineIndex]?.values[column.field]}
                            disabled={busy}
                            onChange={(value) => onChange(set.id, line.side, column.field, value)}
                          />
                        ),
                      )}
                      {mode.clock && (
                        <IconButton
                          appearance="secondary"
                          icon={running ? "stop" : entered ? "play" : "stopwatch"}
                          label={
                            running
                              ? `Stop ${prefix} clock`
                              : entered
                                ? `Start ${formatElapsed(Number(set.seconds.trim()))} timer for ${prefix}`
                                : `Start stopwatch for ${prefix}`
                          }
                          disabled={busy}
                          onPress={() => onClock(set.id)}
                        />
                      )}
                    </View>
                  );
                })}
              </View>
            </Animated.View>
          );
        })}
      </LayoutAnimationConfig>
    </View>
  );
}
