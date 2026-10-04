import { useState } from "react";
import { Pressable, View } from "react-native";
import { Icon } from "../components/icon";
import { FoodButton } from "../food/food-button";
import { useFoodLog } from "../food/log-provider";
import { useWaterLog } from "../water/provider";
import { useWaterGoal } from "../water/goal-provider";
import { WaterGoalEditor } from "./water-goal-editor";
import { useExercises } from "../exercise/provider";
import { summarizeDay } from "../daily/model";
import { interpretDayActivity } from "../daily/activity";
import { useTheme } from "../theme/provider";
import { activities, goals } from "./answers";
import { calorieState } from "./calories";
import { macroTargets } from "./macros";
import { useProfile } from "./provider";
import { ProfileEditor } from "./profile-editor";
import type { ProfileEditSection } from "./section-editing";
import { ProfileDialog, SourceStatus } from "./profile-controls";
import {
  JournalAction,
  JournalHeading,
  JournalPanel,
  JournalText,
} from "./journal-ui";
export type ProfileEditorInstance = {
  id: number;
  section: ProfileEditSection | "water";
};
const number = (v: number) =>
  v.toLocaleString(undefined, { maximumFractionDigits: 1 });
function ProgressBar({
  consumed,
  target,
  color,
}: {
  consumed: number | null;
  target: number | null;
  color: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        height: 5,
        backgroundColor: colors.secondary,
        borderRadius: 3,
        overflow: "hidden",
        marginTop: 8,
      }}
    >
      <View
        style={{
          height: 5,
          borderRadius: 3,
          backgroundColor: color,
          width: `${consumed !== null && target !== null && target > 0 ? Math.min(100, (consumed / target) * 100) : 0}%`,
        }}
      />
    </View>
  );
}
export function TodayNutrition({
  today,
  onPress,
}: {
  today: string;
  onPress: () => void;
}) {
  const profile = useProfile(),
    food = useFoodLog();
  const { colors } = useTheme();
  const calories =
    food.state.kind === "ready"
      ? summarizeDay({
          foods: food.state.document.days[today] ?? [],
          workout: null,
        }).calories
      : null;
  const target =
    profile.state.kind === "ready"
      ? calorieState(profile.state.document.answers).target
      : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Today's nutrition"
      onPress={onPress}
      style={{
        padding: 12,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        borderRadius: 14,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <View>
        <JournalText size={11}>Today’s nutrition</JournalText>
        <JournalText size={12} style={{ marginTop: 3 }}>
          {calories === null ? "Unavailable" : number(calories)} /{" "}
          {target === null ? "Not set" : number(target)} kcal
        </JournalText>
      </View>
      <Icon name="chevron-right" size={12} color={colors.primary} />
    </Pressable>
  );
}
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
  const [choosing, setChoosing] = useState(false);
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
  const waterMl =
    activity.water.total.kind === "ready" ? activity.water.total.ml : null;
  const waterTarget =
    activity.water.goal.kind === "ready" ? activity.water.goal.ml : null;
  const rows = [
    [
      "Weight goal",
      goals.find((v) => v.value === answers.goal)?.label || "Not set",
    ],
    ["Current weight", answers.weight ? `${answers.weight} kg` : "Not set"],
    ["Height", answers.height ? `${answers.height} cm` : "Not set"],
    ["Age", `${answers.age} years`],
    [
      "Activity",
      activities.find((v) => v.value === answers.activity)?.label || "Not set",
    ],
    [
      "Calorie target",
      targets.calories === null
        ? "Not set"
        : `${number(targets.calories)} kcal`,
    ],
  ];
  return (
    <View style={{ gap: 12 }}>
      <JournalPanel accessibilityLabel={`Today & targets · ${today}`}>
        <JournalHeading title="Today & targets">
          <JournalAction
            label="Edit"
            icon="pen"
            accessibilityLabel="Edit nutrition goals"
            onPress={() => edit("calories")}
          />
        </JournalHeading>
        {food.state.kind !== "ready" && (
          <SourceStatus
            name="food log"
            kind={food.state.kind}
            retry={food.retryLoad}
          />
        )}
        <View
          testID="profile-goal-calories"
          accessibilityLabel={`${summary?.calories ?? "Unavailable"} / ${targets.calories === null ? "Not set" : number(targets.calories)} kcal`}
        >
          <JournalText size={23} variant="heading">
            {summary ? number(summary.calories) : "Unavailable"}
            <JournalText size={10} muted>
              {" "}
              /{" "}
              {targets.calories === null
                ? "Not set"
                : number(targets.calories)}{" "}
              kcal
            </JournalText>
          </JournalText>
          <ProgressBar
            consumed={summary?.calories ?? null}
            target={targets.calories}
            color={colors.primary}
          />
        </View>
        <View
          style={{
            flexDirection: "row",
            gap: 12,
            marginTop: 16,
            marginBottom: 14,
          }}
        >
          {(["carbs", "protein", "fat"] as const).map((field) => (
            <View
              key={field}
              testID={`profile-goal-${field}`}
              accessibilityLabel={`${summary?.[field] ?? "Unavailable"} / ${targets[field] === null ? "Not set" : number(targets[field])} g`}
              style={{ flex: 1 }}
            >
              <JournalText
                size={11}
                variant="label"
                style={{ color: colors[field] }}
              >
                {field[0].toUpperCase() + field.slice(1)}
              </JournalText>
              <JournalText size={16} variant="heading" style={{ marginTop: 3 }}>
                {summary ? number(summary[field]) : "—"} g
              </JournalText>
              <JournalText size={10} muted>
                of{" "}
                {targets[field] === null
                  ? "not set"
                  : `${number(targets[field])} g`}
              </JournalText>
              <ProgressBar
                consumed={summary?.[field] ?? null}
                target={targets[field]}
                color={colors[field]}
              />
            </View>
          ))}
        </View>
        <View
          testID="profile-goal-water"
          accessibilityLabel={`${waterMl === null ? "Unavailable" : number(waterMl)} / ${waterTarget === null ? "Not set" : number(waterTarget)} ml`}
          style={{
            borderTopWidth: 1,
            borderColor: colors.border,
            paddingTop: 12,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Edit water goal"
            onPress={() => edit("water")}
            style={{
              minHeight: 44,
              marginVertical: -13,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <Icon name="droplet" size={14} color={colors.primary} />
              <JournalText size={11}>Water</JournalText>
            </View>
            <JournalText size={10}>
              {waterMl === null ? "—" : number(waterMl / 1000)}
              <JournalText size={10} muted>
                {" "}
                /{" "}
                {waterTarget === null
                  ? "Not set"
                  : number(waterTarget / 1000)}{" "}
                L
              </JournalText>
            </JournalText>
          </Pressable>
        </View>
        {water.state.kind !== "ready" && (
          <SourceStatus
            name="water log"
            kind={water.state.kind}
            retry={water.retryLoad}
          />
        )}
        {goal.state.kind !== "ready" && (
          <SourceStatus
            name="water goal"
            kind={goal.state.kind}
            retry={goal.retryLoad}
          />
        )}
        {editor?.section === "calories" && (
          <ProfileEditor
            key={editor.id}
            section={editor.section}
            initial={answers}
            close={() => close(editor.id)}
          />
        )}
        {editor?.section === "water" && goal.state.kind === "ready" && (
          <WaterGoalEditor
            key={editor.id}
            initial={goal.state.document.dailyMl}
            close={() => close(editor.id)}
          />
        )}
      </JournalPanel>
      <JournalPanel>
        <JournalHeading title="Details & goals">
          <JournalAction
            label="Edit"
            icon="pen"
            accessibilityLabel="Edit details and goals"
            onPress={() => setChoosing(true)}
          />
        </JournalHeading>
        {rows.map(([label, value], i) => (
          <View
            key={label}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              paddingVertical: 9,
              borderBottomWidth: i === rows.length - 1 ? 0 : 1,
              borderColor: colors.border,
            }}
          >
            <JournalText size={11} muted>
              {label}
            </JournalText>
            <JournalText
              size={11}
              style={{ textAlign: "right", flexShrink: 1 }}
            >
              {value}
            </JournalText>
          </View>
        ))}
        {editor &&
          editor.section !== "calories" &&
          editor.section !== "water" && (
            <ProfileEditor
              key={editor.id}
              section={editor.section}
              initial={answers}
              close={() => close(editor.id)}
            />
          )}
      </JournalPanel>
      {choosing && (
        <ProfileDialog
          title="Edit details & goals"
          dismiss={() => setChoosing(false)}
        >
          {(
            ["name", "age", "body", "goal", "activity", "calories"] as const
          ).map((section) => (
            <FoodButton
              key={section}
              label={`Edit ${section}`}
              onPress={() => {
                setChoosing(false);
                edit(section);
              }}
            />
          ))}
        </ProfileDialog>
      )}
    </View>
  );
}
