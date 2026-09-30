import { router } from "expo-router";
import Head from "expo-router/head";
import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText } from "../components/ui";
import { Button, Field } from "../onboarding/controls";
import { Kine } from "../onboarding/kine";
import { SetupTopBar } from "../onboarding/top-bar";
import { PageTransition } from "../components/motion";
import { Question, stepCopy } from "../onboarding/steps";
import {
  emptyAnswers,
  ageUpdate,
  isTeen,
  steps,
  validateAnswers,
  type Answers,
  type FieldErrors,
  type ProfileDocument,
  type Step,
} from "../profile/model";
import { useProfile } from "../profile/provider";
import { useTheme } from "../theme/provider";
import { radius } from "../theme/tokens";

const fieldsByStep: Record<Step, (keyof Answers)[]> = {
  welcome: ["age"],
  name: ["name"],
  goal: ["goal"],
  body: ["age", "height", "weight", "sex", "eligible"],
  activity: ["activity"],
  calories: ["customCalories"],
  review: [
    "name",
    "goal",
    "age",
    "height",
    "weight",
    "sex",
    "eligible",
    "activity",
    "customCalories",
  ],
};

export default function OnboardingScreen() {
  const { state } = useProfile();
  if (state.kind !== "ready") return null;
  return <OnboardingFlow initial={state.document} />;
}

