import "../theme/global.css";
import { Comfortaa_600SemiBold } from "@expo-google-fonts/comfortaa/600SemiBold";
import { Manrope_400Regular } from "@expo-google-fonts/manrope/400Regular";
import { Manrope_500Medium } from "@expo-google-fonts/manrope/500Medium";
import { Manrope_600SemiBold } from "@expo-google-fonts/manrope/600SemiBold";
import { Manrope_700Bold } from "@expo-google-fonts/manrope/700Bold";
import { Manrope_800ExtraBold } from "@expo-google-fonts/manrope/800ExtraBold";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import Ionicons from "@expo/vector-icons/Ionicons";
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
import { AccountProvider, useAccount } from "../account/provider";
import { AccountDataProvider } from "../account/data-provider";
import {
  entryRoute,
  isPublicAccountRoute,
  navigatorGate,
  reminderTapAccess,
} from "../account/entry-policy";
import { RefreshNotice } from "../persistence/refresh-notice";
import { AppErrorBoundary } from "../components/error-boundary";
import { initializeCrashReporting } from "../components/crash-reporting";
import { ConnectivityProvider } from "../connectivity/provider";
import { OfflineNotice } from "../connectivity/notice";
import { initializeReminderNotifications } from "../reminders/notifications";
import { ReminderProvider } from "../reminders/provider";
import { useReminderTapRouting } from "../reminders/tap-routing";

initializeCrashReporting();
initializeReminderNotifications();
void SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const reduced = useReducedMotion();
  const { colors, appearance, ready } = useTheme();
  const profile = useProfile();
  const { state } = profile;
  const { user, recovery } = useAccount();
  const route = entryRoute(useSegments());
  const readings = {
    appReady: ready && fontsReady,
    profile: state,
    recovery,
    signedIn: user !== null,
  };
  const gate = navigatorGate(route, readings);
  const loaded = gate?.kind !== "loading";
  useReminderTapRouting(reminderTapAccess(route, readings));

  useEffect(() => {
    if (loaded) void SplashScreen.hideAsync();
  }, [loaded]);

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background);
    if (Platform.OS === "web") document.documentElement.style.colorScheme = appearance;
  }, [appearance, colors.background]);

  if (!loaded) return <KineLoading fill />;
  return (
    <>
      <StatusBar style={appearance === "dark" ? "light" : "dark"} />
      <View style={{ flex: 1 }}>
        {!isPublicAccountRoute(route) && <RefreshNotice label="Profile" document={profile} />}
        {gate?.kind === "profileRecovery" ? (
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
  // Fonts load from launch, alongside the session restore and the account's data.
  const [fontsLoaded, fontError] = useFonts({
    Comfortaa_600SemiBold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    // Icon draws Font Awesome only as the solid face.
    "FontAwesome6Free-Solid": FontAwesome6.font["FontAwesome6Free-Solid"],
    ...Ionicons.font,
  });
  return (
    <AppErrorBoundary>
      <ThemeProvider>
        <MotionProvider>
          <ConnectivityProvider>
            <AccountProvider>
              <View style={{ flex: 1 }}>
                <OfflineNotice />
                <AccountDataProvider>
                  <ReminderProvider>
                    <RootNavigator fontsReady={fontsLoaded || Boolean(fontError)} />
                  </ReminderProvider>
                </AccountDataProvider>
              </View>
            </AccountProvider>
          </ConnectivityProvider>
        </MotionProvider>
      </ThemeProvider>
    </AppErrorBoundary>
  );
}
