import { useState } from "react";
import { View } from "react-native";
import { shortDayLabel } from "../calendar/dates";
import { AppButton, ButtonRow } from "../components/button";
import { IconWell } from "../components/icon-well";
import { InlineMessage } from "../components/inline-message";
import { KineLoading } from "../components/kine-loading";
import { LoadFailure, RetryButton } from "../components/load-failure";
import { ModalSheet } from "../components/modal-sheet";
import { Stepper } from "../components/stepper";
import { TextField } from "../components/text-field";
import { AppText } from "../components/ui";
import { useDocumentEdit } from "../persistence/use-document-edit";
import { useTheme } from "../theme/provider";
import { fonts, radius, spacing } from "../theme/tokens";
import { createManualStepsEdit } from "./manual-editing";
import { useStepsLogPersistence } from "./provider";
import type { DeviceStepsReading } from "./use-device-steps";

// Home keys this modal by date, so each open day gets its own steps edit.
export function StepsEntryModal({
  date,
  phone,
  onDismiss,
}: {
  date: string;
  phone: DeviceStepsReading;
  onDismiss: () => void;
}) {
  const log = useStepsLogPersistence();
  const { edit, draft, error, busy, saving, load } = useDocumentEdit(() =>
    createManualStepsEdit({ log, date }),
  );
  const ready = load.kind === "ready";
  // Closing plays the sheet out; Home unmounts it once it has gone.
  const [open, setOpen] = useState(true);
  const close = () => setOpen(false);

  async function save() {
    if (await edit.save()) close();
  }

  return (
    <ModalSheet
      open={open}
      title="Log steps"
      overline={`For ${shortDayLabel(date)}`}
      description="Steps your phone counts are added automatically. Log any it missed, like a walk without your phone."
      onDismiss={close}
      onClosed={onDismiss}
      dismissDisabled={busy}
      testID="steps-entry"
    >
      <PhoneSteps phone={phone} />
      {load.kind === "loading" && <KineLoading compact label="Loading steps..." />}
      {load.kind === "error" && (
        <LoadFailure
          message="Couldn't load your logged steps."
          retryLabel="Retry steps"
          onRetry={edit.retryLoad}
        />
      )}
      {/* A read that hangs can be retried before it fails. */}
      {load.kind === "loading" && <RetryButton label="Retry steps" onRetry={edit.retryLoad} />}
      <View style={{ gap: spacing.sm }}>
        <AppText variant="caption" muted style={{ textAlign: "center" }}>
          Logged steps
        </AppText>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <Stepper delta={-500} unit="steps" disabled={busy} onPress={() => edit.adjust(-500)} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <TextField
              label="Logged steps"
              labelHidden
              kind="integer"
              size="hero"
              value={draft}
              disabled={busy}
              invalid={Boolean(error)}
              onChange={(text) => {
                edit.change(text);
              }}
              onSubmit={() => void save()}
            />
          </View>
          <Stepper delta={500} unit="steps" disabled={busy} onPress={() => edit.adjust(500)} />
        </View>
      </View>
      <InlineMessage align="center">{error}</InlineMessage>
      <ButtonRow>
        <AppButton fill label="Cancel" disabled={busy} onPress={close} />
        <AppButton
          fill
          tone="primary"
          label={saving ? "Saving steps..." : "Save steps"}
          accessibilityLabel="Save steps"
          disabled={busy || !ready}
          onPress={() => void save()}
        />
      </ButtonRow>
    </ModalSheet>
  );
}

/** What the phone counted for the day, or how to let the app read it. */
function PhoneSteps({ phone }: { phone: DeviceStepsReading }) {
  const { colors } = useTheme();
  let status: string,
    action: { label: string; onPress: () => void | Promise<void> } | null = null;
  if (phone.access === "granted" && phone.state === "ready")
    status = `${(phone.steps ?? 0).toLocaleString()} steps`;
  else if (phone.access === null || phone.access === "granted") {
    status = phone.state === "error" ? "Couldn't read phone steps." : "Loading...";
    if (phone.state === "error") action = { label: "Retry phone steps", onPress: phone.retry };
  } else if (phone.access === "undetermined") {
    status = "Not connected";
    action = { label: "Connect phone steps", onPress: phone.connect };
  } else if (phone.access === "denied") {
    status = "Step access is off.";
    action = { label: "Open settings", onPress: phone.openSettings };
  } else if (phone.access === "install") {
    status = "Install Health Connect to count steps.";
    action = { label: "Get Health Connect", onPress: phone.openSettings };
  } else status = "Phone step counting isn't available on this device.";
  const counted = phone.access === "granted" && phone.state === "ready";
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
      {action && <AppButton label={action.label} onPress={() => void action.onPress()} />}
    </View>
  );
}
