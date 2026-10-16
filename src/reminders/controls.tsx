import { type ReactNode } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import { useStateTransition } from "../components/motion";
import { IconButton } from "../components/button";
import { Chip } from "../components/chip";
import type { IconName } from "../components/icon";
import { IconWell } from "../components/icon-well";
import { Tappable } from "../components/tappable";
import { AppText } from "../components/ui";
import { useTheme } from "../theme/provider";
import { fonts, radius, spacing } from "../theme/tokens";
import {
  everyDay,
  formatHour,
  formatReminderTime,
  reminderLabels,
  stepHour,
  stepMinute,
  weekdayName,
  type ClockFormat,
  type ReminderKind,
  type ReminderTime,
  type Weekday,
} from "./model";

let clockFormat: ClockFormat | undefined;

/** The device locale's 12- or 24-hour convention, defaulting to 24-hour. */
export function deviceClockFormat(): ClockFormat {
  if (clockFormat) return clockFormat;
  clockFormat = "24h";
  try {
    const options = new Intl.DateTimeFormat(undefined, { hour: "numeric" }).resolvedOptions();
    if (options.hourCycle) clockFormat = /^h1[12]$/.test(options.hourCycle) ? "12h" : "24h";
    else if (typeof options.hour12 === "boolean") clockFormat = options.hour12 ? "12h" : "24h";
  } catch {
    /* Older Intl implementations keep the 24-hour default. */
  }
  return clockFormat;
}

export const reminderIcons: Record<ReminderKind, IconName> = {
  "weigh-in": "weight-scale",
  water: "glass-water",
  workout: "dumbbell",
  food: "utensils",
  "progress-photo": "camera",
  custom: "bell",
};

export function ReminderSwitch({
  icon,
  name,
  time,
  days,
  value,
  disabled,
  onChange,
}: {
  icon: IconName;
  name: string;
  time: string;
  days: string;
  value: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  const { colors, appearance } = useTheme();
  // The thumb slides and the track tints, like the platform switch.
  const trackTransition = useStateTransition(["backgroundColor"]);
  const thumbTransition = useStateTransition(["transform", "backgroundColor"]);
  return (
    <Tappable
      role="switch"
      label={`${name} reminder, ${time}, ${days}`}
      checked={value}
      disabled={disabled}
      onPress={() => onChange(!value)}
      feedback="fill"
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 64,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingVertical: spacing.sm,
        paddingLeft: 14,
        paddingRight: spacing.sm,
        borderRadius: radius.control,
      }}
    >
      <IconWell icon={icon} color={value ? colors.foreground : colors.mutedForeground} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <AppText variant="label" style={{ fontSize: 15, lineHeight: 21 }}>
          {name}
        </AppText>
        <AppText variant="caption" muted numberOfLines={2}>
          <AppText
            variant="caption"
            style={{
              fontFamily: fonts.bold,
              fontVariant: ["tabular-nums"],
              color: value ? colors.foreground : colors.mutedForeground,
            }}
          >
            {time}
          </AppText>
          {` · ${days}`}
        </AppText>
      </View>
      <Animated.View
        style={[
          {
            width: 48,
            height: 28,
            padding: 3,
            borderRadius: 14,
            justifyContent: "center",
            alignItems: "flex-start",
            backgroundColor: value ? colors.primary : colors.input,
          },
          trackTransition,
        ]}
      >
        <Animated.View
          style={[
            {
              width: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: value
                ? colors.primaryForeground
                : appearance === "dark"
                  ? colors.mutedForeground
                  : colors.card,
              boxShadow: "0px 1px 2px rgba(0, 0, 0, 0.18)",
              // 48 wide, less 3 padding each side and the 22 thumb.
              transform: [{ translateX: value ? 20 : 0 }],
            },
            thumbTransition,
          ]}
        />
      </Animated.View>
    </Tappable>
  );
}

