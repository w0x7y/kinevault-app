import { calorieState } from "../profile/calories";
import { macroTargets } from "../profile/macros";
import { StyleSheet, View } from "react-native";
import { Icon, type IconName } from "../components/icon";
import { IconWell } from "../components/icon-well";
import { Tappable } from "../components/tappable";
import { AppText, Panel } from "../components/ui";
import { choiceLabels, type Answers, type EditableStep } from "../profile/answers";
import { useTheme } from "../theme/provider";
import { spacing } from "../theme/tokens";

export function ProfileReview({
  answers,
  edit,
  disabled = false,
}: {
  answers: Answers;
  edit?: (step: EditableStep) => void;
  disabled?: boolean;
}) {
  const mode = calorieState(answers);
  const { target, source } = mode;
  const macros = macroTargets(answers);
  const rows: { label: string; value: string; step: EditableStep; icon: IconName }[] = [
    { label: "Name", value: answers.name.trim() || "Not added", step: "name", icon: "user" },
    {
      label: "Goal",
      value: choiceLabels(answers).goal ?? "Not set",
      step: "goal",
      icon: "flag",
    },
    {
      label: "Age",
      value: answers.age ? `${answers.age} years` : "Not added",
      step: "age",
      icon: "hourglass",
    },
    {
      label: "Body details",
      value:
        [
          answers.height && `${answers.height}\u00a0cm`,
          answers.weight && `${answers.weight}\u00a0kg`,
          answers.sex && mode.kind === "estimate" && `${answers.sex} formula`,
        ]
          .filter(Boolean)
          .join(" · ") || "Not added",
      step: "body",
      icon: "person",
    },
    {
      label: "Activity",
      value: choiceLabels(answers).activity ?? "Not set",
      step: "activity",
      icon: "person-running",
    },
    {
      label: "Daily calories",
      value:
        target === null
          ? "Not set"
          : `${target.toLocaleString("en-US")} kcal · ${source === "custom" ? "custom" : "estimated"}`,
      step: "calories",
      icon: "fire",
    },
    {
      label: "Daily macros",
      value: [
        `Carbs ${macros.carbs === null ? "not set" : `${macros.carbs}\u00a0g`}`,
        `Protein ${macros.protein === null ? "not set" : `${macros.protein}\u00a0g`}`,
        `Fat ${macros.fat === null ? "not set" : `${macros.fat}\u00a0g`}`,
      ].join(" · "),
      step: "calories",
      icon: "chart-pie",
    },
  ];
  const { colors } = useTheme();
  return (
    <Panel style={{ padding: 0, gap: 0, overflow: "hidden" }}>
      {rows.map(({ label, value, step, icon }, index) => {
        const content = (
          <>
            <IconWell icon={icon} color={colors.mutedForeground} />
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="caption" muted>
                {label}
              </AppText>
              <AppText variant="label" style={{ fontSize: 15, lineHeight: 21 }}>
                {value}
              </AppText>
            </View>
            {edit && <Icon name="chevron-right" size={16} color={colors.mutedForeground} />}
          </>
        );
        return (
          <View
            key={label}
            style={
              index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border }
            }
          >
            {edit ? (
              <Tappable
                label={`Edit ${label.toLowerCase()}`}
                hint={value}
                disabled={disabled}
                onPress={() => edit(step)}
                feedback="fill"
                // Paddings net of the ring's 2 pt border.
                style={[
                  styles.row,
                  { paddingVertical: spacing.md - 2, paddingHorizontal: spacing.card - 4 },
                ]}
              >
                {content}
              </Tappable>
            ) : (
              <View style={styles.row}>{content}</View>
            )}
          </View>
        );
      })}
    </Panel>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 64,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.card - 2,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
});
