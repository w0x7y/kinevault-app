import { Link } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { AppText } from "../components/ui";
import { calorieState } from "../profile/calories";
import { macroInputs } from "../profile/answers";
import { macroTargets } from "../profile/macros";
import { fonts, spacing } from "../theme/tokens";
import { useTheme } from "../theme/provider";
import { Button, ErrorText, Field } from "./controls";
import type { QuestionProps } from "./types";

export function CaloriesQuestion({ answers, update, errors, disabled }: QuestionProps) {
  const { colors } = useTheme();
  const [showMath, setShowMath] = useState(false);
  const mode = calorieState(answers);
  const { estimate, target, source } = mode;
  const teen = mode.kind === "teen";
  const macros = macroTargets(answers);
  const customMacros = macroInputs.some(({ field }) => answers[field].trim());
  const macroCalories =
    macros.carbs !== null && macros.protein !== null && macros.fat !== null
      ? macros.carbs * 4 + macros.protein * 4 + macros.fat * 9
      : null;
  return (
    <View style={{ gap: spacing.layout }}>
      <View style={{ gap: 4 }}>
        <AppText
          style={{
            fontSize: 48,
            lineHeight: 58,
            fontFamily: fonts.semibold,
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
        label={estimate ? "Adjust target (optional, kcal)" : "Daily target (optional, kcal)"}
        value={answers.customCalories}
        onChangeText={(customCalories) => update({ kind: "fields", patch: { customCalories } })}
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
          icon="calculator"
          secondary
          onPress={() => update({ kind: "use-estimate" })}
          disabled={disabled}
        />
      )}
      <View style={{ gap: spacing.layout }}>
        <View style={{ gap: 8 }}>
          <AppText variant="label">Daily macros</AppText>
          <AppText variant="caption" muted>
            The app starts with 50% carbs, 25% protein, and 25% fat. Edit any target in grams, or
            leave it blank to follow your calorie target.
          </AppText>
        </View>
        {macroInputs.map(({ field, macro, label }) => (
          <Field
            key={field}
            label={`${label} target (g)`}
            value={answers[field]}
            onChangeText={(grams) => update({ kind: "fields", patch: { [field]: grams } })}
            placeholder={macros[macro] === null ? "Set a target" : String(macros[macro])}
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={4}
            editable={!disabled}
            error={errors[field]}
          />
        ))}
        {customMacros && (
          <Button
            label="Reset macro targets"
            icon="rotate-left"
            secondary
            onPress={() =>
              update({
                kind: "fields",
                patch: { customCarbs: "", customProtein: "", customFat: "" },
              })
            }
            disabled={disabled}
          />
        )}
        {customMacros && macroCalories !== null && (
          <AppText variant="caption" muted>
            Macro targets total {macroCalories.toLocaleString("en-US")} kcal.
            {target !== null
              ? ` Your calorie target stays at ${target.toLocaleString("en-US")} kcal.`
              : ""}
          </AppText>
        )}
      </View>
      {estimate && (
        <View style={{ gap: spacing.layout }}>
          <Button
            label={showMath ? "Hide calculation" : "How was this calculated?"}
            icon="calculator"
            secondary
            onPress={() => setShowMath(!showMath)}
          />
          {showMath && (
            <View style={{ gap: 8 }}>
              <AppText muted>
                Resting energy: {Math.round(estimate.resting).toLocaleString("en-US")} kcal
              </AppText>
              <AppText muted>
                With your activity: {estimate.maintenance.toLocaleString("en-US")} kcal
              </AppText>
              <AppText muted>
                Goal adjustment: {estimate.adjustment > 0 ? "+" : ""}
                {estimate.adjustment} kcal
              </AppText>
              <AppText variant="caption" muted>
                Mifflin–St Jeor × activity. Rounded to 10 kcal. Loss and gain use a 250 kcal
                adjustment as an app default.
              </AppText>
              <Link
                href="https://pubmed.ncbi.nlm.nih.gov/2305711/"
                style={{
                  color: colors.primary,
                  fontFamily: fonts.regular,
                  minHeight: 48,
                  paddingVertical: spacing.layout,
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
