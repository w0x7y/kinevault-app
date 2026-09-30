import { Geist_400Regular } from "@expo-google-fonts/geist/400Regular";
import { Geist_500Medium } from "@expo-google-fonts/geist/500Medium";
import { Geist_600SemiBold } from "@expo-google-fonts/geist/600SemiBold";
import { Geist_700Bold } from "@expo-google-fonts/geist/700Bold";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";
import { Platform } from "react-native";
import { ThemeProvider, useTheme } from "../theme/provider";
import { ProfileProvider, useProfile } from "../profile/provider";
import { ProfileRecovery } from "../profile/recovery";
import { MotionProvider, useReducedMotion } from "../components/motion";

void SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigator() {
  const reduced = useReducedMotion();
  const { colors, appearance, ready } = useTheme();
  const { state } = useProfile();
  const [fontsLoaded, fontError] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
  });
  const loaded =
    ready && (fontsLoaded || Boolean(fontError)) && state.kind !== "loading";

  useEffect(() => {
    if (loaded) void SplashScreen.hideAsync();
  }, [loaded]);

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background);
    if (Platform.OS === "web")
      document.documentElement.style.colorScheme = appearance;
  }, [appearance, colors.background]);

  if (!loaded) return null;
  return (
    <>
      <StatusBar style={appearance === "dark" ? "light" : "dark"} />
      {state.kind === "error" ? (
        <ProfileRecovery />
      ) : (
        <Stack
          screenOptions={{
            headerShown: false,
            animation: reduced ? "fade" : "default",
            contentStyle: { backgroundColor: colors.background },
          }}
        />
      )}
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <MotionProvider>
        <ProfileProvider>
          <RootNavigator />
        </ProfileProvider>
      </MotionProvider>
    </ThemeProvider>
  );
}
