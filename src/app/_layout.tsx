import { Comfortaa_400Regular } from "@expo-google-fonts/comfortaa/400Regular";
import { Comfortaa_500Medium } from "@expo-google-fonts/comfortaa/500Medium";
import { Comfortaa_600SemiBold } from "@expo-google-fonts/comfortaa/600SemiBold";
import { Comfortaa_700Bold } from "@expo-google-fonts/comfortaa/700Bold";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
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
    Comfortaa_400Regular,
    Comfortaa_500Medium,
    Comfortaa_600SemiBold,
    Comfortaa_700Bold,
    ...FontAwesome6.font,
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
