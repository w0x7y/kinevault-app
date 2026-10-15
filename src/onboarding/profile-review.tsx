import { calorieState } from "../profile/calories";
import { macroTargets } from "../profile/macros";
import { Pressable, View } from "react-native";
import { Icon } from "../components/icon";
import { AppText } from "../components/ui";
import { activities, goals, type Answers, type EditableStep } from "../profile/answers";
import { useTheme } from "../theme/provider";
import { radius, spacing } from "../theme/tokens";

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
  const rows: { label: string; value: string; step: EditableStep }[] = [
    { label: "Name", value: answers.name.trim() || "Not added", step: "name" },
    {
      label: "Goal",
      value: goals.find(({ value }) => value === answers.goal)?.label || "Not set",
      step: "goal",
    },
    {
      label: "Age",
      value: answers.age ? `${answers.age} years` : "Not added",
      step: "age",
    },
    {
      label: "Body details",
      value:
        [
          answers.height && `${answers.height} cm`,
          answers.weight && `${answers.weight} kg`,
          answers.sex && mode.kind === "estimate" && `${answers.sex} formula`,
        ]
          .filter(Boolean)
          .join(" · ") || "Not added",
      step: "body",
    },
    {
      label: "Activity",
      value: activities.find(({ value }) => value === answers.activity)?.label || "Not set",
      step: "activity",
    },
    {
      label: "Daily calories",
      value:
        target === null
          ? "Not set"
          : `${target.toLocaleString("en-US")} kcal · ${source === "custom" ? "custom" : "estimated"}`,
      step: "calories",
    },
    {
      label: "Daily macros",
      value: [
        `Carbs ${macros.carbs === null ? "not set" : `${macros.carbs} g`}`,
        `Protein ${macros.protein === null ? "not set" : `${macros.protein} g`}`,
        `Fat ${macros.fat === null ? "not set" : `${macros.fat} g`}`,
      ].join(" · "),
      step: "calories",
    },
  ];
  const { colors } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      {rows.map(({ label, value, step }) => {
        const content = (
          <>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="label">{label}</AppText>
              <AppText muted>{value}</AppText>
            </View>
            {edit && <Icon name="chevron-right" size={14} color={colors.mutedForeground} />}
          </>
        );
        return edit ? (
          <Pressable
            key={label}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${label.toLowerCase()}`}
            accessibilityHint={value}
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={() => edit(step)}
            style={({ pressed }) => ({
              ...rowStyle,
              backgroundColor: pressed ? colors.accent : colors.card,
              opacity: disabled ? 0.55 : 1,
            })}
          >
            {content}
          </Pressable>
        ) : (
          <View key={label} style={{ ...rowStyle, backgroundColor: colors.card }}>
            {content}
          </View>
        );
      })}
    </View>
  );
}

const rowStyle = {
  minHeight: 56,
  padding: spacing.layout,
  borderRadius: radius.control,
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.layout,
} as const;
