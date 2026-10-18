import { Tabs } from "expo-router";
import { BottomTabBar } from "expo-router/js-tabs";
import { useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DayProvider } from "../../calendar/provider";
import { AppHeader } from "../../components/app-header";
import { Icon } from "../../components/icon";
import { FloatingTabBarInset } from "../../components/ui";
import { useTheme } from "../../theme/provider";
import { fonts, radius } from "../../theme/tokens";
import type { IconName } from "../../components/icon";
import { useProfile } from "../../profile/provider";
import { DemoCatalogProvider } from "../../exercise/demo/provider";
import { useAccount } from "../../account/provider";
import { AccountTrackingProvider, TrackingRefreshNotices } from "../../account/tracking-provider";
import { routeDecision } from "../../account/entry-policy";
import { EntryGate } from "../../account/entry-gate";
import { journalTab, tabNavigator, trackTabs } from "../../navigation/track-tabs";

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const [headerHeight, setHeaderHeight] = useState(50 + insets.top + 1);
  const [tabBarHeight, setTabBarHeight] = useState(72 + Math.max(insets.bottom, 12));
  const { colors, appearance } = useTheme();
  const { state } = useProfile();
  const { user, recovery } = useAccount();
  const access = routeDecision("tracking", { recovery, signedIn: user !== null, profile: state });
  if (access.kind !== "render") return <EntryGate decision={access} />;
  return (
    <AccountTrackingProvider>
      <DemoCatalogProvider>
        <DayProvider>
          <FloatingTabBarInset value={tabBarHeight}>
            <View style={{ flex: 1, backgroundColor: colors.background }}>
              <View style={{ flex: 1, paddingTop: headerHeight }}>
                <TrackingRefreshNotices />
                <Tabs
                  {...tabNavigator}
                  tabBar={(props) => (
                    // The bar floats over the scrolling page; screens pad their end by its
                    // measured height so their last card clears it.
                    <View
                      pointerEvents="box-none"
                      onLayout={(event) =>
                        setTabBarHeight(Math.ceil(event.nativeEvent.layout.height))
                      }
                      style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: "transparent",
                        paddingHorizontal: 16,
                        paddingBottom: Math.max(insets.bottom, 12),
                      }}
                    >
                      <View
                        style={{
                          width: "100%",
                          maxWidth: 560,
                          alignSelf: "center",
                          borderRadius: radius.panel + 4,
                          borderWidth: 1,
                          borderColor: colors.border,
                          backgroundColor: colors.elevated,
                          boxShadow:
                            appearance === "dark"
                              ? undefined
                              : "0px 10px 30px rgba(22, 24, 28, 0.10), 0px 1px 3px rgba(22, 24, 28, 0.06)",
                        }}
                      >
                        <BottomTabBar {...props} insets={{ ...props.insets, bottom: 0 }} />
                      </View>
                    </View>
                  )}
                  screenOptions={{
                    // Tabs are peers used dozens of times a day; switching is instant.
                    animation: "none",
                    headerShown: false,
                    tabBarActiveTintColor: colors.primary,
                    tabBarInactiveTintColor: colors.mutedForeground,
                    tabBarStyle: {
                      backgroundColor: "transparent",
                      borderTopWidth: 0,
                      elevation: 0,
                      boxShadow: "none",
                      height: 72,
                      paddingTop: 8,
                      paddingBottom: 8,
                    },
                    tabBarItemStyle: { minHeight: 48 },
                    tabBarLabelStyle: {
                      fontFamily: fonts.bold,
                      fontSize: 11,
                      lineHeight: 15,
                      letterSpacing: 0.2,
                      marginTop: 2,
                      flexShrink: 0,
                    },
                    sceneStyle: { backgroundColor: colors.background },
                  }}
                >
                  {trackTabs.map(({ name, title, icon }) => (
                    <Tabs.Screen
                      key={name}
                      name={name}
                      options={{
                        title,
                        tabBarIcon: ({ focused }) => <TabIcon name={icon} focused={focused} />,
                      }}
                    />
                  ))}
                  <Tabs.Screen name={journalTab.name} options={{ href: null }} />
                </Tabs>
              </View>
              <AppHeader onHeightChange={setHeaderHeight} />
            </View>
          </FloatingTabBarInset>
        </DayProvider>
      </DemoCatalogProvider>
    </AccountTrackingProvider>
  );
}

function TabIcon({ name, focused }: { name: IconName; focused: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: 52,
        height: 30,
        borderRadius: radius.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: focused ? colors.brandSoft : "transparent",
      }}
    >
      <Icon name={name} size={21} color={focused ? colors.primary : colors.mutedForeground} />
    </View>
  );
}