function OnboardingFlow({ initial }: { initial: ProfileDocument }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const { save, saving, error } = useProfile();
  const [editing] = useState(initial.kind === "complete");
  const [answers, setAnswers] = useState(initial.answers);
  const [step, setStep] = useState<Step>(
    initial.kind === "draft" ? initial.step : "name",
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [returnToReview, setReturnToReview] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const [direction, setDirection] = useState(1);
  const stepIndex = steps.indexOf(step);
  const { title, message } = stepCopy[step];

  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
    if (Platform.OS === "web") {
      document.title = `${editing ? "Edit profile" : "Meet Kine"} · KineVault Track`;
      const heading = document.getElementById("onboarding-title");
      if (heading) {
        heading.tabIndex = -1;
        heading.focus();
      }
    } else AccessibilityInfo.announceForAccessibility(title);
  }, [step, title, editing]);

  async function goTo(next: Step) {
    if (saving) return false;
    Keyboard.dismiss();
    if (
      !editing &&
      !(await save({ version: 1, kind: "draft", step: next, answers }))
    )
      return false;
    setErrors({});
    setDirection(steps.indexOf(next) >= stepIndex ? 1 : -1);
    setStep(next);
    return true;
  }
  async function back() {
    if (saving) return;
    if (returnToReview) {
      if (await goTo("review")) setReturnToReview(false);
    } else if (stepIndex > (editing ? 1 : 0)) {
      const previous = steps[stepIndex - 1];
      if (previous) void goTo(previous);
    } else if (editing) router.replace("/(tabs)/settings");
  }
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (step === "welcome") return false;
        void back();
        return true;
      },
    );
    return () => subscription.remove();
  });

  async function next() {
    const allErrors = validateAnswers(answers);
    const relevant: FieldErrors = {};
    for (const field of fieldsByStep[step])
      if (allErrors[field]) relevant[field] = allErrors[field];
    setErrors(relevant);
    if (Object.keys(relevant).length) {
      AccessibilityInfo.announceForAccessibility(
        "Please check the highlighted answers.",
      );
      return;
    }
    if (step === "review") {
      if (
        await save({
          version: 1,
          kind: "complete",
          answers: { ...answers, name: answers.name.trim() },
        })
      )
        router.replace(editing ? "/(tabs)/settings" : "/(tabs)");
    } else if (returnToReview) {
      if (await goTo("review")) setReturnToReview(false);
    } else {
      const following = steps[stepIndex + 1];
      if (following) await goTo(following);
    }
  }
  async function skip() {
    const ageError = validateAnswers(answers).age;
    if (ageError) {
      setErrors({ age: ageError });
      return;
    }
    if (
      await save({
        version: 1,
        kind: "complete",
        answers: { ...emptyAnswers, age: answers.age, estimateEnabled: false },
      })
    )
      router.replace("/(tabs)");
  }
  function update(patch: Partial<Answers>) {
    setAnswers((current) => ({ ...current, ...patch }));
    setErrors({});
  }
  async function edit(target: Step) {
    if (await goTo(target)) setReturnToReview(true);
  }
  const welcome = step === "welcome";
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <Head>
        <title>
          {editing ? "Edit profile" : "Meet Kine"} · KineVault Track
        </title>
      </Head>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <SetupTopBar
          stepIndex={stepIndex}
          editing={editing}
          saving={saving}
          cancel={() => router.replace("/(tabs)/settings")}
        />
        <ScrollView
          ref={scroll}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, welcome && styles.welcome]}
        >
          <PageTransition
            key={step}
            direction={direction}
            style={{ gap: 24, flexGrow: 1 }}
          >
            {welcome ? (
              <View style={{ alignItems: "center" }}>
                <Kine size={280} pose="welcome" />
              </View>
            ) : (
              <View
                style={[
                  styles.guide,
                  width < 380 && {
                    flexDirection: "column",
                    gap: 8,
                    padding: 0,
                  },
                ]}
              >
                <Kine pose={step} />
                <AppText
                  muted
                  style={width < 380 ? { textAlign: "center" } : { flex: 1 }}
                >
                  {(isTeen(answers) || !answers.estimateEnabled) &&
                  step === "body"
                    ? "A few details for your profile. Age is required; height and weight are optional."
                    : (isTeen(answers) || !answers.estimateEnabled) &&
                        step === "calories"
                      ? "You can leave this blank or add your own target."
                      : message}
                </AppText>
              </View>
            )}
            <View
              style={{ gap: 12, alignItems: welcome ? "center" : "stretch" }}
            >
              <AppText
                nativeID="onboarding-title"
                variant="title"
                accessibilityRole="header"
                style={[
                  { outlineWidth: 0, outlineStyle: "solid" },
                  welcome ? { textAlign: "center" } : undefined,
                ]}
              >
                {title}
              </AppText>
              {welcome && (
                <AppText muted style={{ textAlign: "center" }}>
                  {message}
                </AppText>
              )}
            </View>
            {welcome && (
              <Field
                label="Age (years)"
                value={answers.age}
                onChangeText={(age) => update(ageUpdate(answers, age))}
                placeholder="16 or older"
                keyboardType="number-pad"
                inputMode="numeric"
                maxLength={3}
                editable={!saving}
                error={errors.age}
              />
            )}
            <Question
              step={step}
              answers={answers}
              update={update}
              errors={errors}
              edit={(target) => void edit(target)}
              disabled={saving}
            />
            {step === "review" && Object.keys(errors).length > 0 && (
              <AppText
                accessibilityRole="alert"
                style={{ color: colors.error }}
              >
                Some answers need another look. Use Edit above to check them.
              </AppText>
            )}
            {error && (
              <AppText
                accessibilityRole="alert"
                style={{ color: colors.error }}
              >
                {error}
              </AppText>
            )}
            <View style={{ marginTop: "auto", gap: 12, paddingTop: 12 }}>
              <Button
                label={
                  saving
                    ? "Saving…"
                    : welcome
                      ? "Let's go"
                      : step === "review"
                        ? editing
                          ? "Save changes"
                          : "Finish setup"
                        : returnToReview
                          ? "Back to review"
                          : "Continue"
                }
                onPress={() => void next()}
                disabled={saving}
              />
              {!welcome && !(editing && step === "name") && (
                <Button
                  label="Back"
                  secondary
                  onPress={() => void back()}
                  disabled={saving}
                />
              )}
              {!editing && welcome && (
                <Button
                  label="Set up later"
                  secondary
                  onPress={() => void skip()}
                  disabled={saving}
                />
              )}
            </View>
            {welcome && (
              <AppText variant="caption" muted style={{ textAlign: "center" }}>
                For ages 16+. Your answers stay on this device.
              </AppText>
            )}
          </PageTransition>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  content: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    padding: 24,
    paddingBottom: 32,
    gap: 24,
    flexGrow: 1,
  },
  welcome: { maxWidth: 480, justifyContent: "center" },
  guide: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 12,
    borderRadius: radius.panel,
  },
});
