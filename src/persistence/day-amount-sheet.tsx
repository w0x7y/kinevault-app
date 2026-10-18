import { useState, type ReactNode } from "react";
import { View } from "react-native";
import { shortDayLabel } from "../calendar/dates";
import { AppButton, ButtonRow } from "../components/button";
import { InlineMessage } from "../components/inline-message";
import { KineLoading } from "../components/kine-loading";
import { LoadFailure, RetryButton } from "../components/load-failure";
import { ModalSheet } from "../components/modal-sheet";
import { Stepper } from "../components/stepper";
import { TextField } from "../components/text-field";
import { AppText } from "../components/ui";
import { spacing } from "../theme/tokens";
import type { createDayAmountEdit } from "./day-amount-log";
import { useDocumentEdit } from "./use-document-edit";

/**
 * The sheet that sets one day's amount, such as Manual water or logged steps: a hero field between
 * steppers, Save and Cancel. The caller keys it by date, so each open day gets its own edit.
 */
export function DayAmountSheet({
  date,
  onDismiss,
  createEdit,
  title,
  description,
  testID,
  fieldLabel,
  unit,
  step,
  noun,
  loadingLabel,
  loadFailure,
  retryLabel,
  children,
}: {
  date: string;
  onDismiss: () => void;
  createEdit: () => ReturnType<typeof createDayAmountEdit>;
  title: string;
  description: string;
  testID: string;
  /** Names the amount above the field and to assistive technology. */
  fieldLabel: string;
  unit: string;
  step: number;
  /** Names what Save saves: "water" gives "Save water" and "Saving water...". */
  noun: string;
  loadingLabel: string;
  loadFailure: string;
  retryLabel: string;
  /** Shown above the amount, e.g. what the phone counted. */
  children?: ReactNode;
}) {
  const { edit, draft, error, busy, saving, load } = useDocumentEdit(createEdit);
  const ready = load.kind === "ready";
  // Closing plays the sheet out; the caller unmounts it once it has gone.
  const [open, setOpen] = useState(true);
  const close = () => setOpen(false);

  async function save() {
    if (await edit.save()) close();
  }

  return (
    <ModalSheet
      open={open}
      title={title}
      overline={`For ${shortDayLabel(date)}`}
      description={description}
      onDismiss={close}
      onClosed={onDismiss}
      dismissDisabled={busy}
      testID={testID}
    >
      {children}
      {load.kind === "loading" && <KineLoading compact label={loadingLabel} />}
      {load.kind === "error" && (
        <LoadFailure message={loadFailure} retryLabel={retryLabel} onRetry={edit.retryLoad} />
      )}
      {/* A read that hangs can be retried before it fails. */}
      {load.kind === "loading" && <RetryButton label={retryLabel} onRetry={edit.retryLoad} />}
      <View style={{ gap: spacing.sm }}>
        <AppText variant="caption" muted style={{ textAlign: "center" }}>
          {fieldLabel}
        </AppText>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <Stepper delta={-step} unit={unit} disabled={busy} onPress={() => edit.adjust(-step)} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <TextField
              label={fieldLabel}
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
          <Stepper delta={step} unit={unit} disabled={busy} onPress={() => edit.adjust(step)} />
        </View>
      </View>
      <InlineMessage align="center">{error}</InlineMessage>
      <ButtonRow>
        <AppButton fill label="Cancel" disabled={busy} onPress={close} />
        <AppButton
          fill
          tone="primary"
          label={saving ? `Saving ${noun}...` : `Save ${noun}`}
          accessibilityLabel={`Save ${noun}`}
          disabled={busy || !ready}
          onPress={() => void save()}
        />
      </ButtonRow>
    </ModalSheet>
  );
}
