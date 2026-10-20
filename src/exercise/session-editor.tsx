import { useEffect, useState } from "react";
import { Vibration, View } from "react-native";
import { AppText, Overline, Panel } from "../components/ui";
import { ButtonRow, AppButton, IconButton } from "../components/button";
import { DeleteButton } from "../components/delete-button";
import { spacing } from "../theme/tokens";
import type { SessionExercise } from "./model";
import { ExerciseDemoSlot } from "./demo/exercise-demo";
import { useSnapshot } from "./use-exercise-tab-view";
import type { WorkoutEdit } from "./workout-editing";
import { InlineMessage } from "../components/inline-message";
import { TextField } from "../components/text-field";
import { ExerciseNotes, SectionLabel } from "./controls";
import { ExerciseSetTable } from "./set-table";
import { exerciseRowLabel } from "./short-name";
import { WorkoutWorkspace } from "./workout-workspace";
import { useSheetBack } from "../components/sheet-page";

export function SessionEditor({
  edit,
  closable = false,
}: {
  edit: WorkoutEdit;
  /** Whether a compact card shows its close control: a panel opened the card on its own. */
  closable?: boolean;
}) {
  const {
    fields: draft,
    counts,
    busy,
    error,
    countError: settingsError,
    selected,
    hints,
    notesId,
    clock,
    durationCaption,
    settingsOpen,
    detailsOpen,
    mode,
    back,
    backLabel,
    primary,
    primaryLabel,
    discard,
    start,
    details,
    retry,
    overline,
    testID,
  } = useSnapshot(edit);
  // While a set clock runs the editor redraws it, and a countdown that runs out logs its time
  // and buzzes, whichever exercise shows.
  const [, redraw] = useState(0);
  useEffect(() => {
    if (!clock) return;
    const timer = setInterval(() => {
      if (edit.tickClock()) Vibration.vibrate();
      redraw((count) => count + 1);
    }, 250);
    return () => clearInterval(timer);
  }, [clock, edit]);
  const clockTime = edit.clockTime();
  // In a sheet, its back button is this workout's Cancel. The Active workout keeps running.
  const inSheet = useSheetBack({ onPress: () => void edit.run(back), disabled: busy });
  function renderExercise(row: SessionExercise, index: number) {
    const rowLabel = exerciseRowLabel(draft.exercises, row, index);
    return (
      <View key={row.id} style={{ gap: spacing.layout, minWidth: 0 }}>
        <View
          testID="exercise-detail-heading"
          style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, minWidth: 0 }}
        >
          <AppText
            variant="heading"
            accessibilityRole="header"
            style={{ flex: 1, minWidth: 0, fontSize: 17 }}
          >
            {row.exercise.name}
          </AppText>
          <IconButton
            appearance="secondary"
            icon="plus"
            label={`Add set to ${rowLabel}`}
            disabled={busy}
            onPress={() => edit.change({ kind: "add-set", rowId: row.id })}
          />
          <IconButton
            appearance="secondary"
            icon="note-sticky"
            label={`View notes for ${rowLabel}`}
            expanded={notesId === row.id}
            disabled={busy}
            onPress={() => edit.showNotes(notesId === row.id ? null : row.id)}
          />
        </View>
        <ExerciseSetTable
          tracking={row.exercise.tracking}
          sets={row.sets}
          hints={hints}
          rowLabel={rowLabel}
          busy={busy}
          clock={
            clock?.rowId === row.id && clockTime !== null
              ? { setId: clock.setId, seconds: clockTime, countdown: clock.target !== null }
              : null
          }
          onChange={(setId, side, field, value) =>
            edit.change({ kind: "set", rowId: row.id, setId, side, field, value })
          }
          onClock={(setId) => edit.toggleClock(row.id, setId)}
          onRemove={(setId) => edit.change({ kind: "remove-set", rowId: row.id, setId })}
        />
        {notesId === row.id && <ExerciseNotes notes={row.exercise.notes} />}
        <ExerciseDemoSlot
          exercise={row.exercise}
          label={rowLabel}
          disabled={busy}
          onLinkDemo={(definition) => void edit.linkDemo(definition)}
        />
      </View>
    );
  }
  const feedback = (
    <>
      <InlineMessage>{error}</InlineMessage>
      {error && retry && (
        <AppButton
          label="Retry draft save"
          onPress={() => void edit.run("retry")}
          disabled={busy}
        />
      )}
    </>
  );
  // Manual and completed logs can rename the workout and set its duration.
  const headerActions = details && (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
      <AppButton
        size="compact"
        icon="pen"
        label="Details"
        accessibilityLabel="Workout name and duration"
        expanded={detailsOpen}
        disabled={busy}
        onPress={() => edit.showDetails(!detailsOpen)}
      />
    </View>
  );
  const toolbar = details && (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <Overline>Duration</Overline>
        <AppText
          variant="label"
          accessibilityLabel="Workout duration"
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {durationCaption}
        </AppText>
      </View>
      {start && (
        <AppButton label="Start workout" onPress={() => void edit.run("start")} disabled={busy} />
      )}
      {detailsOpen && (
        <View testID="workout-log-settings" style={{ gap: spacing.layout }}>
          <TextField
            labelTone="muted"
            label="Workout name"
            value={draft.name}
            onChange={(value) => edit.change({ kind: "name", value })}
            disabled={busy}
          />
          <TextField
            labelTone="muted"
            label="Duration in minutes (optional)"
            value={draft.minutes}
            onChange={(value) => edit.change({ kind: "minutes", value })}
            kind="decimal"
            disabled={busy}
          />
        </View>
      )}
    </>
  );
  // The main action leads; discarding sits under it in red, so it is never the first tap.
  const actions = (
    <View testID="workout-log-actions" style={{ gap: spacing.sm, marginTop: "auto" }}>
      <AppButton
        label={primaryLabel}
        onPress={() => void edit.run(primary)}
        tone="primary"
        disabled={busy}
      />
      {discard && (
        <DeleteButton
          label="Discard workout"
          confirmAccessibilityLabel="Confirm discard workout"
          onDelete={() => edit.run("discard")}
          disabled={busy}
        />
      )}
    </View>
  );
  const plannedHeading = (
    <View style={{ gap: 2 }}>
      <Overline>{overline}</Overline>
      <AppText
        variant="heading"
        accessibilityRole="header"
        style={{ fontSize: 22, lineHeight: 28, letterSpacing: -0.4 }}
      >
        {draft.name}
      </AppText>
      <AppText variant="caption" muted numberOfLines={2}>
        {draft.exercises.length
          ? draft.exercises.map((row) => row.exercise.name).join(" · ")
          : "No exercises yet"}
      </AppText>
    </View>
  );
  return (
    // On its page the workout fills the sheet, with its actions at the bottom.
    <Panel testID={inSheet ? undefined : "session-editor"} style={inSheet && { flexGrow: 1 }}>
      {mode === "compact" ? (
        <View testID={testID} style={{ gap: spacing.md }}>
          {closable ? (
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.sm }}>
              <View style={{ flex: 1, minWidth: 0 }}>{plannedHeading}</View>
              <IconButton
                label={backLabel}
                icon="xmark"
                disabled={busy}
                onPress={() => void edit.run(back)}
              />
            </View>
          ) : (
            plannedHeading
          )}
          <ButtonRow>
            {start && (
              <AppButton
                label="Start workout"
                tone="primary"
                fill
                onPress={() => void edit.run("start")}
                disabled={busy}
              />
            )}
            <AppButton
              label={primaryLabel}
              fill
              onPress={() => void edit.run(primary)}
              disabled={busy}
            />
          </ButtonRow>
          <AppButton
            icon="gear"
            label="Workout settings"
            expanded={settingsOpen}
            onPress={() => edit.showSettings(!settingsOpen)}
            disabled={busy}
          />
          {settingsOpen && (
            <View testID="planned-workout-settings" style={{ gap: spacing.layout }}>
              <SectionLabel>Planned sets</SectionLabel>
              {draft.exercises.map((row, index) => (
                <TextField
                  labelTone="muted"
                  key={row.id}
                  label={`Planned sets for ${exerciseRowLabel(draft.exercises, row, index)}`}
                  value={counts[row.id] ?? String(row.sets.length)}
                  onChange={(value) => edit.change({ kind: "count", rowId: row.id, value })}
                  kind="decimal"
                  layout="inline"
                  disabled={busy}
                />
              ))}
              <InlineMessage>{settingsError}</InlineMessage>
              <AppButton
                label="Save settings"
                onPress={() => void edit.run("settings")}
                disabled={busy}
              />
            </View>
          )}
          {feedback}
        </View>
      ) : (
        <WorkoutWorkspace
          name={draft.name}
          overline={overline}
          testID={testID}
          headerActions={headerActions}
          toolbar={toolbar}
          exercises={draft.exercises}
          selectedId={selected?.id}
          onSelect={edit.select}
          busy={busy}
          feedback={feedback}
          actions={actions}
        >
          {selected ? (
            renderExercise(selected, draft.exercises.indexOf(selected))
          ) : (
            <AppText muted>This workout has no exercises.</AppText>
          )}
        </WorkoutWorkspace>
      )}
    </Panel>
  );
}
