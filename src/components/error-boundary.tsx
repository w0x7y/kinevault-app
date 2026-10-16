import * as SplashScreen from "expo-splash-screen";
import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { cardShadow, darkColors, lightColors, radius, spacing } from "../theme/tokens";
import { reportCrash } from "./crash-reporting";
import {
  initialBoundaryState,
  errorMessageFor,
  nextBoundaryState,
  reloadActionFor,
  type BoundaryState,
} from "./error-boundary-state";

/**
 * Root error boundary. The recovery screen uses only platform components so
 * theme, account and data provider failures can all recover here. It never
 * touches storage: a crash leaves saved tracking as is.
 *
 * Reload behavior: Reload resets the boundary and remounts the children. On
 * web, if remounting has already failed twice in a row, Reload performs
 * `window.location.reload()` instead, so a broken bundle can be refetched.
 * Native platforms always remount.
 */
export class AppErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = initialBoundaryState;

  static getDerivedStateFromError(error: unknown): Partial<BoundaryState> {
    // Only the derived message is stored; the error itself stays out of state.
    return { failed: true, message: errorMessageFor(error) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    this.setState((previous) => ({
      crashes: previous.crashes + 1,
      message: nextBoundaryState(previous, { kind: "crash", error }).message,
    }));
    reportCrash(error, info);
  }

  componentDidUpdate(_previousProps: { children: ReactNode }, previousState: BoundaryState) {
    // A failed→healthy update reaches this lifecycle only after React commits
    // the recovered children. Failed render retries remain in the fallback.
    if (previousState.failed && !this.state.failed) {
      this.setState((previous) => nextBoundaryState(previous, { kind: "recovered" }));
    }
  }

  reload = () => {
    const action = reloadActionFor(this.state, Platform.OS);
    if (action === "full" && typeof window !== "undefined") {
      window.location.reload();
      return;
    }
    this.setState((previous) => nextBoundaryState(previous, { kind: "reload" }));
  };

  render() {
    if (this.state.failed)
      return <ErrorFallback message={this.state.message} onReload={this.reload} />;
    return this.props.children;
  }
}

function ErrorFallback({ message, onReload }: { message: string; onReload: () => void }) {
  const colors = useColorScheme() === "dark" ? darkColors : lightColors;
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    // A startup crash would otherwise leave the splash screen frozen on top.
    void SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      testID="app-error-boundary"
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: "center",
        paddingHorizontal: spacing.gutter,
        paddingVertical: 48,
        width: "100%",
        maxWidth: 440,
        alignSelf: "center",
      }}
    >
      {/* System fonts only: this screen renders before, or without, the app's font loading. */}
      <View
        style={{
          alignItems: "center",
          gap: spacing.md,
          padding: spacing.lg,
          paddingTop: spacing.xl,
          borderRadius: radius.panel,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          backgroundColor: colors.card,
          boxShadow: cardShadow(colors),
        }}
      >
        <View
          aria-hidden
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.brandSoft,
          }}
        >
          <Text style={{ color: colors.brand, fontSize: 26, fontWeight: "700", lineHeight: 30 }}>
            !
          </Text>
        </View>
        <Text
          style={{
            color: colors.foreground,
            fontSize: 22,
            lineHeight: 28,
            fontWeight: "700",
            letterSpacing: -0.3,
            textAlign: "center",
          }}
          accessibilityRole="header"
        >
          Let's try that again
        </Text>
        <Text
          style={{
            color: colors.mutedForeground,
            fontSize: 16,
            lineHeight: 24,
            textAlign: "center",
          }}
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
        >
          {message}
        </Text>
        {/* A plain Pressable, not Tappable: this screen renders outside ThemeProvider. */}
        <Pressable
          testID="app-error-reload"
          accessibilityRole="button"
          accessibilityLabel="Reload"
          onPress={onReload}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={({ pressed }) => ({
            alignSelf: "stretch",
            marginTop: spacing.sm,
            minHeight: 50,
            padding: spacing.md,
            justifyContent: "center",
            alignItems: "center",
            borderRadius: radius.control,
            borderWidth: 2,
            borderColor: focused ? colors.ring : "transparent",
            backgroundColor: colors.primary,
            opacity: pressed ? 0.86 : 1,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          })}
        >
          <Text style={{ color: colors.primaryForeground, fontSize: 16, fontWeight: "700" }}>
            Reload
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
