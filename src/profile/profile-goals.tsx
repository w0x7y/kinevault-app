import { AppButton } from "../components/button";
import { useRef, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Icon, type IconName } from "../components/icon";
import { IconWell } from "../components/icon-well";
import { Tappable } from "../components/tappable";
import { ProgressFill } from "../components/motion";
import { AppText, Panel } from "../components/ui";
import { cardShadow, fonts, radius, spacing } from "../theme/tokens";
import { WaterGoalEditor } from "./water-goal-editor";
import { useDayActivity } from "../daily/use-day";
import { unsetTarget } from "../daily/activity";
import { useTheme } from "../theme/provider";
import { activities, goals } from "./answers";
import { useProfile } from "./provider";
import { ProfileEditor } from "./profile-editor";
import type { ProfileEditSection } from "./section-editing";
import { SourceStatus } from "./profile-controls";
import { ModalSheet } from "../components/modal-sheet";
import { JournalFigure, JournalHeading } from "./journal-ui";
export type ProfileEditorInstance = {
  id: number;
  section: ProfileEditSection | "water";
};
const number = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 1 });
function ProgressBar({ fraction, color }: { fraction: number; color: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        height: 6,
        backgroundColor: colors.muted,
        borderRadius: 3,
        overflow: "hidden",
      }}
    >
      <ProgressFill fraction={fraction} color={color} style={{ borderRadius: 3 }} />
    </View>
  );
}
/** A goal row: icon well, name, value / target and a small progress bar. */
function GoalRow({
  icon,
  name,
  value,
  target,
  bar,
  trailing,
}: {
  icon: ReactNode;
  name: string;
  value: string;
  target: string;
  bar: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 52 }}>
      <IconWell>{icon}</IconWell>
      <View style={{ flex: 1, gap: 6 }}>
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            alignItems: "baseline",
            columnGap: spacing.sm,
          }}
        >
          <AppText variant="label" style={{ flexGrow: 1, flexShrink: 0 }}>
            {name}
          </AppText>
          <AppText variant="label" numeric style={{ fontSize: 14 }}>
            {value}
            <AppText variant="caption" muted>
              {` / ${target}`}
            </AppText>
          </AppText>
        </View>
        {bar}
      </View>
      {trailing}
    </View>
  );
}
export function TodayNutrition({ today, onPress }: { today: string; onPress: () => void }) {
  const activity = useDayActivity({ date: today });
  const { colors } = useTheme();
  const calories = activity.nutrition?.calories;
  const target = calories?.target ?? null;
  return (
    <Tappable
      label="Today's nutrition"
      onPress={onPress}
      ring="outline"
      style={({ pressed }) => ({
        padding: spacing.card,
        paddingRight: spacing.card - 2,
        borderRadius: radius.panel,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
        backgroundColor: pressed ? colors.muted : colors.card,
        boxShadow: cardShadow(colors),
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
      })}
    >
      <IconWell icon="utensils" color={colors.primary} />
      <View style={{ flex: 1, gap: 6 }}>
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            alignItems: "baseline",
            columnGap: spacing.sm,
          }}
        >
          <AppText variant="label" style={{ flexGrow: 1, flexShrink: 0 }}>
            Today’s nutrition
          </AppText>
          <AppText variant="label" numeric style={{ fontSize: 14 }}>
            {calories ? number(calories.eaten) : "Unavailable"}
            <AppText variant="caption" muted>
              {` / ${target === null ? unsetTarget.shown : number(target)} kcal`}
            </AppText>
          </AppText>
        </View>
        <ProgressBar fraction={calories?.fraction ?? 0} color={colors.primary} />
      </View>
      <Icon name="chevron-right" size={16} color={colors.mutedForeground} />
    </Tappable>
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
    activity = useDayActivity({ date: today });
  const { food, water, waterGoal } = activity.sources;
  const { colors } = useTheme();
  const [choosing, setChoosing] = useState(false);
  // The chosen editor opens once the chooser has gone, so it can take focus.
  const chosen = useRef<(typeof chooserSections)[number] | null>(null);
  const { targets } = activity;
  if (profile.state.kind !== "ready" || targets.kind !== "ready") return null;
  const answers = profile.state.document.answers;
  const { nutrition } = activity;
  const target = (value: number | null, unit: string) =>
    value === null ? unsetTarget.shown : `${number(value)} ${unit}`;
  const spokenTarget = (value: number | null) =>
    value === null ? unsetTarget.spoken : number(value);
  const waterMl = activity.water.total.kind === "ready" ? activity.water.total.ml : null;
  const waterTarget = activity.water.goal.kind === "ready" ? activity.water.goal.ml : null;
  const rows = [
    ["Weight goal", goals.find((v) => v.value === answers.goal)?.label || "Not set"],
    ["Current weight", answers.weight ? `${answers.weight} kg` : "Not set"],
    ["Height", answers.height ? `${answers.height} cm` : "Not set"],
    ["Age", `${answers.age} years`],
    ["Activity", activities.find((v) => v.value === answers.activity)?.label || "Not set"],
    ["Calorie target", targets.calories === null ? "Not set" : `${number(targets.calories)} kcal`],
  ];
  const detail = (section: (typeof chooserSections)[number]) =>
    ({
      name: answers.name.trim() || "Not set",
      age: answers.age ? `${answers.age} years` : "Not set",
      body:
        [answers.height && `${answers.height} cm`, answers.weight && `${answers.weight} kg`]
          .filter(Boolean)
          .join(" · ") || "Not set",
      goal: goals.find((v) => v.value === answers.goal)?.label || "Not set",
      activity: activities.find((v) => v.value === answers.activity)?.label || "Not set",
      calories: targets.calories === null ? "Not set" : `${number(targets.calories)} kcal`,
    })[section];
  return (
    <View style={{ gap: spacing.layout }}>
      <Panel accessibilityLabel={`Today & targets · ${today}`}>
        <JournalHeading title="Today & targets">
          <AppButton
            size="small"
            label="Edit"
            icon="pen"
            accessibilityLabel="Edit nutrition goals"
            onPress={() => edit("calories")}
          />
        </JournalHeading>
        {food.kind !== "ready" && (
          <SourceStatus name="food log" kind={food.kind} retry={food.retry} />
        )}
        <View
          testID="profile-goal-calories"
          accessibilityLabel={`${nutrition ? number(nutrition.calories.eaten) : "Unavailable"} / ${spokenTarget(targets.calories)} kcal`}
          style={{ gap: spacing.sm, marginBottom: spacing.xs }}
        >
          <JournalFigure
            value={nutrition ? number(nutrition.calories.eaten) : "Unavailable"}
            unit={`/ ${target(targets.calories, "kcal")}`}
          />
          <ProgressBar fraction={nutrition?.calories.fraction ?? 0} color={colors.primary} />
        </View>
        {(["carbs", "protein", "fat"] as const).map((field) => (
          <View
            key={field}
            testID={`profile-goal-${field}`}
            accessibilityLabel={`${nutrition ? number(nutrition[field].eaten) : "Unavailable"} / ${spokenTarget(targets[field])} g`}
          >
            <GoalRow
              icon={
                <View
                  style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors[field] }}
                />
              }
              name={field[0].toUpperCase() + field.slice(1)}
              value={nutrition ? number(nutrition[field].eaten) : "—"}
              target={target(targets[field], "g")}
              bar={
                <ProgressBar fraction={nutrition?.[field].fraction ?? 0} color={colors[field]} />
              }
            />
          </View>
        ))}
        <View
          testID="profile-goal-water"
          accessibilityLabel={`${waterMl === null ? "Unavailable" : number(waterMl)} / ${waterTarget === null ? "Unavailable" : number(waterTarget)} ml`}
          style={{
            borderTopWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
            paddingTop: spacing.sm,
          }}
        >
          <Tappable
            label="Edit water goal"
            onPress={() => edit("water")}
            feedback="fill"
            style={{
              marginHorizontal: -spacing.sm,
              paddingHorizontal: spacing.sm - 2,
              borderRadius: radius.control,
            }}
          >
            <GoalRow
              icon={<Icon name="droplet" size={18} color={colors.water} />}
              name="Water"
              value={waterMl === null ? "—" : number(waterMl)}
              target={target(waterTarget, "ml")}
              bar={<ProgressBar fraction={activity.water.progress ?? 0} color={colors.water} />}
              trailing={<Icon name="chevron-right" size={16} color={colors.mutedForeground} />}
            />
          </Tappable>
        </View>
        {water.kind !== "ready" && (
          <SourceStatus name="water log" kind={water.kind} retry={water.retry} />
        )}
        {waterGoal.kind !== "ready" && (
          <SourceStatus name="water goal" kind={waterGoal.kind} retry={waterGoal.retry} />
        )}
        {editor?.section === "calories" && (
          <ProfileEditor key={editor.id} section={editor.section} close={() => close(editor.id)} />
        )}
        {editor?.section === "water" && waterGoal.kind === "ready" && (
          <WaterGoalEditor key={editor.id} close={() => close(editor.id)} />
        )}
      </Panel>
      <Panel>
        <JournalHeading title="Details & goals">
          <AppButton
            size="small"
            label="Edit"
            icon="pen"
            accessibilityLabel="Edit details and goals"
            onPress={() => setChoosing(true)}
          />
        </JournalHeading>
        <View>
          {rows.map(([label, value], index) => (
            <View
              key={label}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: spacing.md,
                minHeight: 46,
                borderTopWidth: index ? StyleSheet.hairlineWidth : 0,
                borderColor: colors.border,
              }}
            >
              <AppText variant="label" muted style={{ fontFamily: fonts.medium }}>
                {label}
              </AppText>
              <AppText variant="label" style={{ textAlign: "right", flexShrink: 1 }}>
                {value}
              </AppText>
            </View>
          ))}
        </View>
        {editor && editor.section !== "calories" && editor.section !== "water" && (
          <ProfileEditor key={editor.id} section={editor.section} close={() => close(editor.id)} />
        )}
      </Panel>
      <ModalSheet
        open={choosing}
        title="Edit details & goals"
        onDismiss={() => setChoosing(false)}
        onClosed={() => {
          const section = chosen.current;
          chosen.current = null;
          if (section) edit(section);
        }}
      >
        <View
          style={{
            borderRadius: radius.panel - 4,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
            backgroundColor: colors.card,
            overflow: "hidden",
          }}
        >
          {chooserSections.map((section, index) => (
            <ChooserRow
              key={section}
              section={section}
              detail={detail(section)}
              first={index === 0}
              onPress={() => {
                chosen.current = section;
                setChoosing(false);
              }}
            />
          ))}
        </View>
        <AppButton label="Cancel" onPress={() => setChoosing(false)} />
      </ModalSheet>
    </View>
  );
}
const chooserSections = ["name", "age", "body", "goal", "activity", "calories"] as const;
const chooserIcons = {
  name: "user",
  age: "calendar",
  body: "weight-scale",
  goal: "chart-line",
  activity: "shoe-prints",
  calories: "fire",
} as const satisfies Record<(typeof chooserSections)[number], IconName>;
function ChooserRow({
  section,
  detail,
  first,
  onPress,
}: {
  section: (typeof chooserSections)[number];
  detail: string;
  first: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{ borderTopWidth: first ? 0 : StyleSheet.hairlineWidth, borderColor: colors.border }}
    >
      <Tappable
        label={`Edit ${section}`}
        onPress={onPress}
        feedback="fill"
        style={{
          minHeight: 60,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm - 2,
        }}
      >
        <IconWell icon={chooserIcons[section]} color={colors.primary} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText variant="label" style={{ fontSize: 15 }}>
            {section[0].toUpperCase() + section.slice(1)}
          </AppText>
          <AppText variant="caption" muted numberOfLines={1}>
            {detail}
          </AppText>
        </View>
        <Icon name="chevron-right" size={16} color={colors.mutedForeground} />
      </Tappable>
    </View>
  );
}
