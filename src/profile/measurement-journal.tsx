import { ButtonRow, AppButton, IconButton } from "../components/button";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { AppText, Overline, Panel } from "../components/ui";
import { InlineMessage } from "../components/inline-message";
import { useSelectedDay } from "../calendar/provider";
import { TextField } from "../components/text-field";
import { useTheme } from "../theme/provider";
import { fonts, spacing } from "../theme/tokens";
import { JournalDisclosure, JournalHeading } from "./journal-ui";
import { SourceStatus } from "./profile-controls";
import { ModalSheet } from "../components/modal-sheet";
import { useDocumentEdit } from "../persistence/use-document-edit";
import { useProfile, useProfilePersistence } from "./provider";
import { createMeasurementEdit } from "./weight-editing";
import { WeightChart, weightDateLabel } from "./weight-chart";
import { useUnits } from "../units/provider";
import { measureFigure, unitName, type UnitSystem } from "../units/units";
import {
  measurementLabels,
  measurementSeries,
  measurements,
  type Measurement,
  type MeasurementEntry,
} from "./measurement-model";

// Non-breaking spaces keep each name, value and unit on one line.
const summary = (entry: MeasurementEntry, units: UnitSystem) =>
  measurements
    .filter((name) => entry.cm[name] !== undefined)
    .map(
      (name) =>
        `${measurementLabels[name]} ${measureFigure("length", entry.cm[name]!, units)} ${unitName("length", units)}`,
    )
    .join(" · ");

export function MeasurementJournal() {
  const profile = useProfile();
  const persistence = useProfilePersistence();
  const { units } = useUnits();
  // The Personal journal keys this by units, so the edit's messages follow them.
  const { edit, attempt, busy, replacing } = useDocumentEdit(() =>
    createMeasurementEdit(persistence, units),
  );
  const { selectedDay } = useSelectedDay();
  const { colors } = useTheme();
  const [visible, setVisible] = useState(10);
  const [chosen, setChosen] = useState<Measurement>("waist");
  const draft = attempt?.kind === "edit" ? attempt.draft : null;
  const fields = attempt?.kind === "edit" ? attempt.fields : {};
  const deleting = attempt?.kind === "delete" ? attempt.entry : null;
  const error = attempt?.error;
  if (profile.state.kind !== "ready")
    return (
      <Panel>
        <JournalHeading title="Body measurements" />
        <SourceStatus
          name="measurement history"
          kind={profile.state.kind}
          retry={profile.retryLoad}
        />
      </Panel>
    );
  const entries = profile.state.document.bodyMeasurements ?? [];
  const history = entries.slice(-visible).reverse();
  // The chart offers only measurements with values. The chooser also names the one shown.
  const options = measurements.filter((name) => measurementSeries(entries, name).length);
  const shown = options.includes(chosen) ? chosen : (options[0] ?? chosen);
  const locked = busy || Boolean(profile.refreshError);
  return (
    <Panel testID="profile-measurement-journal">
      <JournalHeading title="Body measurements">
        <AppButton
          size="small"
          label="Log"
          accessibilityLabel="Log measurements"
          icon="plus"
          // A date that has measurements opens them, so a new value doesn't replace the others.
          onPress={() =>
            edit.begin(
              selectedDay,
              entries.find((entry) => entry.date === selectedDay),
            )
          }
          disabled={locked}
        />
      </JournalHeading>
      {profile.refreshError && (
        <View style={{ gap: spacing.xs }}>
          <InlineMessage>{profile.refreshError}</InlineMessage>
          <AppButton
            size="small"
            label="Retry measurement history"
            icon="rotate-right"
            onPress={profile.retryLoad}
            disabled={busy}
          />
        </View>
      )}
      {options.length > 0 && (
        <View style={{ zIndex: 3, alignItems: "flex-start" }}>
          <JournalDisclosure
            align="left"
            label="Choose measurement"
            values={options.map((name) => ({ value: name, label: measurementLabels[name] }))}
            value={shown}
            onChange={setChosen}
          />
        </View>
      )}
      <WeightChart
        entries={measurementSeries(entries, shown)}
        name={measurementLabels[shown]}
        quantity="length"
        icon="person"
        empty="No measurements yet. Log your waist, chest, hips, arm or thigh to start a trend."
      />
      {history.length > 0 && (
        <View testID="body-measurement-history" style={{ marginTop: spacing.xs }}>
          <Overline style={{ marginBottom: spacing.xs }}>History</Overline>
          {history.map((entry, index) => (
            <View
              key={entry.date}
              testID={`measurement-entry-${entry.date}`}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.xs,
                minHeight: 52,
                paddingVertical: spacing.xs,
                marginRight: -spacing.sm,
                borderTopWidth: index ? StyleSheet.hairlineWidth : 0,
                borderColor: colors.border,
              }}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="label" style={{ fontFamily: fonts.medium }}>
                  {weightDateLabel(entry.date)}
                </AppText>
                <AppText variant="caption" muted>
                  {summary(entry, units)}
                </AppText>
              </View>
              <IconButton
                label={`Edit measurements ${entry.date}`}
                icon="pen"
                onPress={() => edit.begin(selectedDay, entry)}
                disabled={locked}
              />
              <IconButton
                label={`Delete measurements ${entry.date}`}
                icon="trash-can"
                destructive
                onPress={() => edit.beginDelete(entry)}
                disabled={locked}
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
        title={draft?.previousDate ? "Edit measurements" : "Log measurements"}
        description="Fill in the ones you measured."
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
            {measurements.map((name) => (
              <TextField
                key={name}
                label={`${measurementLabels[name]} (${unitName("length", units)})`}
                quantity="length"
                value={draft[name]}
                onChange={(value) => edit.change(name, value)}
                error={fields[name]}
                kind="decimal"
                disabled={busy}
              />
            ))}
            {replacing && (
              <AppText variant="caption" muted>
                Measurements exist on this date. Saving replaces them.
              </AppText>
            )}
            {error && <InlineMessage>{error}</InlineMessage>}
            <ButtonRow>
              <AppButton
                fill
                label="Cancel"
                accessibilityLabel="Cancel measurement editing"
                onPress={edit.cancel}
                disabled={busy}
              />
              <AppButton
                fill
                label={busy ? "Saving…" : "Save"}
                accessibilityLabel="Save measurements"
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
        title="Delete measurements"
        onDismiss={edit.cancel}
        dismissDisabled={busy}
      >
        {deleting && (
          <>
            <AppText muted>
              Delete {summary(deleting, units)} recorded on {weightDateLabel(deleting.date)}?
            </AppText>
            {error && <InlineMessage>{error}</InlineMessage>}
            <ButtonRow>
              <AppButton
                label="Keep"
                accessibilityLabel="Keep measurements"
                onPress={edit.cancel}
                disabled={busy}
                fill
              />
              <AppButton
                label={busy ? "Deleting…" : "Delete"}
                accessibilityLabel="Delete measurements"
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
