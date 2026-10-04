import { View } from "react-native";
import { AppText, Panel } from "../components/ui";
import { FoodButton } from "../food/food-button";
import { useFoodLog } from "../food/log-provider";
import { useWaterLog } from "../water/provider";
import { useWaterGoal } from "../water/goal-provider";
import { WaterGoalEditor } from "./water-goal-editor";
import { useExercises } from "../exercise/provider";
import { interpretDayActivity } from "../daily/activity";
import { useTheme } from "../theme/provider";
import { spacing } from "../theme/tokens";
import { activities, goals } from "./answers";
import { calorieState } from "./calories";
import { macroTargets } from "./macros";
import { useProfile } from "./provider";
import { ProfileEditor } from "./profile-editor";
import type { ProfileEditSection } from "./section-editing";
import { SourceStatus } from "./profile-controls";
export type ProfileEditorInstance = {
  id: number;
  section: ProfileEditSection | "water";
};
export function ProfileGoals({
  today,
  editor,
  edit,
  close,
}: {
  today: string;
  editor: ProfileEditorInstance | null;
  edit: (section: ProfileEditSection | "water") => void;
  close: (id: number) => void;
}) {
  const profile = useProfile(),
    food = useFoodLog(),
    water = useWaterLog(),
    goal = useWaterGoal(),
    exercise = useExercises();
  const { colors } = useTheme();
  if (profile.state.kind !== "ready") return null;
  const answers = profile.state.document.answers;
  const activity = interpretDayActivity({
    selectedDay: today,
    food: food.state,
    water: water.state,
    goal: goal.state,
    exercise: exercise.state,
  });
  const targets = {
    calories: calorieState(answers).target,
    ...macroTargets(answers),
  };
  const summary = activity.food.kind === "ready" ? activity.food.summary : null;
  function targetRow(
    label: string,
    field: string,
    consumed: number | null,
    target: number | null,
    unit: string,
    color: string,
  ) {
    const percentage =
      consumed !== null && target !== null && target > 0
        ? Math.min(100, (consumed / target) * 100)
        : null;
    return (
      <View
        key={field}
        testID={`profile-goal-${field}`}
        style={{ gap: spacing.xs }}
      >
        <AppText variant="label" style={{ color }}>
          {label}
        </AppText>
        <AppText selectable>
          {consumed === null
            ? "Unavailable"
            : consumed.toLocaleString(undefined, {
                maximumFractionDigits: 1,
              })}{" "}
          / {target === null ? "Not set" : target.toLocaleString()} {unit}
        </AppText>
        {percentage !== null && (
          <View
            style={{
              height: 6,
              backgroundColor: colors.muted,
              borderRadius: 3,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                width: `${percentage}%`,
                height: "100%",
                backgroundColor: color,
              }}
            />
          </View>
        )}
        {consumed !== null && target !== null && consumed > target && (
          <AppText variant="caption" muted>
            {(consumed - target).toLocaleString(undefined, {
              maximumFractionDigits: 1,
            })}{" "}
            {unit} over goal
          </AppText>
        )}
      </View>
    );
  }
  return (
    <View style={{ gap: spacing.layout }}>
      <Panel>
        <AppText variant="heading" accessibilityRole="header">
          Today & targets
        </AppText>
        <AppText variant="caption" muted>
          Today · {today}
        </AppText>
        {food.state.kind !== "ready" && (
          <SourceStatus
            name="food log"
            kind={food.state.kind}
            retry={food.retryLoad}
          />
        )}
        {targetRow(
          "Calories",
          "calories",
          summary?.calories ?? null,
          targets.calories,
          "kcal",
          colors.primary,
        )}
        {(["carbs", "protein", "fat"] as const).map((field) =>
          targetRow(
            field[0].toUpperCase() + field.slice(1),
            field,
            summary?.[field] ?? null,
            targets[field],
            "g",
            colors[field],
          ),
        )}
        <FoodButton
          label="Edit nutrition goals"
          onPress={() => edit("calories")}
        />
        {editor?.section === "calories" && (
          <ProfileEditor
            key={editor.id}
            section={editor.section}
            initial={answers}
            close={() => close(editor.id)}
          />
        )}
      </Panel>
      <Panel>
        <AppText variant="heading" accessibilityRole="header">
          Water today
        </AppText>
        {water.state.kind !== "ready" && (
          <SourceStatus
            name="water log"
            kind={water.state.kind}
            retry={water.retryLoad}
          />
        )}
        {targetRow(
          "Water",
          "water",
          activity.water.total.kind === "ready"
            ? activity.water.total.ml
            : null,
          activity.water.goal.kind === "ready" ? activity.water.goal.ml : null,
          "ml",
          colors.primary,
        )}
        <AppText variant="caption" muted>
          Includes water and Drinks logged today.
        </AppText>
        {goal.state.kind !== "ready" ? (
          <SourceStatus
            name="water goal"
            kind={goal.state.kind}
            retry={goal.retryLoad}
          />
        ) : editor?.section === "water" ? (
          <WaterGoalEditor
            key={editor.id}
            initial={goal.state.document.dailyMl}
            close={() => close(editor.id)}
          />
        ) : (
          <FoodButton label="Edit water goal" onPress={() => edit("water")} />
        )}
      </Panel>
      <Panel>
        <AppText variant="heading" accessibilityRole="header">
          Personal details
        </AppText>
        {(
          [
            ["name", "Name", answers.name.trim() || "Not set"],
            ["age", "Age", `${answers.age} years`],
            [
              "body",
              "Body",
              `${answers.height ? `${answers.height} cm` : "Height not set"} · ${answers.weight ? `${answers.weight} kg` : "Weight not set"}`,
            ],
            [
              "goal",
              "Goal",
              goals.find((value) => value.value === answers.goal)?.label ||
                "Not set",
            ],
            [
              "activity",
              "Activity",
              activities.find((value) => value.value === answers.activity)
                ?.label || "Not set",
            ],
          ] as const
        ).map(([section, label, value]) => (
          <View key={section} style={{ gap: spacing.sm }}>
            <View
              style={{
                flexDirection: "row",
                gap: spacing.layout,
                alignItems: "center",
              }}
            >
              <View style={{ flex: 1, gap: spacing.xs }}>
                <AppText variant="caption" muted>
                  {label}
                </AppText>
                <AppText>{value}</AppText>
              </View>
              <FoodButton
                label={`Edit ${section}`}
                onPress={() => edit(section)}
              />
            </View>
            {editor?.section === section && (
              <ProfileEditor
                key={editor.id}
                section={editor.section}
                initial={answers}
                close={() => close(editor.id)}
              />
            )}
          </View>
        ))}
      </Panel>
    </View>
  );
}
