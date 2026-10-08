import { useMemo, useState } from "react";
import { Keyboard, Pressable, View, type ViewProps } from "react-native";
import { Icon } from "../components/icon";
import { AppText, Panel } from "../components/ui";
import { useTheme } from "../theme/provider";
import { radius, spacing } from "../theme/tokens";
import { ExerciseButton } from "./controls";
import type { ExerciseDefinition } from "./model";

const pageSize = 20;

function ExerciseResult({
  exercise,
  onSelect,
}: {
  exercise: ExerciseDefinition;
  onSelect: () => void;
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const metadata = [exercise.muscleGroup, exercise.equipment].filter(Boolean).join(" · ");
  return (
    <Pressable
      testID="exercise-result"
      accessibilityRole="button"
      accessibilityLabel={`Edit exercise ${exercise.name}`}
      accessibilityHint="Edit this exercise in your library"
      onPress={onSelect}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => ({
        minHeight: 88,
        padding: spacing.layout,
        gap: spacing.xs,
        borderWidth: 1,
        borderRadius: radius.control,
        borderColor: focused ? colors.ring : colors.border,
        backgroundColor: pressed ? colors.accent : colors.background,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <View style={{ flex: 1, minWidth: 0, gap: spacing.xs }}>
          <AppText variant="label" style={{ flexShrink: 1 }}>
            {exercise.name}
          </AppText>
          {Boolean(metadata) && (
            <AppText variant="caption" muted>
              {metadata}
            </AppText>
          )}
          <AppText variant="caption" muted>
            {exercise.tracking === "sides" ? "Left and right" : "Single weight"}
          </AppText>
        </View>
        <Icon name="user-pen" size={14} color={colors.primary} />
      </View>
    </Pressable>
  );
}

export function ExerciseSearchResults({
  query,
  exercises,
  onSelect,
  onLayout,
  onNavigate,
}: {
  query: string;
  exercises: ExerciseDefinition[];
  onSelect: (exercise: ExerciseDefinition) => void;
  onLayout: ViewProps["onLayout"];
  onNavigate: () => void;
}) {
  const { colors } = useTheme();
  const [page, setPage] = useState(0);
  const normalized = query.trim().toLocaleLowerCase();
  const matches = useMemo(
    () =>
      !normalized
        ? []
        : exercises.filter((exercise) =>
            [exercise.name, exercise.muscleGroup, exercise.equipment, exercise.notes].some((text) =>
              text.toLocaleLowerCase().includes(normalized),
            ),
          ),
    [exercises, normalized],
  );
  const pageCount = Math.ceil(matches.length / pageSize);
  const resultPage = Math.min(page, Math.max(0, pageCount - 1));
  if (page !== resultPage) setPage(resultPage);
  function select(exercise: ExerciseDefinition) {
    Keyboard.dismiss();
    onSelect(exercise);
  }
  function changePage(nextPage: number) {
    setPage(nextPage);
    onNavigate();
  }
  return (
    <Panel testID="exercise-library" onLayout={onLayout} style={{ gap: spacing.layout }}>
      <AppText variant="heading" accessibilityRole="header">
        Exercise library
      </AppText>
      <AppText variant="caption" muted accessibilityLiveRegion="polite">
        {!normalized
          ? "Type to search exercises."
          : matches.length
            ? `${matches.length.toLocaleString()} matching exercises.`
            : "No exercises found. Try a simpler name or different equipment."}
      </AppText>
      {matches.slice(resultPage * pageSize, (resultPage + 1) * pageSize).map((exercise) => (
        <ExerciseResult key={exercise.id} exercise={exercise} onSelect={() => select(exercise)} />
      ))}
      {pageCount > 1 && (
        <View style={{ gap: spacing.sm }}>
          <AppText variant="caption" muted>
            Showing {resultPage * pageSize + 1} to{" "}
            {Math.min((resultPage + 1) * pageSize, matches.length)} of{" "}
            {matches.length.toLocaleString()}
          </AppText>
          <View
            style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.layout }}
          >
            <ExerciseButton
              label="Previous"
              accessibilityLabel="Previous exercise results"
              disabled={resultPage === 0}
              onPress={() => changePage(resultPage - 1)}
            />
            <ExerciseButton
              label="Next"
              accessibilityLabel="Next exercise results"
              disabled={resultPage + 1 >= pageCount}
              onPress={() => changePage(resultPage + 1)}
            />
          </View>
        </View>
      )}
      <View style={{ borderTopWidth: 1, borderColor: colors.border, paddingTop: spacing.layout }}>
        <AppText variant="caption" muted selectable>
          Your exercise library · Saved on this device
        </AppText>
        <AppText variant="caption" muted>
          Exercise videos are upcoming with KineVault studio integration.
        </AppText>
      </View>
    </Panel>
  );
}
