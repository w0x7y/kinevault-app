import { Tabs } from "expo-router";
import {
  CalendarDays,
  Utensils,
  Dumbbell,
  Settings,
  Orbit,
} from "lucide-react-native";
import { View } from "react-native";
import { AppText } from "../../components/ui";
import { useTheme } from "../../theme/provider";
import { fonts, radius } from "../../theme/tokens";

export default function TabLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.foreground,
        headerShadowVisible: false,
        headerTitleAlign: "left",
        headerTitle: () => (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: radius.control,
                backgroundColor: colors.primary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Orbit
                size={23}
                strokeWidth={1.7}
                color={colors.primaryForeground}
                aria-hidden={true}
              />
            </View>
            <AppText
              style={{
                fontFamily: fonts.bold,
                fontSize: 20,
                letterSpacing: -1,
              }}
            >
              KineVault Track
            </AppText>
          </View>
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
