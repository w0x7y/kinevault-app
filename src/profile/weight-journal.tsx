import { ButtonRow, AppButton } from "../components/button";
import { useState } from "react";
import { View } from "react-native";
import { useSelectedDay } from "../calendar/provider";
import { FoodField } from "../food/form-fields";
import { useTheme } from "../theme/provider";
import { spacing } from "../theme/tokens";
import { JournalAction, JournalHeading, JournalPanel, JournalText } from "./journal-ui";
import { ProfileDialog, SourceStatus } from "./profile-controls";
import { useProfile } from "./provider";
import { useWeightEdit } from "./use-weight-editing";
import { WeightChart, weightDateLabel, weightLabel } from "./weight-chart";

export function WeightJournal() {
  const profile = useProfile();
  const { edit, attempt, busy, replacing } = useWeightEdit();
  const { selectedDay } = useSelectedDay();
  const { colors } = useTheme();
  const [visible, setVisible] = useState(10);
  const draft = attempt?.kind === "edit" ? attempt.draft : null;
  const fields = attempt?.kind === "edit" ? attempt.fields : {};
  const deleting = attempt?.kind === "delete" ? attempt.entry : null;
  const error = attempt?.error;
  if (profile.state.kind !== "ready")
    return (
      <JournalPanel>
        <JournalHeading title="Body weight" />
        <SourceStatus name="weight history" kind={profile.state.kind} retry={profile.retryLoad} />
      </JournalPanel>
    );
  const entries = profile.state.document.weightEntries ?? [];
  const history = entries.slice(-visible);
  return (
    <JournalPanel testID="profile-weight-journal">
      <JournalHeading title="Body weight">
        <JournalAction
          label="Log weight"
          icon="plus"
          onPress={() => edit.begin(selectedDay)}
          disabled={busy || Boolean(profile.refreshError)}
        />
      </JournalHeading>
      <View style={{ gap: spacing.sm }}>
        {profile.refreshError && (
          <>
            <JournalText accessibilityRole="alert" style={{ color: colors.error }}>
              {profile.refreshError}
            </JournalText>
            <JournalAction
              label="Retry weight history"
              onPress={profile.retryLoad}
              disabled={busy}
            />
          </>
        )}
        <WeightChart entries={entries} />
        {history.length > 0 && (
          <View testID="body-weight-history" style={{ gap: 2 }}>
            <JournalText size={11} variant="label">
              Measurement history
            </JournalText>
            {history.map((entry) => (
              <View
                key={entry.date}
                testID={`weight-entry-${entry.date}`}
                style={{
                  flexDirection: "row",
                  gap: 8,
                  alignItems: "center",
                  borderBottomWidth: 1,
                  borderColor: colors.border,
                  minHeight: 44,
                }}
              >
                <View style={{ flex: 1 }}>
                  <JournalText size={11}>{weightDateLabel(entry.date)}</JournalText>
                  <JournalText size={12} variant="label">
                    {weightLabel(entry.kg)} kg
                  </JournalText>
                </View>
                <JournalAction
                  label="Edit"
                  accessibilityLabel={`Edit weight ${entry.date}`}
                  onPress={() => edit.begin(selectedDay, entry)}
                  disabled={busy || Boolean(profile.refreshError)}
                />
                <JournalAction
                  label="Delete"
                  accessibilityLabel={`Delete weight ${entry.date}`}
                  onPress={() => edit.beginDelete(entry)}
                  disabled={busy || Boolean(profile.refreshError)}
                />
              </View>
            ))}
            {entries.length > visible && (
              <JournalAction
                label="Show earlier measurements"
                onPress={() => setVisible((count) => count + 30)}
              />
            )}
          </View>
        )}
      </View>
      {draft && (
        <ProfileDialog
          title={draft.previousDate ? "Edit weight" : "Log weight"}
          dismiss={edit.cancel}
        >
          <FoodField
            label="Measurement date (YYYY-MM-DD)"
            value={draft.date}
            onChange={(value) => edit.change("date", value)}
            error={fields.date}
            disabled={busy}
          />
          <FoodField
            label="Body weight (kg)"
            value={draft.weight}
            onChange={(value) => edit.change("weight", value)}
            error={fields.weight}
            numeric
            disabled={busy}
          />
          {replacing && (
            <JournalText muted>
              A measurement exists on this date. Saving replaces its weight.
            </JournalText>
          )}
          {error && (
            <JournalText accessibilityRole="alert" style={{ color: colors.error }}>
              {error}
            </JournalText>
          )}
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
              primary
              onPress={() => void edit.save()}
              disabled={busy}
            />
          </ButtonRow>
        </ProfileDialog>
      )}
      {deleting && (
        <ProfileDialog title="Delete weight" dismiss={edit.cancel}>
          <JournalText>
            Delete {weightLabel(deleting.kg)} kg recorded on {weightDateLabel(deleting.date)}?
          </JournalText>
          {error && (
            <JournalText accessibilityRole="alert" style={{ color: colors.error }}>
              {error}
            </JournalText>
          )}
          <ButtonRow>
            <AppButton label="Keep measurement" onPress={edit.cancel} disabled={busy} fill />
            <AppButton
              label={busy ? "Deleting weight…" : "Delete measurement"}
              destructive
              onPress={() => void edit.remove()}
              disabled={busy}
              fill
            />
          </ButtonRow>
        </ProfileDialog>
      )}
    </JournalPanel>
  );
}
