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
import { trackingMode, trackingModes } from "./tracking";
import { InlineMessage } from "../components/inline-message";
import { TextField } from "../components/text-field";
import { Hairline, SectionLabel } from "./controls";
import { SegmentedControl } from "../components/segmented-control";
import { useSheetBack, useSheetScrollTarget } from "../components/sheet-page";
import { WorkoutWorkspace } from "./workout-workspace";
import type { LibraryDrafts } from "./library-drafts";
import { useSnapshot } from "./use-exercise-tab-view";
import { KineVaultDemoSection } from "./demo/demo-picker";

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
  const { values, demo, busy, error } = useSnapshot(draft);
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
      <SectionLabel>How to track</SectionLabel>
      <SegmentedControl
        label="How to track"
        options={trackingModes.map((value) => ({
          value,
          label: trackingMode(value).name,
          short: trackingMode(value).short,
        }))}
        value={values.tracking}
        onChange={(tracking) => draft.change((v) => ({ ...v, tracking }))}
        disabled={busy}
      />
      <AppText variant="caption" muted>
        Leave weight blank for bodyweight. Alternating logs reps per side; Timed logs a stopwatch or
        countdown time instead of reps and weight. Changes apply to future workouts; a KineVault
        demo shows in past workouts too.
      </AppText>
      <View ref={demoSection.ref} onLayout={demoSection.onLayout}>
        <KineVaultDemoSection
          link={values.catalog}
          exerciseName={values.name}
          picker={demo}
          onPick={draft.pickDemo}
          disabled={busy}
          onLink={draft.linkCatalog}
          onUnlink={draft.unlinkCatalog}
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
  const { draft, busy, error, selected, settingsOpen, query, notesId, results } =
    useSnapshot(template);
  const rise = useLayoutMotion().enter();
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
        onChange={template.search}
        disabled={busy}
      />
      {results.message && (
        <AppText variant="caption" muted>
          {results.message}
        </AppText>
      )}
      {results.items.length > 0 && (
        <View>
          {results.items.map((item, index) => (
            <View key={item.id}>
              {index > 0 && <Hairline />}
              <AddExerciseRow exercise={item} onPress={() => template.add(item)} disabled={busy} />
            </View>
          ))}
        </View>
      )}
      {results.more && (
        <AppButton
          size="compact"
          fill
          label="Show more exercises"
          onPress={template.showMore}
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
            onPress={() => template.showSettings(!settingsOpen)}
            disabled={busy}
          />
        }
        toolbar={settingsOpen ? builder : undefined}
        exercises={draft.rows}
        selected={selected}
        onSelect={template.select}
        notesId={notesId}
        onShowNotes={template.showNotes}
        empty={
          <AppText variant="caption" muted>
            {settingsOpen
              ? "Choose exercises above to set their planned sets."
              : "Open Exercises to add exercises to this workout."}
          </AppText>
        }
        busy={busy}
        feedback={<InlineMessage>{error}</InlineMessage>}
        primary={
          <AppButton
            label="Save workout"
            onPress={() => void template.save()}
            tone="primary"
            disabled={busy}
          />
        }
        actions={
          workout && (
            <DeleteButton
              label="Delete workout"
              confirmAccessibilityLabel="Confirm delete workout"
              onDelete={template.remove}
              disabled={busy}
            />
          )
        }
      >
        {/* No "Link demo" here: leaving would discard unsaved template changes. */}
        {(row, rowLabel) => (
          <TextField
            labelTone="muted"
            label={`Planned sets for ${rowLabel}`}
            value={row.rawCount}
            onChange={(value) => template.change((current) => current.setCount(row.id, value))}
            kind="decimal"
            layout="inline"
            disabled={busy}
          />
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
