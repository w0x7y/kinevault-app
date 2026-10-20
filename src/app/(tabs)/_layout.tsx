import { Tabs } from "expo-router";
import { BottomTabBar, type BottomTabBarProps } from "expo-router/js-tabs";
import { createContext, useContext, useEffect, useRef, useState, type RefObject } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DayProvider } from "../../calendar/provider";
import { AppHeader } from "../../components/app-header";
import { Icon } from "../../components/icon";
import { FloatingTabBarInset } from "../../components/ui";
import { useReducedMotion } from "../../components/motion";
import { Indicator, type Frame } from "../../components/segmented-control";
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

/**
 * The bar the highlight slides in, the chosen route, its measured frame, and how that route's icon
 * reports it. The stock bar keeps a focused copy of every icon mounted for its crossfade, so the
 * route, not `focused`, says which icon is chosen.
 */
const TabHighlight = createContext<{
  bar: RefObject<View | null>;
  active: string;
  frame: Frame | null;
  place: (frame: Frame) => void;
} | null>(null);

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const [headerHeight, setHeaderHeight] = useState(50 + insets.top + 1);
  const [tabBarHeight, setTabBarHeight] = useState(72 + Math.max(insets.bottom, 12));
  const { colors } = useTheme();
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
                  tabBar={(props) => <FloatingTabBar {...props} onHeightChange={setTabBarHeight} />}
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
                        tabBarIcon: ({ focused }) => (
                          <TabIcon route={name} name={icon} focused={focused} />
                        ),
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

/**
 * The bar floats over the scrolling page; screens pad their end by its measured height so their
 * last card clears it. Like the theme switch's fill, one highlight slides to the chosen tab; it
 * lives here so a tab switch re-renders only the bar.
 */
function FloatingTabBar({
  onHeightChange,
  ...props
}: BottomTabBarProps & { onHeightChange: (height: number) => void }) {
  const insets = useSafeAreaInsets();
  const { colors, appearance } = useTheme();
  const reduced = useReducedMotion();
  const bar = useRef<View>(null);
  const [highlight, setHighlight] = useState<Frame | null>(null);
  const active = props.state.routes[props.state.index].name;
  // Profile has no tab of its own, so no tab is highlighted while it shows.
  const onBar = trackTabs.some((tab) => tab.name === active);
  return (
    <View
      onLayout={(event) => onHeightChange(Math.ceil(event.nativeEvent.layout.height))}
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "transparent",
        paddingHorizontal: 16,
        paddingBottom: Math.max(insets.bottom, 12),
        pointerEvents: "box-none",
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
        {/* A resized bar moves its tabs without re-laying-out their icons; measure again. */}
        <View ref={bar} onLayout={() => setHighlight(null)}>
          {highlight && onBar && !reduced && (
            <Indicator
              frame={highlight}
              style={{ borderRadius: radius.pill, backgroundColor: colors.brandSoft }}
            />
          )}
          <TabHighlight.Provider
            value={{
              bar,
              active,
              frame: reduced ? null : highlight,
              place: (next) =>
                setHighlight((current) =>
                  current &&
                  current.x === next.x &&
                  current.y === next.y &&
                  current.width === next.width &&
                  current.height === next.height
                    ? current
                    : next,
                ),
            }}
          >
            <BottomTabBar {...props} insets={{ ...props.insets, bottom: 0 }} />
          </TabHighlight.Provider>
        </View>
      </View>
    </View>
  );
}

function TabIcon({ route, name, focused }: { route: string; name: IconName; focused: boolean }) {
  const { colors } = useTheme();
  const highlight = useContext(TabHighlight);
  const icon = useRef<View>(null);
  // The chosen icon tells the bar where its highlight goes; the screens switch instantly.
  const place = () => {
    if (highlight?.active === route && highlight.bar.current && icon.current)
      icon.current.measureLayout(highlight.bar.current, (x, y, width, height) =>
        highlight.place({ x, y, width, height }),
      );
  };
  useEffect(place);
  return (
    <View
      ref={icon}
      onLayout={place}
      style={{
        width: 52,
        height: 30,
        borderRadius: radius.pill,
        alignItems: "center",
        justifyContent: "center",
        // Under reduced motion, and until the bar has measured it, the icon draws its own fill.
        backgroundColor: focused && !highlight?.frame ? colors.brandSoft : "transparent",
      }}
    >
      <Icon name={name} size={21} color={focused ? colors.primary : colors.mutedForeground} />
    </View>
  );
}
