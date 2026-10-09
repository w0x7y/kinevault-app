import Head from "expo-router/head";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText } from "../components/ui";
import { Icon } from "../components/icon";
import { useTheme } from "../theme/provider";
import { radius, spacing } from "../theme/tokens";
import { Button, Field } from "./controls";
import { Kine } from "./kine";
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
  const account = useAccount();
  const { busy, error, notice, clearFeedback } = account;
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
      setShowPassword(false);
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
    setShowPassword(false);
  }

  function leave(action: () => void) {
    Keyboard.dismiss();
    setEmail("");
    setPassword("");
    setShowPassword(false);
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

  return (
    <SafeAreaView testID="account-screen" style={{ flex: 1, backgroundColor: colors.background }}>
      <Head>
        <title>{title} · KineVault Track</title>
      </Head>
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
            maxWidth: 560,
            alignSelf: "center",
            padding: spacing.layout,
            gap: spacing.layout,
          }}
        >
          <View style={{ alignItems: "center", gap: spacing.layout }}>
            <Kine size={120} pose="welcome" />
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

          {needsEmailConfirmation ? (
            <View style={{ gap: spacing.layout }}>
              <View
                testID="signup-confirmation"
                accessibilityLiveRegion="polite"
                style={{
                  gap: spacing.layout,
                  padding: spacing.layout,
                  borderRadius: radius.control,
                  borderWidth: 1,
                  borderColor: colors.primary,
                  backgroundColor: colors.card,
                }}
              >
                <View style={{ alignItems: "center", gap: spacing.sm }}>
                  <Icon name="envelope" size={28} color={colors.primary} />
                  <AppText muted style={{ textAlign: "center" }}>
                    A verification email is on its way to
                  </AppText>
                  <AppText variant="label" style={{ textAlign: "center" }}>
                    {confirmationEmail}
                  </AppText>
                </View>
                <AppText>
                  1. Open the KineVault email and tap the verification link on this device.
                </AppText>
                <AppText>2. Come back here and log in with your email and password.</AppText>
                <AppText variant="caption" muted>
                  Can't find the email? Check your spam or junk folder.
                </AppText>
              </View>
              <Button
                label="Go to log in"
                disabled={busy}
                onPress={() => {
                  setEmail(confirmationEmail ?? "");
                  changeMode("login");
                }}
              />
              <Button
                label="Use a different email"
                secondary
                disabled={busy}
                onPress={() => changeMode("create")}
              />
            </View>
          ) : (
            <>
              {mode !== "recover" && (
                <View
                  accessibilityRole="tablist"
                  accessibilityLabel="Account options"
                  style={{ flexDirection: "row", gap: spacing.sm }}
                >
                  {(["create", "login"] as const).map((option) => (
                    <Pressable
                      key={option}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: mode === option, disabled: busy }}
                      disabled={busy}
                      onPress={() => changeMode(option)}
                      style={({ pressed }) => ({
                        flex: 1,
                        minHeight: 48,
                        padding: spacing.layout,
                        justifyContent: "center",
                        alignItems: "center",
                        borderRadius: radius.control,
                        borderWidth: 1,
                        borderColor: mode === option ? colors.primary : colors.border,
                        backgroundColor: mode === option ? colors.accent : colors.card,
                        opacity: busy ? 0.55 : pressed ? 0.8 : 1,
                      })}
                    >
                      <AppText variant="label" style={{ textAlign: "center" }}>
                        {option === "create" ? "Create account" : "Log in"}
                      </AppText>
                    </Pressable>
                  ))}
                </View>
              )}

              <View style={{ gap: spacing.layout }}>
                <Field
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  inputMode="email"
                  keyboardType="email-address"
                  autoComplete="email"
                  textContentType="emailAddress"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!busy}
                  placeholder="you@example.com"
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    if (mode === "recover") void submit();
                  }}
                />
                {mode !== "recover" && (
                  <>
                    <Field
                      key={mode}
                      label="Password"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      autoComplete={mode === "create" ? "new-password" : "current-password"}
                      textContentType={mode === "create" ? "newPassword" : "password"}
                      autoCapitalize="none"
                      autoCorrect={false}
                      spellCheck={false}
                      editable={!busy}
                      returnKeyType="done"
                      onSubmitEditing={() => void submit()}
                      trailing={
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                          accessibilityState={{ disabled: busy }}
                          disabled={busy}
                          onPress={() => setShowPassword((visible) => !visible)}
                          style={({ pressed }) => ({
                            minWidth: 44,
                            minHeight: 44,
                            justifyContent: "center",
                            alignItems: "center",
                            opacity: busy ? 0.55 : pressed ? 0.7 : 1,
                          })}
                        >
                          <Icon
                            name={showPassword ? "eye-slash" : "eye"}
                            size={20}
                            color={colors.mutedForeground}
                          />
                        </Pressable>
                      }
                    />
                    {mode === "create" && (
                      <AppText variant="caption" muted>
                        Use at least 10 characters.
                      </AppText>
                    )}
                    {mode === "login" && (
                      <View style={{ flexDirection: "row" }}>
                        <AccountLink
                          label="Forgot password?"
                          disabled={busy}
                          onPress={() => changeMode("recover")}
                        />
                      </View>
                    )}
                  </>
                )}
              </View>

              <View style={{ gap: spacing.layout }}>
                <Button
                  label={
                    busy
                      ? "Please wait…"
                      : mode === "create"
                        ? "Create account"
                        : mode === "login"
                          ? "Log in"
                          : "Send reset link"
                  }
                  onPress={() => void submit()}
                  disabled={busy || !account.configured}
                />
                <AppText variant="caption" muted style={{ textAlign: "center" }}>
                  Sign in to save your goals and workout history to your KineVault account.
                </AppText>
                {mode === "recover" && (
                  <Button
                    label="Back to log in"
                    secondary
                    disabled={busy}
                    onPress={() => changeMode("login")}
                  />
                )}
              </View>
            </>
          )}

          <View style={{ marginTop: "auto", gap: spacing.layout }}>
            {error && (
              <AppText accessibilityRole="alert" style={{ color: colors.error }}>
                {error}
              </AppText>
            )}
            {notice && !needsEmailConfirmation && (
              <AppText accessibilityLiveRegion="polite" style={{ textAlign: "center" }}>
                {notice}
              </AppText>
            )}
            {!account.configured && (
              <AppText accessibilityRole="alert">
                Account connection is unavailable. Please configure Supabase and restart Track.
              </AppText>
            )}
            {mode !== "recover" && (
              <Button
                label="Back"
                secondary
                icon="arrow-left"
                disabled={busy}
                onPress={() => leave(onBack)}
              />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function AccountLink({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 44,
        paddingHorizontal: spacing.xs,
        justifyContent: "center",
        opacity: disabled ? 0.55 : pressed ? 0.7 : 1,
      })}
    >
      <AppText variant="caption" style={{ color: colors.primary, textDecorationLine: "underline" }}>
        {label}
      </AppText>
    </Pressable>
  );
}
