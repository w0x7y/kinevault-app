import type { ReactNode } from "react";
import { View } from "react-native";
import { AppText, Overline, Panel } from "../components/ui";
import { fonts, spacing } from "../theme/tokens";
import { shortDayLabel } from "../calendar/dates";
import type { WorkoutTemplate } from "./model";
import { useExercises } from "./provider";
import { AppButton } from "../components/button";
import { DeleteButton } from "../components/delete-button";
import { InlineMessage } from "../components/inline-message";
import { Hairline } from "./controls";
import { useSheetBack } from "../components/sheet-page";
import type { LibraryDrafts } from "./library-drafts";
import { useSnapshot } from "./use-exercise-tab-view";

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
  const store = useExercises();
  const workouts = store.state.kind === "ready" ? store.state.document.workouts : [];
  const records =
    store.state.kind === "ready"
      ? store.state.document.sessions.filter((workout) => workout.date === date)
      : [];
  const { busy, error } = useSnapshot(actions);
  // The sheet's back button closes the menu, except while a change is saving.
  useSheetBack({ disabled: busy });
  return (
    <Panel style={{ gap: spacing.layout }}>
      {workouts.length === 0 && (
        <AppText muted>No workout found. Create a workout to get started.</AppText>
      )}
      {workouts.length > 0 && (
        <View>
          {workouts.map((workout, index) => (
            <View key={workout.id}>
              {index > 0 && <Hairline />}
              <LibraryRow
                title={workout.name}
                detail={`${workout.exercises.length} ${workout.exercises.length === 1 ? "exercise" : "exercises"} · ${workout.exercises.map((item) => item.name).join(", ")}`}
              >
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

/** A list row: title, one muted line of detail and small actions underneath. */
function LibraryRow({
  title,
  detail,
  children,
}: {
  title: string;
  detail: string;
  children: ReactNode;
}) {
  return (
    <View style={{ gap: spacing.sm + 2, paddingVertical: spacing.md + 2 }}>
      <View style={{ gap: 2 }}>
        <AppText variant="label" style={{ fontSize: 16, lineHeight: 22, fontFamily: fonts.bold }}>
          {title}
        </AppText>
        <AppText variant="caption" muted numberOfLines={2}>
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
