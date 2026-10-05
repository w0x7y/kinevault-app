import { Comfortaa_400Regular } from "@expo-google-fonts/comfortaa/400Regular";
import { Comfortaa_500Medium } from "@expo-google-fonts/comfortaa/500Medium";
import { Comfortaa_600SemiBold } from "@expo-google-fonts/comfortaa/600SemiBold";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { useFonts } from "expo-font";
import { Stack, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";
import { Platform, View } from "react-native";
import { ThemeProvider, useTheme } from "../theme/provider";
import { useProfile } from "../profile/provider";
import { ProfileRecovery } from "../profile/recovery";
import { MotionProvider, useReducedMotion } from "../components/motion";
import { KineLoading } from "../components/kine-loading";
import { AccountProvider } from "../account/provider";
import { AccountDataProvider } from "../account/data-provider";
import { isPublicAccountRoute } from "../account/navigation";
import { RefreshNotice } from "../persistence/refresh-notice";

void SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigator() {
  const reduced = useReducedMotion();
  const { colors, appearance, ready } = useTheme();
  const profile = useProfile();
  const { state } = profile;
  const segments = useSegments();
  const authRoute = isPublicAccountRoute(segments);
  const [fontsLoaded, fontError] = useFonts({
    Comfortaa_400Regular,
    Comfortaa_500Medium,
    Comfortaa_600SemiBold,
    ...FontAwesome6.font,
  });
  const loaded =
    ready && (fontsLoaded || Boolean(fontError)) && (authRoute || state.kind !== "loading");

  useEffect(() => {
    if (loaded) void SplashScreen.hideAsync();
  }, [loaded]);

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background);
    if (Platform.OS === "web")
      document.documentElement.style.colorScheme = appearance;
  }, [appearance, colors.background]);

  if (!loaded) return <KineLoading fill />;
  return (
    <>
      <StatusBar style={appearance === "dark" ? "light" : "dark"} />
      <View style={{ flex: 1 }}>
        {!authRoute && <RefreshNotice label="Profile" document={profile} />}
        {state.kind === "error" && !authRoute ? (
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
      </View>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <MotionProvider>
        <AccountProvider>
          <AccountDataProvider>
            <RootNavigator />
          </AccountDataProvider>
        </AccountProvider>
      </MotionProvider>
    </ThemeProvider>
  );
}
