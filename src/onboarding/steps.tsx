import { calorieState } from "../profile/calories";
import { View } from "react-native";
import { AppText } from "../components/ui";
import { activities, goals, type Step } from "../profile/answers";
import { spacing } from "../theme/tokens";
import { Choice, ErrorText, Field } from "./controls";
import { BodyQuestion } from "./body-question";
import { CaloriesQuestion } from "./calories-question";
import { ProfileReview } from "./profile-review";
import type { QuestionProps } from "./types";

export const stepCopy: Record<Step, { title: string; message: string }> = {
  welcome: {
    title: "Hi, I'm Kine.",
    message:
      "A place for your meals, movement, and everyday progress. Let's start with what matters to you.",
  },
  name: {
    title: "What should I call you?",
    message: "A first name or nickname is plenty.",
  },
  goal: {
    title: "What's your goal?",
    message: "You can change direction whenever you need.",
  },
  age: {
    title: "Let's check your age",
    message: "KineVault is for ages 16 and up. This helps us set up the right options for you.",
  },
  body: {
    title: "A little about you",
    message: "These details help estimate your daily calories.",
  },
  activity: {
    title: "How active are you?",
    message: "Think about a usual week, including work and workouts.",
  },
  calories: {
    title: "Your daily starting point",
    message: "Set your calorie and macro targets. You can adjust them anytime.",
  },
  review: {
    title: "Ready when you are.",
    message: "Take a quick look. You can edit this later in Settings.",
  },
};
export function Question({ step, ...props }: QuestionProps & { step: Step }) {
  const { answers, update, errors, disabled } = props;
  switch (step) {
    case "welcome":
      return null;
    case "age":
      return (
        <Field
          label="Age (years)"
          value={answers.age}
          onChangeText={(age) => update({ kind: "fields", patch: { age } })}
          placeholder="16 or older"
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={3}
          editable={!disabled}
          error={errors.age}
        />
      );
    case "name":
      return (
        <Field
          label="Your name (optional)"
          value={answers.name}
          onChangeText={(name) => update({ kind: "fields", patch: { name } })}
          placeholder="Name or nickname"
          autoComplete="given-name"
          textContentType="givenName"
          maxLength={40}
          editable={!disabled}
          returnKeyType="done"
          error={errors.name}
        />
      );
    case "goal":
      return (
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel="Weight goal"
          style={{ gap: spacing.layout }}
        >
          {goals.map(({ value, label, description }) => (
            <Choice
              key={value}
              label={label}
              description={calorieState(answers).kind === "teen" ? undefined : description}
              selected={answers.goal === value}
              onPress={() => update({ kind: "fields", patch: { goal: value } })}
              disabled={disabled}
            />
          ))}
          {errors.goal && <ErrorText message={errors.goal} />}
        </View>
      );
    case "body":
      return <BodyQuestion {...props} />;
    case "activity":
      return (
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel="Activity level"
          style={{ gap: spacing.layout }}
        >
          {activities.map(({ value, label, description }) => (
            <Choice
              key={value}
              label={label}
              description={description}
              selected={answers.activity === value}
              onPress={() => update({ kind: "fields", patch: { activity: value } })}
              disabled={disabled}
            />
          ))}
          {errors.activity && <ErrorText message={errors.activity} />}
          {calorieState(answers).kind !== "estimate" && (
            <AppText variant="caption" muted>
              Optional when you're setting your own target.
            </AppText>
          )}
        </View>
      );
    case "calories":
      return <CaloriesQuestion {...props} />;
    case "review":
      return <ProfileReview answers={answers} edit={props.edit} disabled={disabled} />;
  }
}
