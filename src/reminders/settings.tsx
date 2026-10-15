import { useRef, useState } from "react";
import { Linking, Platform, TextInput, View } from "react-native";
import { AppButton, ButtonRow, IconButton } from "../components/button";
import { DeleteButton } from "../components/delete-button";
import { Icon } from "../components/icon";
import { AppText, Panel } from "../components/ui";
import { useTheme } from "../theme/provider";
import { fonts, radius, spacing } from "../theme/tokens";
import {
  KindField,
  ReminderSwitch,
  TimeField,
  WeekdayField,
  deviceClockFormat,
  reminderIcons,
} from "./controls";
import {
  createReminderId,
  customTitleFromText,
  describeWeekdays,
  formatReminderTime,
  isPresetId,
  maxCustomTitleLength,
  maxReminders,
  reminderDefaults,
  reminderName,
  type ClockFormat,
  type Reminder,
  type ReminderKind,
} from "./model";
import { useReminders } from "./provider";

export function ReminderSettings() {
  const reminders = useReminders();
  const { colors } = useTheme();
  // Reminders exist only in the installed app, so the web build leaves the section out.
  if (Platform.OS === "web") return null;
  return (
    <Panel testID="reminder-settings">
      <AppText variant="heading" accessibilityRole="header">
        Reminders
      </AppText>
      {!reminders.supported ? (
        <AppText muted>
          Reminders need the installed KineVault Track app. Expo Go for Android can't schedule them.
        </AppText>
      ) : (
        <>
          <AppText muted>
            Get a nudge at the time you choose. Reminders stay on this device for your account.
          </AppText>
          {reminders.state.kind === "loading" && (
            <AppText muted accessibilityLiveRegion="polite">
              Loading reminders...
            </AppText>
          )}
          {reminders.state.kind === "error" && (
            <>
              <AppText accessibilityRole="alert" style={{ color: colors.error }}>
                Couldn't load your reminders.
              </AppText>
              <AppButton label="Try again" onPress={reminders.retryLoad} />
              <DeleteButton
                label="Reset reminders"
                hint="Replaces the unreadable reminders with the default ones, turned off."
                onDelete={reminders.reset}
              />
            </>
          )}
          {reminders.state.kind === "ready" && (
            <ReminderList reminders={reminders.state.document.reminders} />
          )}
        </>
      )}
    </Panel>
  );
}

function ReminderList({ reminders: list }: { reminders: readonly Reminder[] }) {
  const reminders = useReminders();
  const { colors } = useTheme();
  const clock = deviceClockFormat();
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const busy = reminders.saving || reminders.asking;
  const permission = reminders.permission;
  const blocked = permission !== null && !permission.granted && !permission.canAskAgain;
  const askable = permission !== null && !permission.granted && permission.canAskAgain;
  const anyEnabled = list.some((reminder) => reminder.enabled);
  const full = list.length >= maxReminders;

  return (
    <>
      {blocked && (
        <Callout
          text="Notifications are off for KineVault Track. Turn them on in your device settings to get reminders."
          action="Open settings"
          onPress={() => void Linking.openSettings().catch(() => {})}
        />
      )}
      {askable && anyEnabled && (
        <Callout
          text="Allow notifications so your reminders can appear."
          action="Allow notifications"
          disabled={busy}
          onPress={() => void reminders.requestPermission()}
        />
      )}
      <View style={{ gap: spacing.sm }}>
        {list.map((reminder) => {
          const open = editing === reminder.id;
          const name = reminderName(reminder);
          return (
            <View
              key={reminder.id}
              style={{
                borderWidth: 2,
                borderRadius: radius.control,
                borderColor: open ? colors.primary : "transparent",
                backgroundColor: colors.secondary,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", paddingRight: 4 }}>
                <ReminderSwitch
                  icon={reminderIcons[reminder.kind]}
                  name={name}
                  time={formatReminderTime(reminder.time, clock)}
                  days={describeWeekdays(reminder.weekdays)}
                  value={reminder.enabled}
                  disabled={busy}
                  onChange={(enabled) => void reminders.setEnabled(reminder.id, enabled)}
                />
                <IconButton
                  label={`Edit ${name} reminder`}
                  icon="pen"
                  expanded={open}
                  onPress={() => {
                    setAdding(false);
                    setEditing(open ? null : reminder.id);
                  }}
                />
              </View>
              {open && (
                <View style={{ padding: spacing.layout, paddingTop: 0 }}>
                  <ReminderEditor
                    initial={reminder}
                    clock={clock}
                    onClose={() =>
                      setEditing((current) => (current === reminder.id ? null : current))
                    }
                  />
                </View>
              )}
            </View>
          );
        })}
      </View>
      {adding ? (
        <View
          style={{
            padding: spacing.layout,
            borderRadius: radius.control,
            backgroundColor: colors.secondary,
          }}
        >
          <ReminderEditor clock={clock} onClose={() => setAdding(false)} />
        </View>
      ) : (
        <AppButton
          label="Add reminder"
          disabled={busy || full}
          onPress={() => {
            setEditing(null);
            setAdding(true);
          }}
        />
      )}
      {full && !adding && (
        <AppText variant="caption" muted>
          {`You have ${maxReminders} reminders, the maximum. Delete one to add another.`}
        </AppText>
      )}
      {reminders.notice && (
        <AppText accessibilityRole="alert" style={{ color: colors.error }}>
          {reminders.notice}
        </AppText>
      )}
      {reminders.error && (
        <AppText accessibilityRole="alert" style={{ color: colors.error }}>
          {reminders.error}
        </AppText>
      )}
      {reminders.scheduleFailed && (
        <>
          <AppText accessibilityRole="alert" style={{ color: colors.error }}>
            Your reminders are saved, but this device couldn't schedule them.
          </AppText>
          <AppButton label="Try scheduling again" onPress={reminders.retrySchedule} />
        </>
      )}
      <AppText variant="caption" muted accessibilityLiveRegion="polite">
        {reminders.saving ? "Saving…" : "Times follow this device's clock."}
      </AppText>
    </>
  );
}

function Callout({
  text,
  action,
  disabled = false,
  onPress,
}: {
  text: string;
  action: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        gap: spacing.sm,
        padding: spacing.layout,
        borderRadius: radius.control,
        backgroundColor: colors.muted,
      }}
    >
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Icon name="bell-slash" size={16} color={colors.primary} style={{ marginTop: 4 }} />
        <AppText style={{ flex: 1 }}>{text}</AppText>
      </View>
      <AppButton label={action} disabled={disabled} onPress={onPress} />
    </View>
  );
}

