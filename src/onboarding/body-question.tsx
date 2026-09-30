import { View } from "react-native";
import { AppText } from "../components/ui";
import { Choice, ErrorText, Field } from "./controls";
import type { QuestionProps } from "./types";

export function BodyQuestion({
  answers,
  update,
  errors,
  disabled,
}: QuestionProps) {
  return (
    <View style={{ gap: 24 }}>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Calorie estimate"
        style={{ gap: 8 }}
      >
        <Choice
          label="Use the standard estimate"
          description="I'm 18+, not pregnant or breastfeeding, and not following a prescribed nutrition plan."
          selected={answers.estimateEnabled && answers.eligible}
          onPress={() => update({ estimateEnabled: true, eligible: true })}
          disabled={disabled}
        />
        <Choice
          label="Skip the estimate"
          description="I'll enter a target myself, or leave it for later."
          selected={!answers.estimateEnabled}
          onPress={() =>
            update({
              estimateEnabled: false,
              eligible: false,
              age: "",
              sex: null,
            })
          }
          disabled={disabled}
        />
        {errors.eligible && <ErrorText message={errors.eligible} />}
      </View>
      {answers.estimateEnabled && (
        <>
          <Field
            label="Age (years)"
            value={answers.age}
            onChangeText={(age) => update({ age })}
            placeholder="e.g. 30"
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={3}
            editable={!disabled}
            error={errors.age}
          />
          <View style={{ gap: 8 }}>
            <AppText variant="label">Sex used by the formula</AppText>
            <AppText variant="caption" muted>
              The formula has two coefficients. If neither fits, you can skip
              the estimate.
            </AppText>
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel="Sex used by the formula"
              style={{ flexDirection: "row", gap: 12 }}
            >
              <View style={{ flex: 1 }}>
                <Choice
                  label="Female"
                  selected={answers.sex === "female"}
                  onPress={() => update({ sex: "female" })}
                  disabled={disabled}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Choice
                  label="Male"
                  selected={answers.sex === "male"}
                  onPress={() => update({ sex: "male" })}
                  disabled={disabled}
                />
              </View>
            </View>
            {errors.sex && <ErrorText message={errors.sex} />}
          </View>
        </>
      )}
      <View style={{ flexDirection: "row", gap: 16 }}>
        <View style={{ flex: 1 }}>
          <Field
            label={`Height (cm)${answers.estimateEnabled ? "" : " · optional"}`}
            value={answers.height}
            onChangeText={(height) => update({ height })}
            placeholder="e.g. 175"
            keyboardType="decimal-pad"
            inputMode="decimal"
            maxLength={8}
            editable={!disabled}
            error={errors.height}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Field
            label={`Weight (kg)${answers.estimateEnabled ? "" : " · optional"}`}
            value={answers.weight}
            onChangeText={(weight) => update({ weight })}
            placeholder="e.g. 70"
            keyboardType="decimal-pad"
            inputMode="decimal"
            maxLength={8}
            editable={!disabled}
            error={errors.weight}
          />
        </View>
      </View>
      <AppText variant="caption" muted>
        Saved on this device. Your answers stay editable.
      </AppText>
    </View>
  );
}
