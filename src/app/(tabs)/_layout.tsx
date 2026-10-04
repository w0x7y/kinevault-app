import { Redirect, Tabs } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DayProvider } from "../../calendar/provider";
import { AppHeader } from "../../components/app-header";
import { Icon } from "../../components/icon";
import { useTheme } from "../../theme/provider";
import { fonts } from "../../theme/tokens";
import { useProfile } from "../../profile/provider";
import { useReducedMotion } from "../../components/motion";
import { FoodLogProvider } from "../../food/log-provider";
import { CustomFoodProvider } from "../../food/custom-provider";
import { WaterLogProvider } from "../../water/provider";
import { WaterGoalProvider } from "../../water/goal-provider";
import { ProfileMediaProvider } from "../../profile/media-provider";
import { ExerciseProvider } from "../../exercise/provider";

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const [headerHeight, setHeaderHeight] = useState(50 + insets.top + 1);
  const reduced = useReducedMotion();
  const { colors } = useTheme();
  const { state } = useProfile();
  if (state.kind !== "ready") return null;
  if (state.document.kind === "draft") return <Redirect href="/onboarding" />;
  return (
    <ProfileMediaProvider><CustomFoodProvider><FoodLogProvider><WaterLogProvider><WaterGoalProvider><ExerciseProvider><DayProvider>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, paddingTop: headerHeight }}>
          <Tabs
            initialRouteName="index"
            backBehavior="initialRoute"
            screenOptions={{
              animation: reduced ? "none" : "fade",
              transitionSpec: { animation: "timing", config: { duration: 160 } },
              headerShown: false,
              tabBarActiveTintColor: colors.primary,
              tabBarInactiveTintColor: colors.mutedForeground,
              tabBarStyle: {
                backgroundColor: colors.card,
                borderTopColor: colors.border,
                minHeight: 64,
              },
              tabBarItemStyle: { minHeight: 48 },
              tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 12 },
              sceneStyle: { backgroundColor: colors.background },
            }}
          >
            <Tabs.Screen
              name="index"
              options={{
                title: "Home",
                tabBarIcon: ({ focused, size }) => (
                  <Icon name="house" size={size} color={focused ? colors.primary : colors.mutedForeground} />
                ),
              }}
            />
            <Tabs.Screen
              name="food"
              options={{
                title: "Food",
                tabBarIcon: ({ focused, size }) => (
                  <Icon name="utensils" size={size} color={focused ? colors.primary : colors.mutedForeground} />
                ),
              }}
            />
            <Tabs.Screen
              name="exercise"
              options={{
                title: "Exercise",
                tabBarIcon: ({ focused, size }) => (
                  <Icon name="dumbbell" size={size} color={focused ? colors.primary : colors.mutedForeground} />
                ),
              }}
            />
            <Tabs.Screen
              name="settings"
              options={{
                title: "Settings",
                tabBarIcon: ({ focused, size }) => (
                  <Icon name="gear" size={size} color={focused ? colors.primary : colors.mutedForeground} />
                ),
              }}
            />
            <Tabs.Screen name="profile" options={{ href: null }} />
          </Tabs>
        </View>
        <AppHeader onHeightChange={setHeaderHeight} />
      </View>
    </DayProvider></ExerciseProvider></WaterGoalProvider></WaterLogProvider></FoodLogProvider></CustomFoodProvider></ProfileMediaProvider>
  );
}
