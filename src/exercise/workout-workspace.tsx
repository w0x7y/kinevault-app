import type { ReactNode } from "react";
import { View } from "react-native";
import { AppText } from "../components/ui";
import { useTheme } from "../theme/provider";
import { spacing } from "../theme/tokens";
import { ExerciseButton } from "./controls";
import type { SessionExercise } from "./model";

export function exerciseRowLabel(exercises: SessionExercise[], row: SessionExercise, index: number) {
  return exercises.filter(item => item.exercise.name === row.exercise.name).length > 1
    ? `${row.exercise.name} exercise ${index + 1}` : row.exercise.name;
}

export function WorkoutWorkspace({ exercises, selectedId, onSelect, onEnd, busy, children }: {
  exercises: SessionExercise[]; selectedId?: string; onSelect: (id: string) => void;
  onEnd: () => void; busy: boolean; children: ReactNode;
}) {
  const { colors } = useTheme();
  return <View testID="active-workout-workspace" style={{ flexDirection: "row", alignItems: "stretch", gap: spacing.sm, minWidth: 0 }}>
    <View testID="exercise-sidebar" style={{ flex: 1, maxWidth: 180, minWidth: 72, gap: spacing.sm,
      paddingRight: spacing.sm, borderRightWidth: 1, borderRightColor: colors.border }}>
      <AppText variant="label">Exercises</AppText>
      {exercises.map((row, index) => <ExerciseButton key={row.id} label={row.exercise.name}
        accessibilityLabel={`Select exercise ${exerciseRowLabel(exercises, row, index)}`} selected={selectedId === row.id}
        disabled={busy} onPress={() => onSelect(row.id)} />)}
      <View style={{ flexGrow: 1, minHeight: spacing.layout }} />
      <ExerciseButton label="End workout" primary disabled={busy} onPress={onEnd} />
    </View>
    <View testID="exercise-details" style={{ flex: 2.4, minWidth: 0, gap: spacing.layout }}>{children}</View>
  </View>;
}
