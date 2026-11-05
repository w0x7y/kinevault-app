import { useState } from "react";
import { View } from "react-native";
import { AppText } from "../components/ui";
import { calorieState } from "../profile/calories";
import { spacing } from "../theme/tokens";
import { InlineMessage } from "../components/inline-message";
import { TextField } from "../components/text-field";
import { Choice } from "./controls";
import type { QuestionProps } from "./types";
import { useUnits } from "../units/provider";
import { heightFields, heightSaved, unitName } from "../units/units";

/** Imperial height as feet and inches fields over the saved centimeter text. What was typed
 * shows for as long as it still saves the same text. */
function FeetAndInches({
  value,
  onChange,
  optional,
  error,
  disabled,
}: {
  value: string;
  onChange: (cm: string) => void;
  optional: string;
  error?: string;
  disabled?: boolean;
}) {
  const [typed, setTyped] = useState<{ feet: string; inches: string } | null>(null);
  const shown = typed && heightSaved(typed) === value ? typed : heightFields(value);
  function change(part: "feet" | "inches", text: string) {
    const next = { ...shown, [part]: text };
    setTyped(next);
    onChange(heightSaved(next));
  }
  return (
    <View style={{ flexDirection: "row", gap: spacing.md }}>
      <View style={{ flex: 1 }}>
        <TextField
          size="large"
          label={`Height (ft)${optional}`}
          accessibilityLabel={`Height, feet${optional}`}
          value={shown.feet}
          onChange={(text) => change("feet", text)}
          placeholder="e.g. 5"
          kind="integer"
          filter
          maxLength={2}
          disabled={disabled}
          error={error}
        />
      </View>
      <View style={{ flex: 1 }}>
        <TextField
          size="large"
          label="Height (in)"
          accessibilityLabel="Height, inches"
          value={shown.inches}
          onChange={(text) => change("inches", text)}
          placeholder="e.g. 9"
          kind="decimal"
          filter
          maxLength={8}
          disabled={disabled}
          invalid={Boolean(error)}
        />
      </View>
    </View>
  );
}

export function BodyQuestion({ answers, update, errors, disabled }: QuestionProps) {
  const mode = calorieState(answers);
  const estimate = mode.kind === "estimate";
  const { units } = useUnits();
  const optional = estimate ? "" : " · optional";
  const weight = (
    <TextField
      size="large"
      label={`Weight (${unitName("bodyWeight", units)})${optional}`}
      quantity="bodyWeight"
      value={answers.weight}
      onChange={(weight) => update({ kind: "fields", patch: { weight } })}
      placeholder={units === "metric" ? "e.g. 70" : "e.g. 155"}
      kind="decimal"
      filter
      maxLength={8}
      disabled={disabled}
      error={errors.weight}
    />
  );
  return (
    <View style={{ gap: spacing.layout }}>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Calorie estimate"
        style={{ gap: spacing.md }}
      >
        <Choice
          label="Use the standard estimate"
          description="I'm 18+, not pregnant or breastfeeding, and not following a prescribed nutrition plan."
          selected={mode.kind === "estimate" && answers.eligible}
          onPress={() => update({ kind: "estimate", enabled: true })}
          disabled={disabled}
          invalid={Boolean(errors.eligible)}
        />
        <Choice
          label="Skip the estimate"
          description="I'll enter a target myself, or leave it for later."
          selected={mode.kind === "manual"}
          onPress={() => update({ kind: "estimate", enabled: false })}
          disabled={disabled}
          invalid={Boolean(errors.eligible)}
        />
        {errors.eligible && <InlineMessage>{errors.eligible}</InlineMessage>}
      </View>
      {estimate && (
        <>
          <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
            <AppText variant="label">Sex used by the formula</AppText>
            <AppText variant="caption" muted>
              The formula has two coefficients. If neither fits, you can skip the estimate.
            </AppText>
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel="Sex used by the formula"
              style={{ flexDirection: "row", gap: spacing.md }}
            >
              <View style={{ flex: 1 }}>
                <Choice
                  label="Female"
                  selected={answers.sex === "female"}
                  onPress={() => update({ kind: "fields", patch: { sex: "female" } })}
                  disabled={disabled}
                  invalid={Boolean(errors.sex)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Choice
                  label="Male"
                  selected={answers.sex === "male"}
                  onPress={() => update({ kind: "fields", patch: { sex: "male" } })}
                  disabled={disabled}
                  invalid={Boolean(errors.sex)}
                />
              </View>
            </View>
            {errors.sex && <InlineMessage>{errors.sex}</InlineMessage>}
          </View>
        </>
      )}
      {units === "metric" ? (
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <TextField
              size="large"
              label={`Height (cm)${optional}`}
              value={answers.height}
              onChange={(height) => update({ kind: "fields", patch: { height } })}
              placeholder="e.g. 175"
              kind="decimal"
              filter
              maxLength={8}
              disabled={disabled}
              error={errors.height}
            />
          </View>
          <View style={{ flex: 1 }}>{weight}</View>
        </View>
      ) : (
        // Feet and inches take the row, so the weight gets its own.
        <>
          <FeetAndInches
            value={answers.height}
            onChange={(height) => update({ kind: "fields", patch: { height } })}
            optional={optional}
            error={errors.height}
            disabled={disabled}
          />
          {weight}
        </>
      )}
      <AppText variant="caption" muted>
        You can change these details anytime.
      </AppText>
    </View>
  );
}
