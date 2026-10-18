import { View } from "react-native";
import { AppButton } from "../components/button";
import { IconWell } from "../components/icon-well";
import { AppText } from "../components/ui";
import { DayAmountSheet } from "../persistence/day-amount-sheet";
import { useTheme } from "../theme/provider";
import { fonts, radius, spacing } from "../theme/tokens";
import { createManualStepsEdit } from "./manual-editing";
import { useStepsLogPersistence } from "./provider";
import { phoneStepsStatus, type PhoneStepsReading } from "./summary";

// Home keys this modal by date, so each open day gets its own steps edit.
export function StepsEntryModal({
  date,
  phone,
  onDismiss,
}: {
  date: string;
  phone: PhoneStepsReading;
  onDismiss: () => void;
}) {
  const log = useStepsLogPersistence();
  return (
    <DayAmountSheet
      date={date}
      onDismiss={onDismiss}
      createEdit={() => createManualStepsEdit({ log, date })}
      title="Log steps"
      description="Steps your phone counts are added automatically. Log any it missed, like a walk without your phone."
      testID="steps-entry"
      fieldLabel="Logged steps"
      unit="steps"
      step={500}
      noun="steps"
      loadingLabel="Loading steps..."
      loadFailure="Couldn't load your logged steps."
      retryLabel="Retry steps"
    >
      <PhoneSteps phone={phone} />
    </DayAmountSheet>
  );
}

/** What the phone counted for the day, or how to let the app read it. */
function PhoneSteps({ phone }: { phone: PhoneStepsReading }) {
  const { colors } = useTheme();
  const { status, counted, action } = phoneStepsStatus(phone);
  return (
    <View
      testID="steps-phone"
      style={{
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: radius.control,
        backgroundColor: colors.muted,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <IconWell icon="shoe-prints" background="card" color={colors.mutedForeground} />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <AppText variant="caption" muted>
            Phone steps
          </AppText>
          <AppText
            accessibilityLiveRegion="polite"
            style={
              counted ? { fontFamily: fonts.extrabold, fontSize: 20, lineHeight: 28 } : undefined
            }
          >
            {status}
          </AppText>
        </View>
      </View>
      {action && <AppButton label={action.label} onPress={() => void phone[action.kind]()} />}
    </View>
  );
}
