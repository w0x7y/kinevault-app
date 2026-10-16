import { Link } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { AppButton } from "../components/button";
import { AppText, Overline, Panel } from "../components/ui";
import { calorieState } from "../profile/calories";
import { macroInputs } from "../profile/answers";
import { macroTargets } from "../profile/macros";
import { fonts, spacing } from "../theme/tokens";
import { useTheme } from "../theme/provider";
import { InlineMessage } from "../components/inline-message";
import { TextField } from "../components/text-field";
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
  const macroColor = { carbs: colors.carbs, protein: colors.protein, fat: colors.fat };
  const hairline = { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border };
  return (
    <View style={{ gap: spacing.lg }}>
      <View style={{ gap: spacing.md }}>
        <Panel style={{ gap: spacing.md }}>
          <View style={{ gap: 2 }}>
            <AppText variant="label" muted>
              {target === null
                ? "Daily target"
                : source === "custom"
                  ? "Your custom target"
                  : "Estimated target"}
            </AppText>
            {target === null ? (
              <>
                <AppText variant="title">Your call</AppText>
                <AppText muted>
                  {teen
                    ? "Leave this blank, or use a target agreed with a health professional."
                    : "Add a target below, or leave it for later."}
                </AppText>
              </>
            ) : (
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
                <AppText variant="hero">{target.toLocaleString("en-US")}</AppText>
                <AppText muted style={{ fontFamily: fonts.semibold }}>
                  kcal per day
                </AppText>
              </View>
            )}
          </View>
          <View style={[{ flexDirection: "row", paddingTop: spacing.md }, hairline]}>
            {macroInputs.map(({ macro, label }) => (
              <View key={macro} style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: macroColor[macro],
                    }}
                  />
                  <AppText variant="caption" muted>
                    {label}
                  </AppText>
                </View>
                <AppText variant="heading" numeric style={{ fontSize: 17 }}>
                  {macros[macro] === null ? "–" : `${macros[macro]} g`}
                </AppText>
              </View>
            ))}
          </View>
          {estimate && (
            <View style={[{ paddingTop: spacing.xs, gap: spacing.sm }, hairline]}>
              <AppButton
                label={showMath ? "Hide calculation" : "How was this calculated?"}
                icon="calculator"
                size="compact"
                expanded={showMath}
                onPress={() => setShowMath(!showMath)}
              />
              {showMath && (
                <View style={{ gap: spacing.sm }}>
                  {[
                    [
                      "Resting energy",
                      `${Math.round(estimate.resting).toLocaleString("en-US")} kcal`,
                    ],
                    ["With your activity", `${estimate.maintenance.toLocaleString("en-US")} kcal`],
                    [
                      "Goal adjustment",
                      `${estimate.adjustment > 0 ? "+" : ""}${estimate.adjustment} kcal`,
                    ],
                  ].map(([label, value]) => (
                    <View
                      key={label}
                      style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}
                    >
                      <AppText muted>{label}</AppText>
                      <AppText numeric style={{ fontFamily: fonts.bold }}>
                        {value}
                      </AppText>
                    </View>
                  ))}
                  <AppText variant="caption" muted>
                    Mifflin–St Jeor × activity. Rounded to 10 kcal. Loss and gain use a 250 kcal
                    adjustment as an app default.
                  </AppText>
                  <Link
                    href="https://pubmed.ncbi.nlm.nih.gov/2305711/"
                    style={{
                      color: colors.brand,
                      fontFamily: fonts.semibold,
                      fontSize: 14,
                      minHeight: 44,
                      paddingVertical: spacing.md,
                    }}
                  >
                    Read about the formula
                  </Link>
                </View>
              )}
            </View>
          )}
        </Panel>
        {estimate && (
          <AppText variant="caption" muted>
            This is a rough estimate, not medical advice. Your needs can vary.
          </AppText>
        )}
        {!estimate && mode.kind === "estimate" && (
          <InlineMessage>
            An estimate needs your goal, body details, and activity. Go back to add them, or skip
            the estimate.
          </InlineMessage>
        )}
      </View>
      <View style={{ gap: spacing.md }}>
        <Overline>Adjust (optional)</Overline>
        <TextField
          size="large"
          label={estimate ? "Adjust target (optional, kcal)" : "Daily target (optional, kcal)"}
          value={answers.customCalories}
          onChange={(customCalories) => update({ kind: "fields", patch: { customCalories } })}
          placeholder={estimate ? String(estimate.target) : "Enter your target"}
          kind="integer"
          filter
          maxLength={5}
          disabled={disabled}
          error={errors.customCalories}
        />
        {estimate && source === "custom" && (
          <AppButton
            label="Use the estimate"
            icon="calculator"
            onPress={() => update({ kind: "use-estimate" })}
            disabled={disabled}
          />
        )}
      </View>
      <View style={{ gap: spacing.md }}>
        <View style={{ gap: spacing.xs }}>
          <Overline>Daily macros</Overline>
          <AppText variant="caption" muted>
            Starts at 50% carbs, 25% protein and 25% fat. Enter grams to override any target, or
            leave it blank to follow your calorie target.
          </AppText>
        </View>
        {macroInputs.map(({ field, macro, label }) => (
          <TextField
            size="large"
            key={field}
            label={`${label} target (g)`}
            value={answers[field]}
            onChange={(grams) => update({ kind: "fields", patch: { [field]: grams } })}
            placeholder={macros[macro] === null ? "Set a target" : String(macros[macro])}
            kind="integer"
            filter
            maxLength={4}
            disabled={disabled}
            error={errors[field]}
          />
        ))}
        {customMacros && (
          <AppButton
            label="Reset macro targets"
            icon="rotate-left"
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
    </View>
  );
}
