import { ButtonRow, AppButton, IconButton } from "../components/button";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { AppText, Overline, Panel } from "../components/ui";
import { InlineMessage } from "../components/inline-message";
import { useSelectedDay } from "../calendar/provider";
import { TextField } from "../components/text-field";
import { useTheme } from "../theme/provider";
import { fonts, spacing } from "../theme/tokens";
import { JournalHeading } from "./journal-ui";
import { SourceStatus } from "./profile-controls";
import { ModalSheet } from "../components/modal-sheet";
import { useDocumentEdit } from "../persistence/use-document-edit";
import { useProfile, useProfilePersistence } from "./provider";
import { createWeightEdit } from "./weight-editing";
import { WeightChart, weightDateLabel, weightLabel } from "./weight-chart";

export function WeightJournal() {
  const profile = useProfile();
  const persistence = useProfilePersistence();
  const { edit, attempt, busy, replacing } = useDocumentEdit(() => createWeightEdit(persistence));
  const { selectedDay } = useSelectedDay();
  const { colors } = useTheme();
  const [visible, setVisible] = useState(10);
  const draft = attempt?.kind === "edit" ? attempt.draft : null;
  const fields = attempt?.kind === "edit" ? attempt.fields : {};
  const deleting = attempt?.kind === "delete" ? attempt.entry : null;
  const error = attempt?.error;
  if (profile.state.kind !== "ready")
    return (
      <Panel>
        <JournalHeading title="Body weight" />
        <SourceStatus name="weight history" kind={profile.state.kind} retry={profile.retryLoad} />
      </Panel>
    );
  const entries = profile.state.document.weightEntries ?? [];
  // Newest first: the latest measurement leads the journal.
  const history = entries.slice(-visible).reverse();
  return (
    <Panel testID="profile-weight-journal">
      <JournalHeading title="Body weight">
        <AppButton
          size="small"
          label="Log weight"
          icon="plus"
          onPress={() => edit.begin(selectedDay)}
          disabled={busy || Boolean(profile.refreshError)}
        />
      </JournalHeading>
      {profile.refreshError && (
        <View style={{ gap: spacing.xs }}>
          <InlineMessage>{profile.refreshError}</InlineMessage>
          <AppButton
            size="small"
            label="Retry weight history"
            icon="rotate-right"
            onPress={profile.retryLoad}
            disabled={busy}
          />
        </View>
      )}
      <WeightChart entries={entries} />
      {history.length > 0 && (
        <View testID="body-weight-history" style={{ marginTop: spacing.xs }}>
          <Overline style={{ marginBottom: spacing.xs }}>History</Overline>
          {history.map((entry, index) => (
            <View
              key={entry.date}
              testID={`weight-entry-${entry.date}`}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.xs,
                minHeight: 52,
                marginRight: -spacing.sm,
                borderTopWidth: index ? StyleSheet.hairlineWidth : 0,
                borderColor: colors.border,
              }}
            >
              <AppText variant="label" style={{ flex: 1, fontFamily: fonts.medium }}>
                {weightDateLabel(entry.date)}
              </AppText>
              <AppText variant="label" numeric style={{ fontSize: 15, marginRight: spacing.xs }}>
                {weightLabel(entry.kg)}
                <AppText variant="caption" muted>
                  {" kg"}
                </AppText>
              </AppText>
              <IconButton
                label={`Edit weight ${entry.date}`}
                icon="pen"
                onPress={() => edit.begin(selectedDay, entry)}
                disabled={busy || Boolean(profile.refreshError)}
              />
              <IconButton
                label={`Delete weight ${entry.date}`}
                icon="trash-can"
                destructive
                onPress={() => edit.beginDelete(entry)}
                disabled={busy || Boolean(profile.refreshError)}
              />
            </View>
          ))}
          {entries.length > visible && (
            <AppButton
              icon="chevron-down"
              label="Show earlier measurements"
              onPress={() => setVisible((count) => count + 30)}
            />
          )}
        </View>
      )}
      <ModalSheet
        open={draft !== null}
        title={draft?.previousDate ? "Edit weight" : "Log weight"}
        onDismiss={edit.cancel}
        dismissDisabled={busy}
      >
        {draft && (
          <>
            <TextField
              label="Measurement date (YYYY-MM-DD)"
              value={draft.date}
              onChange={(value) => edit.change("date", value)}
              error={fields.date}
              disabled={busy}
            />
            <TextField
              label="Body weight (kg)"
              value={draft.weight}
              onChange={(value) => edit.change("weight", value)}
              error={fields.weight}
              kind="decimal"
              disabled={busy}
            />
            {replacing && (
              <AppText variant="caption" muted>
                A measurement exists on this date. Saving replaces its weight.
              </AppText>
            )}
            {error && <InlineMessage>{error}</InlineMessage>}
            <ButtonRow>
              <AppButton
                fill
                label="Cancel"
                accessibilityLabel="Cancel weight editing"
                onPress={edit.cancel}
                disabled={busy}
              />

              <AppButton
                fill
                label={busy ? "Saving weight…" : "Save weight"}
                tone="primary"
                onPress={() => void edit.save()}
                disabled={busy}
              />
            </ButtonRow>
          </>
        )}
      </ModalSheet>
      <ModalSheet
        open={deleting !== null}
        title="Delete weight"
        onDismiss={edit.cancel}
        dismissDisabled={busy}
      >
        {deleting && (
          <>
            <AppText muted>
              Delete {weightLabel(deleting.kg)} kg recorded on {weightDateLabel(deleting.date)}?
            </AppText>
            {error && <InlineMessage>{error}</InlineMessage>}
            <ButtonRow>
              <AppButton label="Keep measurement" onPress={edit.cancel} disabled={busy} fill />
              <AppButton
                label={busy ? "Deleting weight…" : "Delete measurement"}
                tone="destructive"
                onPress={() => void edit.remove()}
                disabled={busy}
                fill
              />
            </ButtonRow>
          </>
        )}
      </ModalSheet>
    </Panel>
  );
}
