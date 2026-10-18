import Head from "expo-router/head";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextProps,
  type ViewProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { createContext, useContext, type PropsWithChildren, type Ref } from "react";
import { useTheme } from "../theme/provider";
import { cardShadow, fonts, radius, spacing } from "../theme/tokens";

type TextVariant =
  "display" | "hero" | "title" | "heading" | "body" | "label" | "caption" | "overline";

/** `numeric` sets title and heading sizes in the data face, so figures line up. */
export function AppText({
  variant = "body",
  muted = false,
  numeric = false,
  style,
  ...props
}: TextProps & { variant?: TextVariant; muted?: boolean; numeric?: boolean }) {
  const { colors } = useTheme();
  return (
    <Text
      {...props}
      style={[
        typeStyles[variant],
        numeric && styles.numeric,
        { color: muted ? colors.mutedForeground : colors.foreground },
        style,
      ]}
    />
  );
}

export function Panel({ style, ...props }: ViewProps) {
  const { colors } = useTheme();
  return (
    <View
      {...props}
      style={[
        styles.panel,
        { backgroundColor: colors.card, borderColor: colors.border, boxShadow: cardShadow(colors) },
        style,
      ]}
    />
  );
}

/** A tab's title row: the screen name on the left and today's summary on the right. */
/**
 * The browser tab's title. Web only: on iOS, expo-router's Head also publishes the screen for
 * Handoff, which needs a hosted origin this app doesn't have, and a release build alerts instead.
 */
export function DocumentTitle({ title }: { title: string }) {
  if (Platform.OS !== "web") return null;
  return (
    <Head>
      <title>{`${title} · KineVault Track`}</title>
    </Head>
  );
}

export function ScreenTitle({
  title,
  trailing,
  testID,
}: {
  title: string;
  trailing?: string | null;
  testID?: string;
}) {
  return (
    <View testID={testID} style={styles.screenTitle}>
      <AppText variant="title" accessibilityRole="header" style={{ flexShrink: 1 }}>
        {title}
      </AppText>
      {trailing ? (
        <AppText variant="label" muted selectable numeric style={styles.screenTitleTrailing}>
          {trailing}
        </AppText>
      ) : null}
    </View>
  );
}

/** A small uppercase label that names a card or group, so cards rarely need headings. */
export function Overline({ children, style, ...props }: TextProps) {
  return (
    <AppText variant="overline" muted {...props} style={style}>
      {children}
    </AppText>
  );
}

const TabBarInset = createContext(0);

/** The tab layout's floating bar height, which tab screens add below their content. */
export const FloatingTabBarInset = TabBarInset.Provider;

export function Screen({
  title,
  children,
  scrollRef,
  adjustKeyboardInsets = false,
  contentContainerStyle,
}: PropsWithChildren<{
  title: string;
  scrollRef?: Ref<ScrollView>;
  adjustKeyboardInsets?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
}>) {
  const { colors } = useTheme();
  const tabBarInset = useContext(TabBarInset);
  return (
    <SafeAreaView edges={["left", "right"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <DocumentTitle title={title} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={adjustKeyboardInsets}
        contentContainerStyle={[
          styles.screen,
          { paddingBottom: spacing.xl + tabBarInset },
          contentContainerStyle,
        ]}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

// Rounded Comfortaa sets display and title text only. Manrope carries every label and figure:
// hero 40 for one figure per screen, heading 18, body 16, label 14, caption 13, overline 11.
const typeStyles = StyleSheet.create({
  display: { fontFamily: fonts.display, fontSize: 32, lineHeight: 40, letterSpacing: -0.8 },
  hero: {
    fontFamily: fonts.extrabold,
    fontSize: 40,
    lineHeight: 46,
    letterSpacing: -1.4,
    fontVariant: ["tabular-nums"],
  },
  title: { fontFamily: fonts.display, fontSize: 24, lineHeight: 32, letterSpacing: -0.6 },
  heading: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 24, letterSpacing: -0.2 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24 },
  label: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  overline: {
    fontFamily: fonts.bold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.3,
    textTransform: "uppercase",
  },
});

const styles = StyleSheet.create({
  numeric: {
    fontFamily: fonts.extrabold,
    letterSpacing: -0.6,
    fontVariant: ["tabular-nums"],
  },
  screen: {
    width: "100%",
    maxWidth: 768,
    alignSelf: "center",
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    gap: spacing.layout,
  },
  screenTitle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    columnGap: spacing.md,
    rowGap: spacing.xs,
    paddingTop: spacing.xs,
  },
  screenTitleTrailing: { fontSize: 15, lineHeight: 20, letterSpacing: 0 },
  panel: {
    padding: spacing.card,
    borderRadius: radius.panel,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
  },
});
