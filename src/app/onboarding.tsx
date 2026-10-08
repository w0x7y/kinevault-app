import { Redirect, router, useFocusEffect, useLocalSearchParams } from "expo-router";
import Head from "expo-router/head";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
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
import { Button } from "../onboarding/controls";
import { AccountScreen } from "../onboarding/account-screen";
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
import { radius, spacing } from "../theme/tokens";
import { useAccount } from "../account/provider";

export default function OnboardingScreen() {
  const { setupStage } = useLocalSearchParams<{ setupStage?: string }>();
  const { state } = useProfile();
  const { user, recovery } = useAccount();
  if (recovery) return <Redirect href="/auth/reset-password" />;
  if (state.kind !== "ready") return null;
  if (user && state.document.kind === "complete" && setupStage === "account")
    return <Redirect href="/(tabs)" />;
  const resumeSavedReview =
    state.document.kind === "complete" && (setupStage === "account" || setupStage === "review");
  const initial: ProfileDocument = resumeSavedReview
    ? { ...state.document, kind: "draft", step: "review" }
    : state.document;
  return (
    <OnboardingFlow
      initial={initial}
      startWithAccount={resumeSavedReview && setupStage === "account"}
    />
  );
}

function OnboardingFlow({
  initial,
  startWithAccount,
}: {
  initial: ProfileDocument;
  startWithAccount: boolean;
}) {
  const [showAccount, setShowAccount] = useState(startWithAccount);
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const { save } = useProfile();
  const { user } = useAccount();
  const [flow] = useState<ReturnType<typeof createOnboardingFlow>>(() =>
    createOnboardingFlow(initial, {
      save,
      exit: (destination) => {
        // The flow exits only after saving. Account UI follows the final review.
        if (destination === "today" && !user) {
          router.setParams({ setupStage: "account" });
          setShowAccount(true);
          return;
        }
        router.replace(destination === "settings" ? "/(tabs)/settings" : "/(tabs)");
      },
    }),
  );
  useFocusEffect(
    useCallback(() => {
      flow.start();
      return flow.stop;
    }, [flow]),
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
    if (showAccount) return;
    scroll.current?.scrollTo({ y: 0, animated: false });
    if (Platform.OS === "web") {
      document.title = `${editing ? "Edit profile" : "Meet Kine"} · KineVault Track`;
      const heading = document.getElementById("onboarding-title");
      if (heading) {
        heading.tabIndex = -1;
        heading.focus();
      }
    } else AccessibilityInfo.announceForAccessibility(title);
  }, [step, title, editing, showAccount]);

  useEffect(() => {
    if (Object.keys(errors).length)
      AccessibilityInfo.announceForAccessibility("Please check the highlighted answers.");
  }, [errors]);

  useEffect(() => {
    if (Platform.OS !== "android" || showAccount) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (step === "welcome") return false;
      Keyboard.dismiss();
      void flow.act({ kind: "back" });
      return true;
    });
    return () => subscription.remove();
  }, [flow, step, showAccount]);

  if (showAccount) {
    return (
      <AccountScreen
        onBack={() => {
          router.setParams({ setupStage: "review" });
          setShowAccount(false);
        }}
      />
    );
  }

  const welcome = step === "welcome";
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <Head>
        <title>{editing ? "Edit profile" : "Meet Kine"} · KineVault Track</title>
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
            testID="onboarding-content"
            direction={direction}
            style={{ gap: spacing.layout, flexGrow: 1 }}
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
                    gap: spacing.layout,
                    padding: 0,
                  },
                ]}
              >
                <Kine pose={step} />
                <AppText muted style={width < 380 ? { textAlign: "center" } : { flex: 1 }}>
                  {mode.kind !== "estimate" && step === "body"
                    ? "A few details for your profile. Height and weight are optional."
                    : mode.kind !== "estimate" && step === "calories"
                      ? "You can leave this blank or add your own target."
                      : message}
                </AppText>
              </View>
            )}
            <View style={{ gap: spacing.layout, alignItems: welcome ? "center" : "stretch" }}>
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
            <Question
              step={step}
              answers={answers}
              update={update}
              errors={errors}
              edit={(target) => void act({ kind: "edit", step: target })}
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
            <View style={{ marginTop: "auto", gap: spacing.layout }}>
              <Button
                label={primaryLabel}
                icon={step === "review" ? "check" : "arrow-right"}
                onPress={() => void act({ kind: "next" })}
                disabled={saving}
              />
              {showBack && (
                <Button
                  label="Back"
                  icon="arrow-left"
                  secondary
                  onPress={() => void act({ kind: "back" })}
                  disabled={saving}
                />
              )}
              {showSkip && (
                <Button
                  label="Set up later"
                  icon="clock"
                  secondary
                  onPress={() => void act({ kind: "skip" })}
                  disabled={saving}
                />
              )}
            </View>
            {welcome && (
              <Button
                label="I already have an account"
                secondary
                onPress={() => router.push("/account")}
              />
            )}
            {welcome && (
              <AppText variant="caption" muted style={{ textAlign: "center" }}>
                Your answers are saved to your account after you sign in. You can edit them anytime.
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
    padding: spacing.layout,
    gap: spacing.layout,
    flexGrow: 1,
  },
  welcome: { maxWidth: 480, justifyContent: "center" },
  guide: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.layout,
    padding: spacing.layout,
    borderRadius: radius.panel,
  },
});
