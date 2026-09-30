import { router } from "expo-router";
import Head from "expo-router/head";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
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
import { steps } from "../profile/answers";
import type { ProfileDocument } from "../profile/model";
import { calorieState } from "../profile/calories";
import { createOnboardingFlow } from "../onboarding/flow";
import { useProfile } from "../profile/provider";
import { useTheme } from "../theme/provider";
import { radius } from "../theme/tokens";

export default function OnboardingScreen() {
  const { state } = useProfile();
  if (state.kind !== "ready") return null;
  return <OnboardingFlow initial={state.document} />;
}

function OnboardingFlow({ initial }: { initial: ProfileDocument }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const { save } = useProfile();
  const [flow] = useState(() =>
    createOnboardingFlow(initial, {
      save,
      exit: (destination) =>
        router.replace(
          destination === "settings" ? "/(tabs)/settings" : "/(tabs)",
        ),
    }),
  );
  const {
    answers,
    step,
    editing,
    errors,
    direction,
    saving,
    error,
    primaryLabel,
    showBack,
    showSkip,
  } = useSyncExternalStore(flow.subscribe, flow.getSnapshot, flow.getSnapshot);
  const update = flow.update;
  const mode = calorieState(answers);
  const scroll = useRef<ScrollView>(null);
  const stepIndex = steps.indexOf(step);
  const { title, message } = stepCopy[step];
  const act: typeof flow.act = (action) => {
    Keyboard.dismiss();
    return flow.act(action);
  };

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

  useEffect(() => {
    if (Object.keys(errors).length)
      AccessibilityInfo.announceForAccessibility(
        "Please check the highlighted answers.",
      );
  }, [errors]);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (step === "welcome") return false;
        Keyboard.dismiss();
        void flow.act({ kind: "back" });
        return true;
      },
    );
    return () => subscription.remove();
  }, [flow, step]);

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
          cancel={() => void act({ kind: "cancel" })}
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
                  {mode.kind !== "estimate" && step === "body"
                    ? "A few details for your profile. Age is required; height and weight are optional."
                    : mode.kind !== "estimate" && step === "calories"
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
                onChangeText={(age) =>
                  update({ kind: "fields", patch: { age } })
                }
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
              edit={(target) => void act({ kind: "edit", step: target })}
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
                label={primaryLabel}
                onPress={() => void act({ kind: "next" })}
                disabled={saving}
              />
              {showBack && (
                <Button
                  label="Back"
                  secondary
                  onPress={() => void act({ kind: "back" })}
                  disabled={saving}
                />
              )}
              {showSkip && (
                <Button
                  label="Set up later"
                  secondary
                  onPress={() => void act({ kind: "skip" })}
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
