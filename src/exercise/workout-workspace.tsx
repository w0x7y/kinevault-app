import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { AppText } from "../components/ui";
import { useTheme } from "../theme/provider";
import { spacing } from "../theme/tokens";
import { ExerciseButton } from "./controls";
export type WorkspaceExercise = { id: string; exercise: { name: string } };

export function exerciseRowLabel(
  exercises: WorkspaceExercise[],
  row: WorkspaceExercise,
  index: number,
) {
  return exercises.filter((item) => item.exercise.name === row.exercise.name).length > 1
    ? `${row.exercise.name} exercise ${index + 1}`
    : row.exercise.name;
}

export function WorkoutWorkspace({
  name,
  headerRight,
  toolbar,
  exercises,
  selectedId,
  onSelect,
  busy,
  testID = "active-workout-workspace",
  children,
  feedback,
  actions,
}: {
  name: string;
  headerRight?: ReactNode;
  toolbar?: ReactNode;
  exercises: WorkspaceExercise[];
  selectedId?: string;
  onSelect: (id: string) => void;
  busy: boolean;
  testID?: string;
  children: ReactNode;
  feedback?: ReactNode;
  actions: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={{ gap: spacing.layout, minWidth: 0 }}>
      <View
        testID="workout-workspace-heading"
        style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, minWidth: 0 }}
      >
        <AppText variant="heading" accessibilityRole="header" style={{ flex: 1, minWidth: 0 }}>
          {name || "Workout"}
        </AppText>
        {headerRight && (
          <View style={{ flexShrink: 0, alignItems: "flex-end" }}>{headerRight}</View>
        )}
      </View>
      {toolbar}
      <View
        testID="exercise-topbar-frame"
        style={{
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: colors.border,
          paddingVertical: spacing.sm,
          minWidth: 0,
        }}
      >
        <ScrollView
          testID="exercise-topbar"
          horizontal
          showsHorizontalScrollIndicator
          keyboardShouldPersistTaps="handled"
          style={{ minWidth: 0, flexGrow: 0 }}
          contentContainerStyle={{
            gap: spacing.sm,
            alignItems: "stretch",
            paddingBottom: spacing.xs,
          }}
        >
          {exercises.map((row, index) => (
            <View key={row.id} style={{ maxWidth: 180 }}>
              <ExerciseButton
                label={row.exercise.name}
                accessibilityLabel={`Select exercise ${exerciseRowLabel(exercises, row, index)}`}
                selected={selectedId === row.id}
                disabled={busy}
                onPress={() => onSelect(row.id)}
              />
            </View>
          ))}
        </ScrollView>
      </View>
      <View testID="exercise-details" style={{ minWidth: 0, gap: spacing.layout }}>
        {children}
      </View>
      {feedback}
      {actions}
    </View>
  );
}
