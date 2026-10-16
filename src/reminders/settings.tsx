import { useRef, useState, type ReactNode } from "react";
import { Linking, Platform, View } from "react-native";
import Animated from "react-native-reanimated";
import { useLayoutMotion } from "../components/motion";
import { AppButton, ButtonRow, IconButton } from "../components/button";
import { DeleteButton } from "../components/delete-button";
import { Icon } from "../components/icon";
import { InlineMessage } from "../components/inline-message";
import { LoadFailure } from "../components/load-failure";
import { TextField } from "../components/text-field";
import { AppText } from "../components/ui";
import { RowContent, RowDivider, SettingsGroup } from "../account/settings-list";
import { useTheme } from "../theme/provider";
import { radius, spacing } from "../theme/tokens";
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
  // Reminders exist only in the installed app, so the web build leaves the section out.
  if (Platform.OS === "web") return null;
  return (
    <SettingsGroup title="Reminders" cardTestID="reminder-settings">
      {!reminders.supported ? (
        <RowContent>
          <AppText variant="caption" muted>
            Reminders need the installed KineVault Track app. Expo Go for Android can't schedule
            them.
          </AppText>
        </RowContent>
      ) : reminders.state.kind === "ready" ? (
        <ReminderList reminders={reminders.state.document.reminders} />
      ) : (
        <RowContent>
          {reminders.state.kind === "loading" && (
            <AppText variant="caption" muted accessibilityLiveRegion="polite">
              Loading reminders...
            </AppText>
          )}
          {reminders.state.kind === "error" && (
            <LoadFailure
              message="Couldn't load your reminders."
              retryLabel="Try again"
              onRetry={reminders.retryLoad}
            >
              <DeleteButton
                label="Reset reminders"
                hint="Replaces the unreadable reminders with the default ones, turned off."
                onDelete={reminders.reset}
              />
            </LoadFailure>
          )}
        </RowContent>
      )}
    </SettingsGroup>
  );
}

function ReminderList({ reminders: list }: { reminders: readonly Reminder[] }) {
  const reminders = useReminders();
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
    <View>
      {(blocked || (askable && anyEnabled)) && (
        <RowContent style={{ paddingBottom: 0 }}>
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
        </RowContent>
      )}
      {list.map((reminder, index) => {
        const open = editing === reminder.id;
        const name = reminderName(reminder);
        return (
          <View key={reminder.id}>
            {index > 0 && <RowDivider />}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingRight: spacing.xs,
              }}
            >
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
                icon={open ? "chevron-up" : "pen"}
                expanded={open}
                onPress={() => {
                  setAdding(false);
                  setEditing(open ? null : reminder.id);
                }}
              />
            </View>
            {open && (
              <EditorSheet>
                <ReminderEditor
                  initial={reminder}
                  clock={clock}
                  onClose={() =>
                    setEditing((current) => (current === reminder.id ? null : current))
                  }
                />
              </EditorSheet>
            )}
          </View>
        );
      })}
      <RowDivider inset={false} />
      {adding ? (
        <EditorSheet>
          <AppText variant="label">New reminder</AppText>
          <ReminderEditor clock={clock} onClose={() => setAdding(false)} />
        </EditorSheet>
      ) : null}
      <RowContent>
        {!adding && (
          <AppButton
            label="Add reminder"
            icon="plus"
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
        <InlineMessage>{reminders.notice}</InlineMessage>
        <InlineMessage>{reminders.error}</InlineMessage>
        {reminders.scheduleFailed && (
          <>
            <InlineMessage>
              Your reminders are saved, but this device couldn't schedule them.
            </InlineMessage>
            <AppButton label="Try scheduling again" onPress={reminders.retrySchedule} />
          </>
        )}
        <AppText variant="caption" muted accessibilityLiveRegion="polite">
          {reminders.saving
            ? "Saving…"
            : "Times follow this device's clock. Reminders stay on this device for your account."}
        </AppText>
      </RowContent>
    </View>
  );
}

/** The editor opens in a sunken sheet directly under the row it changes. It fades in rather than
 * growing, so the rows below move once instead of every frame. */
function EditorSheet({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const { fade } = useLayoutMotion();
  return (
    <Animated.View
      entering={fade}
      style={{ backgroundColor: colors.muted, paddingBottom: spacing.xs }}
    >
      <View
        style={{
          margin: spacing.md,
          marginTop: spacing.xs,
          padding: spacing.card - 2,
          gap: spacing.layout,
          borderRadius: radius.control + 4,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
        }}
      >
        {children}
      </View>
    </Animated.View>
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
        <Icon name="bell-slash" size={16} color={colors.primary} style={{ marginTop: 2 }} />
        <AppText variant="caption" style={{ flex: 1, lineHeight: 19 }}>
          {text}
        </AppText>
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
  const [kind, setKind] = useState<ReminderKind>(initial?.kind ?? "water");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [schedule, setSchedule] = useState(() =>
    initial ? { time: initial.time, weekdays: initial.weekdays } : reminderDefaults("water"),
  );
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
        <TextField
          label="Reminder text"
          value={title}
          maxLength={maxCustomTitleLength}
          disabled={busy}
          placeholder="For example, take vitamins"
          onChange={(text) => {
            setTitle(text);
            setError(null);
          }}
          description={`${title.length}/${maxCustomTitleLength} characters. This is the notification's title.`}
        />
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
      <InlineMessage>{error}</InlineMessage>
      <ButtonRow>
        <AppButton label="Cancel" fill disabled={busy} onPress={onClose} />
        <AppButton
          tone="primary"
          fill
          label={reminders.saving ? "Saving..." : initial ? "Save reminder" : "Add reminder"}
          disabled={busy}
          onPress={() => void save()}
        />
      </ButtonRow>
      {removable && (
        <DeleteButton
          icon="trash-can"
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
