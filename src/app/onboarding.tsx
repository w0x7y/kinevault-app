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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText } from "../components/ui";
import { Button } from "../onboarding/controls";
import { Kine } from "../onboarding/kine";
import { Question, stepCopy } from "../onboarding/steps";
import {
  emptyAnswers,
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
  welcome: [],
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
  const { save, saving, error } = useProfile();
  const [editing] = useState(initial.kind === "complete");
  const [answers, setAnswers] = useState(initial.answers);
  const [step, setStep] = useState<Step>(
    initial.kind === "draft" ? initial.step : "name",
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [returnToReview, setReturnToReview] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const stepIndex = steps.indexOf(step);
  const { title, message } = stepCopy[step];

  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
    if (Platform.OS === "web") {
      document.title = `${editing ? "Edit profile" : "Meet Kine"} · KineVault Track`;
      document.getElementById("onboarding-title")?.focus();
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
    if (
      await save({
        version: 1,
        kind: "complete",
        answers: { ...emptyAnswers, estimateEnabled: false },
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
        <View style={styles.topBar}>
          <AppText variant="label">KineVault Track</AppText>
          {editing && (
            <Button
              label="Cancel"
              secondary
              disabled={saving}
              onPress={() => router.replace("/(tabs)/settings")}
            />
          )}
          {!editing && !welcome && (
            <AppText
              variant="caption"
              muted
              accessibilityLabel={`Step ${stepIndex} of 6`}
            >
              {stepIndex} of 6
            </AppText>
          )}
        </View>
        {!welcome && (
          <View
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 6, now: stepIndex }}
            accessibilityLabel="Setup progress"
            style={{ height: 3, backgroundColor: colors.muted }}
          >
            <View
              style={{
                height: 3,
                width: `${(stepIndex / 6) * 100}%`,
                backgroundColor: colors.primary,
              }}
            />
          </View>
        )}
        <ScrollView
          ref={scroll}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, welcome && styles.welcome]}
        >
          {welcome ? (
            <View style={{ alignItems: "center" }}>
              <Kine size={240} />
            </View>
          ) : (
            <View style={styles.guide}>
              <Kine size={80} />
              <AppText muted style={{ flex: 1 }}>
                {message}
              </AppText>
            </View>
          )}
          <View style={{ gap: 12, alignItems: welcome ? "center" : "stretch" }}>
            <AppText
              nativeID="onboarding-title"
              tabIndex={-1}
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
          <Question
            step={step}
            answers={answers}
            update={update}
            errors={errors}
            edit={(target) => void edit(target)}
            disabled={saving}
          />
          {step === "review" && Object.keys(errors).length > 0 && (
            <AppText accessibilityRole="alert" style={{ color: colors.error }}>
              Some answers need another look. Use Edit above to check them.
            </AppText>
          )}
          {error && (
            <AppText accessibilityRole="alert" style={{ color: colors.error }}>
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
              Your answers stay on this device.
            </AppText>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  topBar: {
    minHeight: 72,
    paddingHorizontal: 24,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
  },
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
