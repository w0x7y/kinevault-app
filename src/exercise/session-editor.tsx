import { View } from "react-native";
import { AppText, Overline, Panel } from "../components/ui";
import { ButtonRow, AppButton, IconButton } from "../components/button";
import { DeleteButton } from "../components/delete-button";
import { spacing } from "../theme/tokens";
import type { SessionExercise } from "./model";
import { useSnapshot } from "./use-exercise-tab-view";
import type { WorkoutEdit } from "./workout-editing";
import { InlineMessage } from "../components/inline-message";
import { TextField } from "../components/text-field";
import { SectionLabel } from "./controls";
import { ExerciseSetTable } from "./set-table";
import { exerciseRowLabel } from "./short-name";
import { WorkoutWorkspace } from "./workout-workspace";
import { useSheetBack } from "../components/sheet-page";
import { ModalSheet } from "../components/modal-sheet";
import { AddExerciseSheet } from "./add-exercise-sheet";

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
    previous,
    next,
    hints,
    notesId,
    editing,
    adding,
    addResults,
    removing,
    shownClock,
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
    showName,
    linkDemo,
    retry,
    overline,
    testID,
  } = useSnapshot(edit);
  // In a sheet, its back button is this workout's Cancel. The Active workout keeps running.
  const inSheet = useSheetBack({ onPress: () => void edit.run(back), disabled: busy });
  const editToggle = (
    <IconButton
      appearance="secondary"
      icon="pen"
      label="Edit workout"
      selected={editing}
      disabled={busy}
      onPress={() => edit.setEditing(!editing)}
    />
  );
  function renderSets(row: SessionExercise, rowLabel: string) {
    return (
      <>
        <ExerciseSetTable
          tracking={row.exercise.tracking}
          sets={row.sets}
          hints={hints}
          rowLabel={rowLabel}
          busy={busy}
          clock={shownClock?.rowId === row.id ? shownClock : null}
          onChange={(setId, side, field, value) =>
            edit.change({ kind: "set", rowId: row.id, setId, side, field, value })
          }
          onFill={(setId, side) => edit.change({ kind: "fill", rowId: row.id, setId, side })}
          onClock={(setId) => edit.toggleClock(row.id, setId)}
          editing={
            editing
              ? {
                  onAdd: (setId) => edit.change({ kind: "add-set", rowId: row.id, afterId: setId }),
                  onRemove: (setId) => edit.change({ kind: "remove-set", rowId: row.id, setId }),
                }
              : undefined
          }
        />
        {editing && !row.sets.length && (
          <AppButton
            icon="plus"
            label="Add set"
            accessibilityLabel={`Add set to ${rowLabel}`}
            disabled={busy}
            onPress={() => edit.change({ kind: "add-set", rowId: row.id })}
          />
        )}
      </>
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
  // Discarding sits apart from the main action, at the top right, so it is never the next tap.
  const discardButton = discard && (
    <DeleteButton
      appearance="icon"
      icon="ban"
      iconSize={26}
      label="Discard workout"
      confirmAccessibilityLabel="Confirm discard workout"
      onDelete={() => edit.run("discard")}
      disabled={busy}
    />
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
              {draft.exercises.map((row) => (
                <TextField
                  labelTone="muted"
                  key={row.id}
                  label={`Planned sets for ${exerciseRowLabel(draft.exercises, row)}`}
                  value={counts[row.id]}
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
          name={showName ? draft.name : undefined}
          overline={overline}
          testID={testID}
          headerActions={headerActions}
          toolbar={toolbar}
          exercises={draft.exercises}
          selected={selected}
          previous={previous}
          next={next}
          onSelect={edit.select}
          notesId={notesId}
          onShowNotes={edit.showNotes}
          onLinkDemo={linkDemo ? (definition) => void edit.linkDemo(definition) : undefined}
          exerciseActions={editToggle}
          editing={
            editing
              ? {
                  onRemove: edit.askRemove,
                  onMove: (rowId, to) => edit.change({ kind: "move-exercise", rowId, to }),
                  onAdd: () => edit.showAddExercise(true),
                  onNotes: (rowId, value) => edit.change({ kind: "notes", rowId, value }),
                }
              : undefined
          }
          empty={
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <AppText muted style={{ flex: 1 }}>
                This workout has no exercises.
              </AppText>
              {editToggle}
            </View>
          }
          busy={busy}
          feedback={feedback}
          primary={
            <AppButton
              label={primaryLabel}
              onPress={() => void edit.run(primary)}
              tone="primary"
              disabled={busy}
            />
          }
          trailing={discardButton}
        >
          {renderSets}
        </WorkoutWorkspace>
      )}
      <AddExerciseSheet
        query={adding?.query ?? ""}
        results={addResults}
        onSearch={edit.searchLibrary}
        onShowMore={edit.showMoreExercises}
        onAdd={(exercise) => edit.change({ kind: "add-exercise", exercise })}
        onCreate={() => void edit.createExercise()}
        onClose={() => edit.showAddExercise(false)}
      />
      <ModalSheet
        open={removing !== null}
        title="Remove exercise"
        onDismiss={() => edit.askRemove(null)}
        testID="remove-exercise-sheet"
      >
        {removing && (
          <>
            <AppText muted>{removing.question}</AppText>
            <ButtonRow>
              <AppButton label="Cancel" onPress={() => edit.askRemove(null)} fill />
              <AppButton
                label="Remove"
                accessibilityLabel={`Confirm remove ${removing.label} from workout`}
                tone="destructive"
                disabled={busy}
                onPress={() => edit.change({ kind: "remove-exercise", rowId: removing.id })}
                fill
              />
            </ButtonRow>
          </>
        )}
      </ModalSheet>
    </Panel>
  );
}
