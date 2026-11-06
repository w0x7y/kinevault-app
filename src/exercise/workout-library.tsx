import type { ReactNode } from "react";
import { View } from "react-native";
import { AppText, Overline, Panel } from "../components/ui";
import { fonts, spacing } from "../theme/tokens";
import { shortDayLabel } from "../calendar/dates";
import { templateSuperset, type WorkoutTemplate } from "./model";
import { exerciseListText } from "./supersets";
import { AppButton } from "../components/button";
import { DeleteButton } from "../components/delete-button";
import { InlineMessage } from "../components/inline-message";
import { Hairline } from "./controls";
import { useSheetBack } from "../components/sheet-page";
import type { LibraryDrafts } from "./library-drafts";
import { useSnapshot } from "./use-exercise-tab-view";
import { limitReached } from "../plus/gate";
import { LimitNotice, PlusTag } from "../plus/locks";
import { usePaywall } from "../plus/paywall";
import { usePlus } from "../plus/provider";

export function WorkoutLibrary({
  actions,
  date,
  onEdit,
  onOpen,
}: {
  /** Adding and deleting logs for the menu's day. */
  actions: ReturnType<LibraryDrafts["savedWorkouts"]>;
  date: string;
  onEdit: (workout: WorkoutTemplate) => void;
  onOpen: (id: string) => void;
}) {
  const { busy, error, workouts, logs: records } = useSnapshot(actions);
  // The sheet's back button closes the menu, except while a change is saving.
  useSheetBack({ disabled: busy });
  const { unlocked } = usePlus();
  const paywall = usePaywall();
  const full = limitReached("workouts", workouts.length, unlocked);
  return (
    <Panel style={{ gap: spacing.layout }}>
      <LimitNotice limit="workouts" count={workouts.length} />
      {paywall.sheet}
      {workouts.length === 0 && (
        <AppText muted>No workout found. Create a workout to get started.</AppText>
      )}
      {workouts.length > 0 && (
        <View>
          {workouts.map((workout, index) => (
            <View key={workout.id}>
              {index > 0 && <Hairline />}
              <LibraryRow title={workout.name} {...templateDetail(workout)}>
                <AppButton
                  tone="primary"
                  size="compact"
                  icon="plus"
                  label="Add to day"
                  accessibilityLabel={`Add ${workout.name} to selected day`}
                  onPress={() => void actions.plan(workout.id)}
                  disabled={busy}
                />
                <AppButton
                  size="compact"
                  icon="pen"
                  label="Edit"
                  accessibilityLabel={`Edit workout ${workout.name}`}
                  onPress={() => onEdit(workout)}
                  disabled={busy}
                />
                <AppButton
                  size="compact"
                  icon="copy"
                  label="Duplicate"
                  accessibilityLabel={`Duplicate workout ${workout.name}${full ? ", part of Plus" : ""}`}
                  badge={full && <PlusTag />}
                  onPress={() =>
                    full ? paywall.open("workouts") : void actions.duplicate(workout.id)
                  }
                  disabled={busy}
                />
              </LibraryRow>
            </View>
          ))}
        </View>
      )}
      {records.length > 0 && (
        <Overline accessibilityRole="header" style={{ marginTop: spacing.sm }}>
          Workouts for {shortDayLabel(date)}
        </Overline>
      )}
      {records.length > 0 && (
        <View>
          {records.map((workout, index) => (
            <View key={workout.id} testID={`logged-workout-${workout.id}`}>
              {index > 0 && <Hairline />}
              <LibraryRow
                title={workout.name}
                detail={`${
                  workout.status === "active"
                    ? "In progress"
                    : workout.status === "planned"
                      ? "Planned"
                      : "Completed"
                } · ${workout.exercises.length} ${workout.exercises.length === 1 ? "exercise" : "exercises"}`}
              >
                <AppButton
                  size="compact"
                  icon={workout.status === "completed" ? "pen" : "arrow-right"}
                  label={workout.status === "completed" ? "Edit" : "Open"}
                  accessibilityLabel={`${workout.status === "completed" ? "Edit logged workout" : "Open logged workout"} ${workout.name}`}
                  onPress={() => onOpen(workout.id)}
                  disabled={busy}
                />
                <DeleteButton
                  appearance="pill"
                  icon="trash-can"
                  label={workout.status === "active" ? "Discard" : "Delete"}
                  accessibilityLabel={`${workout.status === "active" ? "Discard workout" : "Delete logged workout"} ${workout.name}`}
                  confirmAccessibilityLabel={
                    workout.status === "active"
                      ? "Confirm discard workout"
                      : "Confirm delete logged workout"
                  }
                  onDelete={() => actions.removeLog(workout.id)}
                  disabled={busy}
                />
              </LibraryRow>
            </View>
          ))}
        </View>
      )}
      <InlineMessage>{error}</InlineMessage>
    </Panel>
  );
}

/** A saved workout's exercise count and exercises, each Superset's joined by "+". */
function templateDetail(workout: WorkoutTemplate) {
  const count = `${workout.exercises.length} ${workout.exercises.length === 1 ? "exercise" : "exercises"}`;
  const list = exerciseListText(
    workout.exercises.map((item) => ({
      name: item.name,
      superset: templateSuperset(workout, item.id),
    })),
    ", ",
  );
  return { detail: `${count} · ${list.text}`, detailLabel: `${count}, ${list.label}` };
}

/** A list row: title, one muted line of detail and small actions underneath. */
function LibraryRow({
  title,
  detail,
  detailLabel,
  children,
}: {
  title: string;
  detail: string;
  /** The detail for screen readers, when its text doesn't say it all. */
  detailLabel?: string;
  children: ReactNode;
}) {
  return (
    <View style={{ gap: spacing.sm + 2, paddingVertical: spacing.md + 2 }}>
      <View style={{ gap: 2 }}>
        <AppText variant="label" style={{ fontSize: 16, lineHeight: 22, fontFamily: fonts.bold }}>
          {title}
        </AppText>
        <AppText variant="caption" muted numberOfLines={2} accessibilityLabel={detailLabel}>
          {detail}
        </AppText>
      </View>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          gap: spacing.sm,
          marginLeft: 0,
        }}
      >
        {children}
      </View>
    </View>
  );
}
