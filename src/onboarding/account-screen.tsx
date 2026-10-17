import { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText, DocumentTitle, Panel } from "../components/ui";
import { Icon } from "../components/icon";
import { SegmentedControl } from "../components/segmented-control";
import { useTheme } from "../theme/provider";
import { fonts, radius, spacing } from "../theme/tokens";
import { AppButton } from "../components/button";
import { InlineMessage } from "../components/inline-message";
import { TextField } from "../components/text-field";
import { KineStage } from "./kine";
import { useAccount } from "../account/provider";

type Mode = "create" | "login" | "recover";

export function AccountScreen({
  onBack,
  initialMode = "create",
}: {
  onBack: () => void;
  initialMode?: "create" | "login";
}) {
  const { colors } = useTheme();
  const compact = useWindowDimensions().height < 720;
  const account = useAccount();
  const { busy, error, notice, clearFeedback } = account;
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const scroll = useRef<ScrollView>(null);
  const confirmationEmail =
    account.emailDelivery?.kind === "confirmation" ? account.emailDelivery.email : null;
  const needsEmailConfirmation = mode === "create" && confirmationEmail !== null;
  const title = needsEmailConfirmation
    ? "Check your email"
    : mode === "create"
      ? "Create your account"
      : mode === "login"
        ? "Welcome back"
        : "Reset your password";

  const changeMode = useCallback(
    (next: Mode) => {
      Keyboard.dismiss();
      setPassword("");
      clearFeedback();
      setMode(next);
    },
    [clearFeedback],
  );

  async function submit() {
    Keyboard.dismiss();
    if (busy) return;
    if (mode === "recover") await account.requestPasswordReset(email);
    else if (mode === "login") await account.signIn(email, password);
    else await account.signUp(email, password);
    setPassword("");
  }

  function leave(action: () => void) {
    Keyboard.dismiss();
    setEmail("");
    setPassword("");
    action();
  }

  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
    if (Platform.OS === "web") {
      const heading = document.getElementById("account-title");
      if (heading) {
        heading.tabIndex = -1;
        heading.focus();
      }
    } else {
      AccessibilityInfo.announceForAccessibility(title);
    }
  }, [title]);

  useEffect(() => {
    if (error) AccessibilityInfo.announceForAccessibility(error);
  }, [error]);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (busy) return true;
      if (mode === "recover") changeMode("login");
      else leave(onBack);
      return true;
    });
    return () => subscription.remove();
  }, [busy, mode, onBack, changeMode]);

  const feedback = (
    <>
      {error && <InlineMessage>{error}</InlineMessage>}
      {notice && !needsEmailConfirmation && (
        <View
          accessibilityLiveRegion="polite"
          style={{
            flexDirection: "row",
            gap: spacing.sm,
            padding: spacing.md,
            borderRadius: radius.control,
            backgroundColor: colors.brandSoft,
          }}
        >
          <Icon name="envelope" size={17} color={colors.brand} style={{ marginTop: 2 }} />
          <AppText variant="label" style={{ flexShrink: 1, fontFamily: fonts.medium }}>
            {notice}
          </AppText>
        </View>
      )}
      {!account.configured && (
        <InlineMessage>
          Account connection is unavailable. Please configure Supabase and restart Track.
        </InlineMessage>
      )}
    </>
  );

  return (
    <SafeAreaView testID="account-screen" style={{ flex: 1, backgroundColor: colors.background }}>
      <DocumentTitle title={title} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          ref={scroll}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            width: "100%",
            maxWidth: 480,
            alignSelf: "center",
            paddingHorizontal: spacing.gutter,
            paddingTop: spacing.sm,
            paddingBottom: spacing.xl,
          }}
        >
          <View style={{ minHeight: 44, alignItems: "flex-start" }}>
            {mode !== "recover" && (
              <AppButton
                label="Back"
                size="compact"
                icon="chevron-left"
                disabled={busy}
                onPress={() => leave(onBack)}
              />
            )}
          </View>
          <View style={{ flexGrow: 1, justifyContent: "center", gap: spacing.lg }}>
            <View style={{ alignItems: "center", gap: spacing.md }}>
              <KineStage size={compact ? 96 : 116} pose="welcome" />
              <View style={{ alignItems: "center", gap: spacing.xs }}>
                <AppText
                  nativeID="account-title"
                  accessibilityRole="header"
                  variant="title"
                  style={{ textAlign: "center", outlineWidth: 0, outlineStyle: "solid" }}
                >
                  {title}
                </AppText>
                <AppText muted style={{ textAlign: "center" }}>
                  {needsEmailConfirmation
                    ? "Confirm your email to finish creating your account."
                    : mode === "recover"
                      ? "Enter the email you use for KineVault."
                      : mode === "login"
                        ? "Log in to your KineVault account."
                        : "A KineVault account for your tracking journey."}
                </AppText>
              </View>
            </View>

            {needsEmailConfirmation ? (
              <View style={{ gap: spacing.md }}>
                <Panel
                  testID="signup-confirmation"
                  accessibilityLiveRegion="polite"
                  style={{ gap: spacing.md }}
                >
                  <View style={{ alignItems: "center", gap: spacing.sm }}>
                    <View
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 26,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: colors.brandSoft,
                      }}
                    >
                      <Icon name="envelope" size={24} color={colors.brand} />
                    </View>
                    <AppText muted style={{ textAlign: "center" }}>
                      A verification email is on its way to
                    </AppText>
                    <AppText variant="heading" style={{ textAlign: "center", fontSize: 16 }}>
                      {confirmationEmail}
                    </AppText>
                  </View>
                  {[
                    "Open the KineVault email and tap the verification link on this device.",
                    "Come back here and log in with your email and password.",
                  ].map((text, index) => (
                    <View key={text} style={{ flexDirection: "row", gap: spacing.md }}>
                      <View
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: colors.muted,
                        }}
                      >
                        <AppText variant="caption" style={{ fontFamily: fonts.bold }}>
                          {index + 1}
                        </AppText>
                      </View>
                      <AppText style={{ flex: 1 }}>{text}</AppText>
                    </View>
                  ))}
                  <AppText variant="caption" muted>
                    Can't find the email? Check your spam or junk folder.
                  </AppText>
                </Panel>
                {feedback}
                <AppButton
                  label="Go to log in"
                  tone="primary"
                  disabled={busy}
                  onPress={() => {
                    setEmail(confirmationEmail ?? "");
                    changeMode("login");
                  }}
                />
                <AppButton
                  label="Use a different email"
                  disabled={busy}
                  onPress={() => changeMode("create")}
                />
              </View>
            ) : (
              <View style={{ gap: spacing.lg }}>
                {mode !== "recover" && (
                  <SegmentedControl
                    label="Account options"
                    semantics="tabs"
                    options={[
                      { value: "create", label: "Sign up" },
                      { value: "login", label: "Log in" },
                    ]}
                    value={mode}
                    disabled={busy}
                    onChange={changeMode}
                  />
                )}

                <View style={{ gap: spacing.md }}>
                  <TextField
                    size="large"
                    label="Email"
                    value={email}
                    onChange={setEmail}
                    kind="email"
                    disabled={busy}
                    placeholder="you@example.com"
                    onSubmit={() => {
                      if (mode === "recover") void submit();
                    }}
                  />
                  {mode !== "recover" && (
                    <View style={{ gap: spacing.xs }}>
                      <TextField
                        size="large"
                        key={mode}
                        label="Password"
                        value={password}
                        onChange={setPassword}
                        kind="password"
                        revealable
                        autoComplete={mode === "create" ? "new-password" : "current-password"}
                        disabled={busy}
                        onSubmit={() => void submit()}
                      />
                      {mode === "create" && (
                        <AppText variant="caption" muted>
                          Use at least 10 characters.
                        </AppText>
                      )}
                      {mode === "login" && (
                        <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
                          <AppButton
                            label="Forgot password?"
                            size="compact"
                            disabled={busy}
                            onPress={() => changeMode("recover")}
                          />
                        </View>
                      )}
                    </View>
                  )}
                </View>

                <View style={{ gap: spacing.md }}>
                  {feedback}
                  <AppButton
                    label={
                      busy
                        ? "Please wait…"
                        : mode === "create"
                          ? "Create account"
                          : mode === "login"
                            ? "Log in"
                            : "Send reset link"
                    }
                    tone="primary"
                    onPress={() => void submit()}
                    disabled={busy || !account.configured}
                  />
                  {mode === "recover" ? (
                    <AppButton
                      label="Back to log in"
                      disabled={busy}
                      onPress={() => changeMode("login")}
                    />
                  ) : (
                    <AppText variant="caption" muted style={{ textAlign: "center" }}>
                      Your goals and workout history are saved to your KineVault account.
                    </AppText>
                  )}
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
