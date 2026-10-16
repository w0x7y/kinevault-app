import { useState } from "react";
import { View } from "react-native";
import Animated, { LayoutAnimationConfig } from "react-native-reanimated";
import { useLayoutMotion } from "../components/motion";
import { AppButton, IconButton } from "../components/button";
import { DeleteButton } from "../components/delete-button";
import { AppText, Panel } from "../components/ui";
import { Icon } from "../components/icon";
import { Tappable } from "../components/tappable";
import { useTheme } from "../theme/provider";
import { fonts, radius, spacing } from "../theme/tokens";
import type { ExerciseDefinition, WorkoutTemplate } from "./model";
import { useExercises } from "./provider";
import { InlineMessage } from "../components/inline-message";
import { TextField } from "../components/text-field";
import { ExerciseNotes, Hairline, SectionLabel } from "./controls";
import { SegmentedControl } from "../components/segmented-control";
import { useSheetBack, useSheetScrollTarget } from "../components/sheet-page";
import { exerciseRowLabel, WorkoutWorkspace } from "./workout-workspace";
import type { LibraryDrafts } from "./library-drafts";
import { useLibraryDraft } from "./use-workout-editing";
import { ExerciseDemoSlot } from "./demo/exercise-demo";
import { KineVaultDemoSection } from "./demo/demo-picker";
import { applyCatalogLink, withoutCatalogLink } from "./demo/demo-link";

type ExerciseDraft = ReturnType<LibraryDrafts["exercise"]>;
type TemplateDraft = ReturnType<LibraryDrafts["template"]>;

