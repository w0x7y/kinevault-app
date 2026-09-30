import { Link } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { AppText } from "../components/ui";
import { calorieState } from "../profile/calories";
import { useTheme } from "../theme/provider";
import { Button, ErrorText, Field } from "./controls";
import type { QuestionProps } from "./types";

export function CaloriesQuestion({
  answers,
  update,
  errors,
  disabled,
}: QuestionProps) {
  const { colors } = useTheme();
  const [showMath, setShowMath] = useState(false);
  const mode = calorieState(answers);
  const { estimate, target, source } = mode;
  const teen = mode.kind === "teen";
  return (
    <View style={{ gap: 24 }}>
      <View style={{ gap: 4 }}>
        <AppText
          style={{
            fontSize: 48,
            lineHeight: 58,
            fontFamily: "Geist_600SemiBold",
            color: colors.primary,
          }}
        >
          {target === null ? "Your call" : `${target.toLocaleString("en-US")}`}
        </AppText>
        <AppText muted>
          {target === null
            ? teen
              ? "Leave this blank, or use a target agreed with a health professional."
              : "Add a target below, or leave it for later."
            : "kcal per day"}
        </AppText>
        {target !== null && (
          <AppText variant="caption" muted>
            {source === "custom" ? "Your custom target" : "Estimated target"}
          </AppText>
        )}
      </View>
      <Field
        label={
          estimate
            ? "Adjust target (optional, kcal)"
            : "Daily target (optional, kcal)"
        }
        value={answers.customCalories}
        onChangeText={(customCalories) =>
          update({ kind: "fields", patch: { customCalories } })
        }
        placeholder={estimate ? String(estimate.target) : "Enter your target"}
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={5}
        editable={!disabled}
        error={errors.customCalories}
      />
      {estimate && source === "custom" && (
        <Button
          label="Use the estimate"
          secondary
          onPress={() => update({ kind: "use-estimate" })}
          disabled={disabled}
        />
      )}
      {estimate && (
        <View style={{ gap: 12 }}>
          <Button
            label={showMath ? "Hide calculation" : "How was this calculated?"}
            secondary
            onPress={() => setShowMath(!showMath)}
          />
          {showMath && (
            <View style={{ gap: 8 }}>
              <AppText muted>
                Resting energy:{" "}
                {Math.round(estimate.resting).toLocaleString("en-US")} kcal
              </AppText>
              <AppText muted>
                With your activity:{" "}
                {estimate.maintenance.toLocaleString("en-US")} kcal
              </AppText>
              <AppText muted>
                Goal adjustment: {estimate.adjustment > 0 ? "+" : ""}
                {estimate.adjustment} kcal
              </AppText>
              <AppText variant="caption" muted>
                Mifflin–St Jeor × activity. Rounded to 10 kcal. Loss and gain
                use a 250 kcal adjustment as an app default.
              </AppText>
              <Link
                href="https://pubmed.ncbi.nlm.nih.gov/2305711/"
                style={{
                  color: colors.primary,
                  minHeight: 48,
                  paddingVertical: 12,
                }}
              >
                Read about the formula
              </Link>
            </View>
          )}
          <AppText variant="caption" muted>
            This is a rough estimate, not medical advice. Your needs can vary.
          </AppText>
        </View>
      )}
      {!estimate && mode.kind === "estimate" && (
        <ErrorText message="An estimate needs your goal, body details, and activity. Go back to add them, or skip the estimate." />
      )}
    </View>
  );
}
