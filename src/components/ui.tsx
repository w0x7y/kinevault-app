import { useFocusRing } from "./focus-ring";
import { Link, type Href } from "expo-router";
import Head from "expo-router/head";
import {
  Pressable,
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
import { useState, type PropsWithChildren, type Ref } from "react";
import { useTheme } from "../theme/provider";
import { fonts, radius, spacing } from "../theme/tokens";
import { Icon, type IconName } from "./icon";

type TextVariant = "hero" | "title" | "heading" | "body" | "label" | "caption";

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
  return <View {...props} style={[styles.panel, { backgroundColor: colors.card }, style]} />;
}

export function Screen({
  title,
  description,
  children,
  showTitle = true,
  scrollRef,
  adjustKeyboardInsets = false,
  fill = false,
  contentContainerStyle,
}: PropsWithChildren<{
  title: string;
  description?: string;
  showTitle?: boolean;
  scrollRef?: Ref<ScrollView>;
  adjustKeyboardInsets?: boolean;
  fill?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
}>) {
  const { colors } = useTheme();
  return (
    <SafeAreaView edges={["left", "right"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <Head>
        <title>{title} · KineVault Track</title>
      </Head>
      <ScrollView
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={adjustKeyboardInsets}
        contentContainerStyle={[styles.screen, fill && { flexGrow: 1 }, contentContainerStyle]}
      >
        {showTitle && (
          <View style={styles.intro}>
            <AppText variant="title" accessibilityRole="header" style={{ flexShrink: 1 }}>
              {title}
            </AppText>
            {description && (
              <AppText muted style={{ maxWidth: 600 }}>
                {description}
              </AppText>
            )}
          </View>
        )}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Destination({
  href,
  title,
  description,
  icon,
}: {
  href: Href;
  title: string;
  description?: string;
  icon: IconName;
}) {
  const { colors } = useTheme();
  const { focused, onFocus, onBlur } = useFocusRing();
  const [pressed, setPressed] = useState(false);
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="link"
        onFocus={onFocus}
        onBlur={onBlur}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        style={StyleSheet.flatten([
          styles.destination,
          {
            borderColor: focused ? colors.ring : "transparent",
            backgroundColor: pressed ? colors.accent : colors.card,
            borderWidth: 2,
          },
        ])}
      >
        <Icon name={icon} size={20} color={colors.primary} />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="label" style={{ fontSize: 16, lineHeight: 22 }}>
            {title}
          </AppText>
          {description && (
            <AppText variant="caption" muted>
              {description}
            </AppText>
          )}
        </View>
        <Icon name="chevron-right" size={16} color={colors.mutedForeground} />
      </Pressable>
    </Link>
  );
}

// Five sizes do the visible work: 44 for one figure per screen, 28 titles, 20 headings,
// 16 body and 14 for labels and captions.
const typeStyles = StyleSheet.create({
  hero: {
    fontFamily: fonts.bold,
    fontSize: 44,
    lineHeight: 50,
    letterSpacing: -1,
    fontVariant: ["tabular-nums"],
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: -0.8,
  },
  heading: { fontFamily: fonts.display, fontSize: 20, lineHeight: 28 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24 },
  label: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
});

const styles = StyleSheet.create({
  numeric: { fontFamily: fonts.bold, letterSpacing: 0, fontVariant: ["tabular-nums"] },
  screen: {
    width: "100%",
    maxWidth: 768,
    alignSelf: "center",
    padding: spacing.layout,
    paddingBottom: spacing.layout,
    gap: spacing.layout,
  },
  intro: { gap: spacing.layout },
  panel: {
    padding: spacing.layout,
    borderRadius: radius.panel,
    gap: spacing.md,
  },
  destination: {
    borderRadius: radius.panel,
    padding: spacing.layout,
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.layout,
  },
});