function Stepper({
  label,
  shown,
  spoken,
  noun,
  disabled,
  onStep,
}: {
  label: string;
  shown: string;
  spoken: string;
  noun: string;
  disabled: boolean;
  onStep: (direction: 1 | -1) => void;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexGrow: 1,
        flexBasis: 148,
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1,
        borderRadius: radius.control,
        borderColor: colors.input,
        backgroundColor: colors.background,
      }}
    >
      <IconButton
        label={`Decrease ${noun}`}
        icon="minus"
        disabled={disabled}
        onPress={() => onStep(-1)}
      />
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ text: spoken }}
        accessibilityState={{ disabled }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={({ nativeEvent }) => {
          if (disabled) return;
          if (nativeEvent.actionName === "increment") onStep(1);
          if (nativeEvent.actionName === "decrement") onStep(-1);
        }}
        style={{ flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center" }}
      >
        <AppText variant="caption" muted>
          {label}
        </AppText>
        <AppText variant="label" numeric style={{ fontSize: 20, lineHeight: 26 }}>
          {shown}
        </AppText>
      </View>
      <IconButton
        label={`Increase ${noun}`}
        icon="plus"
        disabled={disabled}
        onPress={() => onStep(1)}
      />
    </View>
  );
}

export function TimeField({
  value,
  clock,
  disabled,
  onChange,
}: {
  value: ReminderTime;
  clock: ClockFormat;
  disabled: boolean;
  onChange: (time: ReminderTime) => void;
}) {
  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="label">Time</AppText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        <Stepper
          label="Hour"
          noun="hour"
          shown={formatHour(value.hour, clock)}
          spoken={clock === "12h" ? formatHour(value.hour, clock) : String(value.hour)}
          disabled={disabled}
          onStep={(direction) => onChange({ ...value, hour: stepHour(value.hour, direction) })}
        />
        <Stepper
          label="Minute"
          noun="minutes"
          shown={String(value.minute).padStart(2, "0")}
          spoken={String(value.minute)}
          disabled={disabled}
          onStep={(direction) =>
            onChange({ ...value, minute: stepMinute(value.minute, direction) })
          }
        />
      </View>
      <AppText variant="caption" muted accessibilityLiveRegion="polite">
        {`Reminds you at ${formatReminderTime(value, clock)}`}
      </AppText>
    </View>
  );
}

function Grid({ columns, children }: { columns: number; children: ReactNode[] }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", margin: -spacing.xs }}>
      {children.map((child, index) => (
        <View key={index} style={{ width: `${100 / columns}%`, padding: spacing.xs }}>
          {child}
        </View>
      ))}
    </View>
  );
}

export function WeekdayField({
  value,
  disabled,
  onChange,
}: {
  value: readonly Weekday[];
  disabled: boolean;
  onChange: (weekdays: Weekday[]) => void;
}) {
  const all = value.length === everyDay.length;
  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="label">Days</AppText>
      <Grid columns={4}>
        {[
          ...everyDay.map((day) => {
            const selected = value.includes(day);
            return (
              <Chip
                key={day}
                size="small"
                role="checkbox"
                label={weekdayName(day)}
                accessibilityLabel={weekdayName(day, "long")}
                selected={selected}
                disabled={disabled}
                onPress={() =>
                  onChange(
                    selected
                      ? value.filter((item) => item !== day)
                      : [...value, day].sort((a, b) => a - b),
                  )
                }
              />
            );
          }),
          <Chip
            key="all"
            size="small"
            label="Every day"
            selected={all}
            disabled={disabled}
            onPress={() => onChange([...everyDay])}
          />,
        ]}
      </Grid>
    </View>
  );
}

export function KindField({
  kinds,
  value,
  disabled,
  onChange,
}: {
  kinds: readonly ReminderKind[];
  value: ReminderKind;
  disabled: boolean;
  onChange: (kind: ReminderKind) => void;
}) {
  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="label">Remind me about</AppText>
      <View accessibilityRole="radiogroup" accessibilityLabel="Remind me about">
        <Grid columns={2}>
          {kinds.map((kind) => (
            <Chip
              key={kind}
              size="small"
              role="radio"
              label={reminderLabels[kind]}
              icon={reminderIcons[kind]}
              selected={kind === value}
              disabled={disabled}
              onPress={() => onChange(kind)}
            />
          ))}
        </Grid>
      </View>
    </View>
  );
}
