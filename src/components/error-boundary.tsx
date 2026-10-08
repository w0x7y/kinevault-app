import * as SplashScreen from "expo-splash-screen";
import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from "react";
import { Platform, Pressable, ScrollView, Text, useColorScheme } from "react-native";
import { darkColors, lightColors, radius, spacing } from "../theme/tokens";
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
      testID="app-error-boundary"
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: "center",
        padding: spacing.layout,
        paddingVertical: 48,
        gap: spacing.md,
        width: "100%",
        maxWidth: 480,
        alignSelf: "center",
      }}
    >
      <Text
        style={{ color: colors.foreground, fontSize: 24, fontWeight: "600" }}
        accessibilityRole="header"
      >
        Something went wrong
      </Text>
      <Text
        style={{ color: colors.mutedForeground, fontSize: 16 }}
        accessibilityRole="alert"
        accessibilityLiveRegion="assertive"
      >
        {message}
      </Text>
      <Pressable
        testID="app-error-reload"
        accessibilityRole="button"
        accessibilityLabel="Reload"
        onPress={onReload}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={({ pressed }) => ({
          minHeight: 48,
          padding: spacing.md,
          justifyContent: "center",
          alignItems: "center",
          borderRadius: radius.control,
          borderWidth: 2,
          borderColor: focused ? colors.ring : colors.primary,
          backgroundColor: colors.primary,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <Text style={{ color: colors.primaryForeground, fontSize: 16, fontWeight: "600" }}>
          Reload
        </Text>
      </Pressable>
    </ScrollView>
  );
}