// Any kind can be added; the four built-in reminders always remain listed.
const addableKinds: readonly ReminderKind[] = [
  "water",
  "food",
  "workout",
  "weigh-in",
  "progress-photo",
  "custom",
];

function ReminderEditor({
  initial,
  clock,
  onClose,
}: {
  /** Omit to add a new reminder. */
  initial?: Reminder;
  clock: ClockFormat;
  onClose: () => void;
}) {
  const reminders = useReminders();
  const { colors } = useTheme();
  const [kind, setKind] = useState<ReminderKind>(initial?.kind ?? "water");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [schedule, setSchedule] = useState(() =>
    initial ? { time: initial.time, weekdays: initial.weekdays } : reminderDefaults("water"),
  );
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [titleFocused, setTitleFocused] = useState(false);
  const submitting = useRef(false);
  const busy = reminders.saving || reminders.asking;
  const removable = initial !== undefined && !isPresetId(initial.id);

  async function save() {
    if (submitting.current || busy) return;
    const text = kind === "custom" ? customTitleFromText(title) : null;
    if (kind === "custom" && !text) {
      setError(`Enter reminder text of up to ${maxCustomTitleLength} characters.`);
      return;
    }
    if (!schedule.weekdays.length) {
      setError("Choose at least one day.");
      return;
    }
    setError(null);
    submitting.current = true;
    try {
      const saved = await reminders.saveReminder({
        id: initial?.id ?? createReminderId(),
        kind,
        ...(text ? { title: text } : {}),
        // A new reminder starts on; an edit keeps its current state.
        enabled: initial?.enabled ?? true,
        time: schedule.time,
        weekdays: schedule.weekdays,
      });
      if (saved) onClose();
    } finally {
      submitting.current = false;
    }
  }

  return (
    <View style={{ gap: spacing.layout }}>
      {!initial && (
        <KindField
          kinds={addableKinds}
          value={kind}
          disabled={busy}
          onChange={(next) => {
            setKind(next);
            setError(null);
            // Suggest the new kind's usual time until the user picks one.
            if (!touched) setSchedule(reminderDefaults(next));
          }}
        />
      )}
      {kind === "custom" && (
        <View style={{ gap: spacing.xs }}>
          <AppText variant="label">Reminder text</AppText>
          <TextInput
            accessibilityLabel="Reminder text"
            value={title}
            maxLength={maxCustomTitleLength}
            editable={!busy}
            placeholder="For example, take vitamins"
            placeholderTextColor={colors.mutedForeground}
            returnKeyType="done"
            onChangeText={(text) => {
              setTitle(text);
              setError(null);
            }}
            onFocus={() => setTitleFocused(true)}
            onBlur={() => setTitleFocused(false)}
            style={{
              minHeight: 48,
              padding: spacing.layout,
              borderWidth: 1,
              borderRadius: radius.control,
              borderColor: titleFocused ? colors.ring : colors.input,
              color: colors.foreground,
              backgroundColor: colors.card,
              fontFamily: fonts.regular,
              fontSize: 16,
            }}
          />
          <AppText variant="caption" muted>
            {`${title.length}/${maxCustomTitleLength} characters. This is the notification's title.`}
          </AppText>
        </View>
      )}
      <TimeField
        value={schedule.time}
        clock={clock}
        disabled={busy}
        onChange={(time) => {
          setTouched(true);
          setSchedule((current) => ({ ...current, time }));
        }}
      />
      <WeekdayField
        value={schedule.weekdays}
        disabled={busy}
        onChange={(weekdays) => {
          setTouched(true);
          setError(null);
          setSchedule((current) => ({ ...current, weekdays }));
        }}
      />
      {error && (
        <AppText accessibilityRole="alert" style={{ color: colors.error }}>
          {error}
        </AppText>
      )}
      <ButtonRow>
        <AppButton label="Cancel" fill disabled={busy} onPress={onClose} />
        <AppButton
          primary
          fill
          label={reminders.saving ? "Saving..." : initial ? "Save reminder" : "Add reminder"}
          disabled={busy}
          onPress={() => void save()}
        />
      </ButtonRow>
      {removable && (
        <DeleteButton
          label="Delete reminder"
          accessibilityLabel={`Delete ${reminderName(initial)} reminder`}
          disabled={busy}
          onDelete={async () => {
            const deleted = await reminders.deleteReminder(initial.id);
            if (deleted) onClose();
            return deleted;
          }}
        />
      )}
    </View>
  );
}
