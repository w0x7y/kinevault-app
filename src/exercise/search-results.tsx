import { useMemo, useState } from "react";
import { Keyboard, StyleSheet, View, type ViewProps } from "react-native";
import { IconButton } from "../components/button";
import { Icon } from "../components/icon";
import { Tappable } from "../components/tappable";
import { AppText, Overline, Panel } from "../components/ui";
import { useTheme } from "../theme/provider";
import { fonts, radius, spacing } from "../theme/tokens";
import type { ExerciseDefinition } from "./model";
import { DemoThumbnail } from "./demo/exercise-demo";
import { Hairline } from "./controls";

const pageSize = 20;

function ExerciseResult({
  exercise,
  onSelect,
}: {
  exercise: ExerciseDefinition;
  onSelect: () => void;
}) {
  const { colors } = useTheme();
  const metadata = [
    exercise.muscleGroup,
    exercise.equipment,
    exercise.tracking === "sides" && "Left and right",
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Tappable
      testID="exercise-result"
      label={`Edit exercise ${exercise.name}`}
      hint="Edit this exercise in your library"
      onPress={onSelect}
      feedback="fill"
      style={{
        minHeight: 72,
        marginHorizontal: -spacing.sm,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
        gap: 2,
        borderRadius: radius.control,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <AppText
            variant="label"
            style={{ flexShrink: 1, fontSize: 15, lineHeight: 21, fontFamily: fonts.semibold }}
          >
            {exercise.name}
          </AppText>
          {Boolean(metadata) && (
            <AppText variant="caption" muted>
              {metadata}
            </AppText>
          )}
        </View>
        {exercise.catalog && <DemoThumbnail link={exercise.catalog} />}
        <Icon name="chevron-right" size={16} color={colors.mutedForeground} />
      </View>
    </Tappable>
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
    <Panel
      testID="exercise-library"
      onLayout={onLayout}
      style={{ gap: spacing.sm, paddingBottom: spacing.sm }}
    >
      <View style={{ gap: 2 }}>
        <Overline accessibilityRole="header">Exercise library</Overline>
        <AppText variant="caption" muted accessibilityLiveRegion="polite">
          {!normalized
            ? "Type to search exercises."
            : matches.length
              ? `${matches.length.toLocaleString()} matching exercises.`
              : "No exercises found. Try a simpler name or different equipment."}
        </AppText>
      </View>
      <View>
        {matches
          .slice(resultPage * pageSize, (resultPage + 1) * pageSize)
          .map((exercise, index) => (
            <View key={exercise.id}>
              {index > 0 && <Hairline />}
              <ExerciseResult exercise={exercise} onSelect={() => select(exercise)} />
            </View>
          ))}
      </View>
      {pageCount > 1 && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            paddingTop: spacing.sm,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
          }}
        >
          <AppText variant="caption" muted style={{ flex: 1, fontVariant: ["tabular-nums"] }}>
            Showing {resultPage * pageSize + 1} to{" "}
            {Math.min((resultPage + 1) * pageSize, matches.length)} of{" "}
            {matches.length.toLocaleString()}
          </AppText>
          <IconButton
            appearance="secondary"
            icon="chevron-left"
            label="Previous exercise results"
            disabled={resultPage === 0}
            onPress={() => changePage(resultPage - 1)}
          />
          <IconButton
            appearance="secondary"
            icon="chevron-right"
            label="Next exercise results"
            disabled={resultPage + 1 >= pageCount}
            onPress={() => changePage(resultPage + 1)}
          />
        </View>
      )}
    </Panel>
  );
}
