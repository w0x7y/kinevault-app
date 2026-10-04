import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { AppText } from "../components/ui";
import { spacing } from "../theme/tokens";
import { ExerciseButton } from "./controls";
import type { SessionExercise } from "./model";

export function exerciseRowLabel(exercises: SessionExercise[], row: SessionExercise, index: number) {
  return exercises.filter(item => item.exercise.name === row.exercise.name).length > 1
    ? `${row.exercise.name} exercise ${index + 1}` : row.exercise.name;
}

export function WorkoutWorkspace({ name, date, exercises, selectedId, onSelect, onEnd, busy, children, footer }: {
  name: string; date: string;
  exercises: SessionExercise[]; selectedId?: string; onSelect: (id: string) => void;
  onEnd: () => void; busy: boolean; children: ReactNode; footer: ReactNode;
}) {
  return <View testID="active-workout-workspace" style={{ gap: spacing.layout, minWidth: 0 }}>
    <AppText variant="heading" accessibilityRole="header">{name || "Active workout"}</AppText>
    <AppText variant="caption" muted>{date} · In progress</AppText>
    <ScrollView testID="exercise-topbar" horizontal showsHorizontalScrollIndicator keyboardShouldPersistTaps="handled"
      style={{ minWidth: 0, flexGrow: 0 }} contentContainerStyle={{ gap: spacing.sm, alignItems: "stretch", paddingBottom: spacing.xs }}>
      {exercises.map((row, index) => <View key={row.id} style={{ maxWidth: 180 }}><ExerciseButton label={row.exercise.name}
        accessibilityLabel={`Select exercise ${exerciseRowLabel(exercises, row, index)}`} selected={selectedId === row.id}
        disabled={busy} onPress={() => onSelect(row.id)} /></View>)}
    </ScrollView>
    <View testID="exercise-details" style={{ minWidth: 0, gap: spacing.layout }}>{children}</View>
    {footer}
    <ExerciseButton label="End workout" primary disabled={busy} onPress={onEnd} />
  </View>;
}
