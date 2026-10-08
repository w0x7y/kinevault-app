import { calorieState } from "../profile/calories";
import { macroTargets } from "../profile/macros";
import { View } from "react-native";
import { AppText } from "../components/ui";
import { activities, goals, type Answers, type EditableStep } from "../profile/answers";
import { useTheme } from "../theme/provider";
import { spacing } from "../theme/tokens";
import { Button } from "./controls";

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
    <View>
      {rows.map(({ label, value, step }, index) => (
        <View
          key={label}
          style={{
            paddingVertical: spacing.layout,
            borderBottomWidth: index === rows.length - 1 ? 0 : 1,
            borderColor: colors.border,
            gap: 8,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              gap: spacing.layout,
            }}
          >
            <View style={{ flex: 1, gap: 4 }}>
              <AppText variant="label">{label}</AppText>
              <AppText muted>{value}</AppText>
            </View>
            {edit && (
              <Button
                label={`Edit ${label.toLowerCase()}`}
                icon="pen"
                secondary
                onPress={() => edit(step)}
                disabled={disabled}
              />
            )}
          </View>
        </View>
      ))}
    </View>
  );
}