export function ExerciseForm({
  draft,
  exercise,
  linkDemo = false,
}: {
  draft: ExerciseDraft;
  /** The saved definition being edited, if any. */
  exercise?: ExerciseDefinition;
  /** Opened from "Link demo": the sheet starts at the KineVault search, which takes focus. */
  linkDemo?: boolean;
}) {
  const { values, busy, error } = useLibraryDraft(draft);
  // The sheet's back button is this form's Cancel, except while it saves.
  useSheetBack({ disabled: busy });
  const demoSection = useSheetScrollTarget(linkDemo);
  return (
    <Panel style={{ gap: spacing.layout }}>
      <SectionLabel>Details</SectionLabel>
      <TextField
        labelTone="muted"
        label="Exercise name"
        value={values.name}
        onChange={(name) => draft.change((v) => ({ ...v, name }))}
        disabled={busy}
      />
      <TextField
        labelTone="muted"
        label="Muscle group (optional)"
        value={values.muscleGroup}
        onChange={(muscleGroup) => draft.change((v) => ({ ...v, muscleGroup }))}
        disabled={busy}
      />
      <TextField
        labelTone="muted"
        label="Equipment (optional)"
        value={values.equipment}
        onChange={(equipment) => draft.change((v) => ({ ...v, equipment }))}
        disabled={busy}
      />
      <TextField
        labelTone="muted"
        label="Notes (optional)"
        value={values.notes}
        onChange={(notes) => draft.change((v) => ({ ...v, notes }))}
        disabled={busy}
        kind="multiline"
      />
      <SectionLabel>Track repetitions and weight</SectionLabel>
      <SegmentedControl
        label="Track repetitions and weight"
        options={[
          { value: "single", label: "Single weight" },
          { value: "sides", label: "Left and right" },
        ]}
        value={values.tracking}
        onChange={(tracking) => draft.change((v) => ({ ...v, tracking }))}
        disabled={busy}
      />
      <AppText variant="caption" muted>
        Leave weight blank for bodyweight. Changes apply to future workouts; a KineVault demo shows
        in past workouts too.
      </AppText>
      <View ref={demoSection.ref} onLayout={demoSection.onLayout}>
        <KineVaultDemoSection
          link={values.catalog}
          exerciseName={values.name}
          focusSearch={linkDemo}
          disabled={busy}
          onLink={(entry) => draft.change((current) => applyCatalogLink(current, entry))}
          onUnlink={() => draft.change(withoutCatalogLink)}
        />
      </View>
      <InlineMessage>{error}</InlineMessage>
      <View style={{ gap: spacing.sm }}>
        <AppButton
          label="Save exercise"
          onPress={() => void draft.save()}
          tone="primary"
          disabled={busy}
        />
        {exercise && (
          <DeleteButton
            label="Delete exercise"
            confirmAccessibilityLabel="Confirm delete exercise"
            onDelete={draft.remove}
            disabled={busy}
          />
        )}
      </View>
    </Panel>
  );
}
export function WorkoutForm({
  draft: template,
  workout,
}: {
  draft: TemplateDraft;
  /** The saved template being edited, if any. */
  workout?: WorkoutTemplate;
}) {
  const store = useExercises();
  const exercises = store.state.kind === "ready" ? store.state.document.exercises : [];
  const { draft, busy, error } = useLibraryDraft(template);
  const [query, setQuery] = useState(""),
    [limit, setLimit] = useState(20);
  const [settingsOpen, setSettingsOpen] = useState(!workout),
    [selectedId, setSelectedId] = useState(workout?.exercises[0]?.id);
  const [notesId, setNotesId] = useState<string | null>(null);
  const rise = useLayoutMotion().enter();
  const search = query.trim().toLocaleLowerCase();
  const available = search
    ? exercises.filter(
        (item) =>
          !draft.rows.some((row) => row.exercise.id === item.id) &&
          [item.name, item.muscleGroup, item.equipment, item.notes].some((value) =>
            value.toLocaleLowerCase().includes(search),
          ),
      )
    : [];
  // The sheet's back button is this form's Cancel, except while it saves.
  useSheetBack({ disabled: busy });
  const builder = (
    <View testID="workout-template-settings" style={{ gap: spacing.layout }}>
      <TextField
        labelTone="muted"
        label="Workout name"
        value={draft.name}
        onChange={(name) => template.change((current) => current.rename(name))}
        disabled={busy}
      />
      <SectionLabel>Add exercises</SectionLabel>
      <TextField
        labelTone="muted"
        label="Search workout exercises"
        value={query}
        onChange={(value) => {
          setQuery(value);
          setLimit(20);
        }}
        disabled={busy}
      />
      {exercises.length === 0 ? (
        <AppText variant="caption" muted>
          Create an exercise first, then return to build your workout.
        </AppText>
      ) : !search ? (
        <AppText variant="caption" muted>
          Search by name, muscle group, equipment, or notes to add exercises.
        </AppText>
      ) : available.length === 0 ? (
        <AppText variant="caption" muted>
          No available exercises match your search.
        </AppText>
      ) : null}
      {available.length > 0 && (
        <View>
          {available.slice(0, limit).map((item, index) => (
            <View key={item.id}>
              {index > 0 && <Hairline />}
              <AddExerciseRow
                exercise={item}
                onPress={() => {
                  template.change((current) => current.add(item));
                  setSelectedId(item.id);
                }}
                disabled={busy}
              />
            </View>
          ))}
        </View>
      )}
      {available.length > limit && (
        <AppButton
          size="compact"
          fill
          label="Show more exercises"
          onPress={() => setLimit((value) => value + 20)}
          disabled={busy}
        />
      )}
      <AppText variant="label" style={{ marginTop: spacing.xs, fontFamily: fonts.bold }}>
        Exercise order
      </AppText>
      {draft.rows.length === 0 && (
        <AppText variant="caption" muted>
          Search above to choose exercises, then set how many sets you plan to do.
        </AppText>
      )}
      {/* An added exercise rises into the order. Rows already there when the list opens are
          simply there. Moves stay instant: typing a search above shifts this list too. */}
      <LayoutAnimationConfig skipEntering>
        {draft.rows.length > 0 && (
          <View>
            {draft.rows.map(({ exercise: item }, index) => (
              <Animated.View key={item.id} entering={rise}>
                {index > 0 && <Hairline />}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.xs,
                    paddingVertical: spacing.xs,
                    minWidth: 0,
                  }}
                >
                  <AppText variant="label" style={{ flex: 1, minWidth: 0, fontSize: 15 }}>
                    {index + 1}. {item.name}
                  </AppText>
                  <IconButton
                    icon="arrow-up"
                    label={`Move ${item.name} up`}
                    onPress={() => template.change((current) => current.move(index, -1))}
                    disabled={busy || index === 0}
                  />
                  <IconButton
                    icon="arrow-down"
                    label={`Move ${item.name} down`}
                    onPress={() => template.change((current) => current.move(index, 1))}
                    disabled={busy || index === draft.rows.length - 1}
                  />
                  <DeleteButton
                    appearance="icon"
                    label={`Remove ${item.name} from workout`}
                    confirmAccessibilityLabel="Confirm remove workout exercise"
                    onDelete={() => template.change((current) => current.remove(item.id))}
                    disabled={busy}
                  />
                </View>
              </Animated.View>
            ))}
          </View>
        )}
      </LayoutAnimationConfig>
    </View>
  );
  const selectedDraftRow =
    draft.rows.find((row) => row.exercise.id === selectedId) ?? draft.rows[0];
  const selectedExercise = selectedDraftRow?.exercise;
  const rows = draft.rows.map(({ exercise }) => ({ id: exercise.id, exercise }));
  const selectedRow = rows.find((row) => row.id === selectedExercise?.id);
  const rowLabel = selectedRow
    ? exerciseRowLabel(rows, selectedRow, rows.indexOf(selectedRow))
    : "";
  return (
    <Panel>
      <WorkoutWorkspace
        name={draft.name.trim() || "Untitled workout"}
        overline={workout ? "Saved workout" : "New workout"}
        testID={workout ? "template-workout-workspace" : "create-workout-workspace"}
        headerActions={
          <AppButton
            size="compact"
            icon="list"
            label="Exercises"
            accessibilityLabel="Name and exercises"
            expanded={settingsOpen}
            onPress={() => setSettingsOpen((value) => !value)}
            disabled={busy}
          />
        }
        toolbar={settingsOpen ? builder : undefined}
        exercises={rows}
        selectedId={selectedExercise?.id}
        onSelect={setSelectedId}
        busy={busy}
        feedback={<InlineMessage>{error}</InlineMessage>}
        actions={
          <View testID="workout-template-actions" style={{ gap: spacing.sm }}>
            <AppButton
              label="Save workout"
              onPress={() => void template.save()}
              tone="primary"
              disabled={busy}
            />
            {workout && (
              <DeleteButton
                label="Delete workout"
                confirmAccessibilityLabel="Confirm delete workout"
                onDelete={template.remove}
                disabled={busy}
              />
            )}
          </View>
        }
      >
        {selectedDraftRow && selectedExercise ? (
          <>
            <View
              testID="exercise-heading-row"
              style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}
            >
              <AppText
                variant="heading"
                accessibilityRole="header"
                style={{ flex: 1, minWidth: 0, fontSize: 17 }}
              >
                {selectedExercise.name}
              </AppText>
              <IconButton
                appearance="secondary"
                label={`View notes for ${rowLabel}`}
                icon="note-sticky"
                expanded={notesId === selectedExercise.id}
                onPress={() =>
                  setNotesId((previous) =>
                    previous === selectedExercise.id ? null : selectedExercise.id,
                  )
                }
                disabled={busy}
              />
            </View>
            <TextField
              labelTone="muted"
              label={`Planned sets for ${rowLabel}`}
              value={selectedDraftRow.rawCount}
              onChange={(value) =>
                template.change((current) => current.setCount(selectedExercise.id, value))
              }
              kind="decimal"
              layout="inline"
              disabled={busy}
            />
            {notesId === selectedExercise.id && <ExerciseNotes notes={selectedExercise.notes} />}
            {/* No "Link demo" here: leaving would discard unsaved template changes. */}
            <ExerciseDemoSlot exercise={selectedExercise} label={rowLabel} disabled={busy} />
          </>
        ) : (
          <AppText variant="caption" muted>
            {settingsOpen
              ? "Choose exercises above to set their planned sets."
              : "Open Exercises to add exercises to this workout."}
          </AppText>
        )}
      </WorkoutWorkspace>
    </Panel>
  );
}

/** A search result in the workout builder: tap to append the exercise to the order. */
function AddExerciseRow({
  exercise,
  onPress,
  disabled,
}: {
  exercise: ExerciseDefinition;
  onPress: () => void;
  disabled: boolean;
}) {
  const { colors } = useTheme();
  const metadata = [exercise.muscleGroup, exercise.equipment].filter(Boolean).join(" · ");
  return (
    <Tappable
      label={`Add ${exercise.name} to workout`}
      disabled={disabled}
      onPress={onPress}
      feedback="fill"
      style={{
        minHeight: 56,
        marginHorizontal: -spacing.sm,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        borderRadius: radius.control,
      }}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <AppText variant="label" style={{ fontSize: 15 }}>
          {exercise.name}
        </AppText>
        {Boolean(metadata) && (
          <AppText variant="caption" muted numberOfLines={1}>
            {metadata}
          </AppText>
        )}
      </View>
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.muted,
        }}
      >
        <Icon name="plus" size={17} color={colors.primary} />
      </View>
    </Tappable>
  );
}
