import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
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
import { AppText, DocumentTitle } from "../components/ui";
import { AppButton } from "../components/button";
import { InlineMessage } from "../components/inline-message";
import { AccountScreen } from "../onboarding/account-screen";
import { KineStage } from "../onboarding/kine";
import { SetupTopBar } from "../onboarding/top-bar";
import { PageTransition } from "../components/motion";
import { Question, stepCopy } from "../onboarding/steps";
import { steps } from "../profile/answers";
import type { ProfileDocument } from "../profile/model";
import { calorieState } from "../profile/calories";
import { createOnboardingFlow } from "../onboarding/flow";
import { useProfile, useProfilePersistence } from "../profile/provider";
import { useTheme } from "../theme/provider";
import { spacing } from "../theme/tokens";
import { useAccount } from "../account/provider";
import { onboardingExit, routeDecision } from "../account/entry-policy";
import { EntryGate } from "../account/entry-gate";

export default function OnboardingScreen() {
  const { setupStage } = useLocalSearchParams<{ setupStage?: string }>();
  const { state } = useProfile();
  const { user, recovery } = useAccount();
  const decision = routeDecision("onboarding", {
    recovery,
    signedIn: user !== null,
    profile: state,
    setupStage,
  });
  // The flow renders only with a ready Profile; the second check narrows its type.
  if (decision.kind !== "render" || state.kind !== "ready")
    return <EntryGate decision={decision} />;
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
  const { width, height } = useWindowDimensions();
  const { save } = useProfilePersistence();
  const { user } = useAccount();
  const [flow] = useState<ReturnType<typeof createOnboardingFlow>>(() =>
    createOnboardingFlow(initial, {
      save,
      exit: (destination) => {
        // The flow exits only after saving. Account UI follows the final review.
        const next = onboardingExit(destination, user !== null);
        if (next.kind === "accountStep") {
          router.setParams({ setupStage: "account" });
          setShowAccount(true);
          return;
        }
        router.replace(next.href);
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
  // A hairline separates the pinned actions only while the step scrolls beneath them.
  const [viewport, setViewport] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
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
  // Shorter windows get a smaller stage so the question stays in view.
  const compact = height < 720;
  const stageSize = welcome
    ? Math.min(compact ? 200 : 248, width - 2 * spacing.gutter)
    : compact
      ? 108
      : 132;
  const supporting = welcome
    ? message
    : mode.kind !== "estimate" && step === "body"
      ? "A few details for your profile. Height and weight are optional."
      : mode.kind !== "estimate" && step === "calories"
        ? "You can leave this blank or add your own target."
        : message;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <DocumentTitle title={editing ? "Edit profile" : "Meet Kine"} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <SetupTopBar
          stepIndex={stepIndex}
          editing={editing}
          saving={saving}
          cancel={() => void act({ kind: "cancel" })}
          back={showBack ? () => void act({ kind: "back" }) : undefined}
        />
        <ScrollView
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          ref={scroll}
          keyboardShouldPersistTaps="handled"
          onLayout={(event) => setViewport(event.nativeEvent.layout.height)}
          onContentSizeChange={(_, nextHeight) => setContentHeight(nextHeight)}
          contentContainerStyle={[styles.content, welcome && styles.welcome]}
        >
          <PageTransition
            key={step}
            testID="onboarding-content"
            direction={direction}
            style={styles.page}
          >
            <View style={styles.header}>
              <KineStage size={stageSize} pose={step} />
              <View style={{ gap: spacing.sm, alignItems: "center" }}>
                <AppText
                  nativeID="onboarding-title"
                  variant={welcome ? "display" : "title"}
                  accessibilityRole="header"
                  style={{ textAlign: "center", outlineWidth: 0, outlineStyle: "solid" }}
                >
                  {title}
                </AppText>
                <AppText muted style={{ textAlign: "center", maxWidth: 420 }}>
                  {supporting}
                </AppText>
              </View>
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
              <InlineMessage>
                Some answers need another look. Use Edit above to check them.
              </InlineMessage>
            )}
            {error && <InlineMessage>{error}</InlineMessage>}
          </PageTransition>
        </ScrollView>
        <View
          style={[
            styles.footer,
            welcome && { maxWidth: 480 },
            contentHeight > viewport + 1 && {
              borderTopWidth: StyleSheet.hairlineWidth,
              borderColor: colors.border,
            },
          ]}
        >
          <AppButton
            label={primaryLabel}
            tone="primary"
            icon={step === "review" ? "check" : "arrow-right"}
            onPress={() => void act({ kind: "next" })}
            disabled={saving}
          />
          {showSkip && (
            <AppButton
              label="Set up later"
              onPress={() => void act({ kind: "skip" })}
              disabled={saving}
            />
          )}
          {/* A signed-in account without setup already has an account; the sign-in screen would send it straight back. */}
          {welcome && !user && (
            <AppButton label="I already have an account" onPress={() => router.push("/account")} />
          )}
          {welcome && !user && (
            <AppText variant="caption" muted style={{ textAlign: "center" }}>
              Your answers are saved to your account after you sign in. You can edit them anytime.
            </AppText>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  content: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    flexGrow: 1,
  },
  welcome: { maxWidth: 480 },
  // Short questions sit in the middle of the screen instead of leaving a gap above Continue.
  page: { gap: spacing.lg, flexGrow: 1, justifyContent: "center" },
  header: { alignItems: "center", gap: spacing.md },
  footer: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
});
