import { Redirect, Tabs } from "expo-router";
import {
  CalendarDays,
  Utensils,
  Dumbbell,
  Settings,
} from "lucide-react-native";
import { AppText } from "../../components/ui";
import { useTheme } from "../../theme/provider";
import { fonts } from "../../theme/tokens";
import { useProfile } from "../../profile/provider";
import { PageTransition, useReducedMotion } from "../../components/motion";

export default function TabLayout() {
  const reduced = useReducedMotion();
  const { colors } = useTheme();
  const { state } = useProfile();
  if (state.kind !== "ready") return null;
  if (state.document.kind === "draft") return <Redirect href="/onboarding" />;
  return (
    <Tabs
      screenOptions={{
        animation: reduced ? "none" : "fade",
        transitionSpec: { animation: "timing", config: { duration: 160 } },
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.foreground,
        headerShadowVisible: false,
        headerTitleAlign: "left",
        headerTitle: ({ children }) => (
          <PageTransition key={children} direction={0}>
            <AppText
              style={{
                fontFamily: fonts.bold,
                fontSize: 20,
                letterSpacing: -1,
              }}
            >
              KineVault Track
            </AppText>
          </PageTransition>
        ),
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
          title: "Today",
          tabBarIcon: ({ color, size }) => (
            <CalendarDays size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="food"
        options={{
          title: "Food",
          tabBarIcon: ({ color, size }) => (
            <Utensils size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="exercise"
        options={{
          title: "Exercise",
          tabBarIcon: ({ color, size }) => (
            <Dumbbell size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => (
            <Settings size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
