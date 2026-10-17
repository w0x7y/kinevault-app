import { shortDayLabel } from "../calendar/dates";
import { ButtonRow, AppButton } from "../components/button";
import { useState } from "react";
import { View } from "react-native";
import { AppText } from "../components/ui";
import { InlineMessage } from "../components/inline-message";
import { LoadFailure, RetryButton } from "../components/load-failure";
import { ModalSheet } from "../components/modal-sheet";
import { Stepper } from "../components/stepper";
import { TextField } from "../components/text-field";
import { spacing } from "../theme/tokens";
import { useDocumentEdit } from "../persistence/use-document-edit";
import { createManualWaterEdit } from "./manual-editing";
import { useWaterLogPersistence } from "./provider";
import { KineLoading } from "../components/kine-loading";

// Home keys this modal by date, so each open day gets its own Manual water edit.
export function WaterEntryModal({ date, onDismiss }: { date: string; onDismiss: () => void }) {
  const log = useWaterLogPersistence();
  const { edit, draft, error, busy, saving, load } = useDocumentEdit(() =>
    createManualWaterEdit({ log, date }),
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
      title="Edit water"
      overline={`For ${shortDayLabel(date)}`}
      description="Edit manual water for this day. Drinks count separately in your Home total."
      onDismiss={close}
      onClosed={onDismiss}
      dismissDisabled={busy}
      testID="water-entry"
    >
      {load.kind === "loading" && <KineLoading compact label="Loading water log..." />}
      {load.kind === "error" && (
        <LoadFailure
          message="Couldn't load your water log."
          retryLabel="Retry water log"
          onRetry={edit.retryLoad}
        />
      )}
      {/* A read that hangs can be retried before it fails. */}
      {load.kind === "loading" && <RetryButton label="Retry water log" onRetry={edit.retryLoad} />}
      <View style={{ gap: spacing.sm }}>
        <AppText variant="caption" muted style={{ textAlign: "center" }}>
          Manual water (ml)
        </AppText>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <Stepper delta={-250} unit="ml" disabled={busy} onPress={() => edit.adjust(-250)} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <TextField
              label="Manual water (ml)"
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
          <Stepper delta={250} unit="ml" disabled={busy} onPress={() => edit.adjust(250)} />
        </View>
      </View>
      <InlineMessage align="center">{error}</InlineMessage>
      <ButtonRow>
        <AppButton fill label="Cancel" disabled={busy} onPress={close} />
        <AppButton
          fill
          tone="primary"
          label={saving ? "Saving water..." : "Save water"}
          accessibilityLabel="Save water"
          disabled={busy || !ready}
          onPress={() => void save()}
        />
      </ButtonRow>
    </ModalSheet>
  );
}
