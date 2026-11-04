import { useMemo, useState } from "react";
import { Keyboard, View, type ViewProps } from "react-native";
import { Icon } from "../components/icon";
import { pagedResults } from "../components/paging";
import { ResultPager } from "../components/result-pager";
import { Tappable } from "../components/tappable";
import { AppText, Overline, Panel } from "../components/ui";
import { useTheme } from "../theme/provider";
import { fonts, radius, spacing } from "../theme/tokens";
import {
  exerciseResultPage as pageSize,
  matchingExercises,
  type ExerciseDefinition,
} from "./model";
import { trackingMode } from "./tracking";
import { DemoThumbnail } from "./demo/exercise-demo";
import { Hairline } from "./controls";

function ExerciseResult({
  exercise,
  onSelect,
}: {
  exercise: ExerciseDefinition;
  onSelect: () => void;
}) {
  const { colors } = useTheme();
  const metadata = [exercise.muscleGroup, exercise.equipment, trackingMode(exercise.tracking).tag]
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
  exercises: readonly ExerciseDefinition[];
  onSelect: (exercise: ExerciseDefinition) => void;
  onLayout: ViewProps["onLayout"];
  onNavigate: () => void;
}) {
  const [page, setPage] = useState(0);
  const result = useMemo(
    () => pagedResults(matchingExercises(exercises, query), page, pageSize),
    [exercises, query, page],
  );
  if (page !== result.page) setPage(result.page);
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
          {result.total
            ? `${result.total.toLocaleString()} matching exercises.`
            : "No exercises found. Try a simpler name or different equipment."}
        </AppText>
      </View>
      <View>
        {result.items.map((exercise, index) => (
          <View key={exercise.id}>
            {index > 0 && <Hairline />}
            <ExerciseResult exercise={exercise} onSelect={() => select(exercise)} />
          </View>
        ))}
      </View>
      <ResultPager result={result} size={pageSize} noun="exercise" onPage={changePage} />
    </Panel>
  );
}
