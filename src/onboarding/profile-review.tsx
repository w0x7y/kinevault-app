import { calorieState } from "../profile/calories";
import { View } from "react-native";
import { AppText } from "../components/ui";
import {
  activities,
  goals,
  type Answers,
  type EditableStep,
} from "../profile/answers";
import { useTheme } from "../theme/provider";
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
  const rows: { label: string; value: string; step: EditableStep }[] = [
    { label: "Name", value: answers.name.trim() || "Not added", step: "name" },
    {
      label: "Goal",
      value:
        goals.find(({ value }) => value === answers.goal)?.label || "Not set",
      step: "goal",
    },
    {
      label: "Body details",
      value:
        [
          answers.age && `${answers.age} years`,
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
      value:
        activities.find(({ value }) => value === answers.activity)?.label ||
        "Not set",
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
  ];
  const { colors } = useTheme();
  return (
    <View>
      {rows.map(({ label, value, step }, index) => (
        <View
          key={label}
          style={{
            paddingVertical: 16,
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
              gap: 12,
            }}
          >
            <View style={{ flex: 1, gap: 4 }}>
              <AppText variant="label">{label}</AppText>
              <AppText muted>{value}</AppText>
            </View>
            {edit && (
              <Button
                label={`Edit ${label.toLowerCase()}`}
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
