import { useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { IconButton } from "../components/button";
import { Icon, type IconName } from "../components/icon";
import { AppText } from "../components/ui";
import { useTheme } from "../theme/provider";
import { radius, spacing } from "../theme/tokens";
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
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={`${name} reminder, ${time}, ${days}`}
      aria-checked={value}
      aria-disabled={disabled}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onChange(!value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 56,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.layout,
        padding: spacing.layout,
        borderRadius: radius.control,
        borderWidth: 2,
        borderColor: focused ? colors.ring : "transparent",
        backgroundColor: pressed ? colors.accent : "transparent",
        opacity: disabled ? 0.6 : 1,
      })}
    >
      <Icon name={icon} size={20} color={value ? colors.primary : colors.mutedForeground} />
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="label">{name}</AppText>
        <AppText variant="caption" muted>
          {`${time} · ${days}`}
        </AppText>
      </View>
      <View
        style={{
          width: 44,
          height: 26,
          padding: 3,
          borderRadius: 13,
          justifyContent: "center",
          alignItems: value ? "flex-end" : "flex-start",
          backgroundColor: value ? colors.primary : colors.border,
        }}
      >
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: value ? colors.primaryForeground : colors.card,
          }}
        />
      </View>
    </Pressable>
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
        backgroundColor: colors.card,
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
        <AppText variant="label" style={{ fontSize: 18, lineHeight: 24 }}>
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

function Chip({
  role,
  label,
  accessibilityLabel = label,
  selected,
  disabled,
  icon,
  onPress,
}: {
  role: "checkbox" | "radio" | "button";
  label: string;
  accessibilityLabel?: string;
  selected: boolean;
  disabled: boolean;
  icon?: IconName;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={accessibilityLabel}
      aria-checked={role === "button" ? undefined : selected}
      aria-pressed={role === "button" ? selected : undefined}
      accessibilityState={
        role === "button" ? { selected, disabled } : { checked: selected, disabled }
      }
      disabled={disabled}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => ({
        minHeight: 48,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: icon ? "flex-start" : "center",
        gap: spacing.sm,
        paddingHorizontal: spacing.sm,
        borderRadius: radius.control,
        borderWidth: focused ? 2 : 1,
        borderColor: focused ? colors.ring : selected ? colors.primary : colors.border,
        backgroundColor: selected || pressed ? colors.accent : colors.card,
        opacity: disabled ? 0.6 : 1,
      })}
    >
      {icon && (
        <Icon name={icon} size={16} color={selected ? colors.primary : colors.mutedForeground} />
      )}
      <AppText
        variant="label"
        numberOfLines={2}
        style={{ flexShrink: 1, color: selected ? colors.primary : colors.foreground }}
      >
        {label}
      </AppText>
    </Pressable>
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
            role="button"
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
