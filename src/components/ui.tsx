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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, type PropsWithChildren, type Ref } from "react";
import { useTheme } from "../theme/provider";
import { fonts, radius, spacing } from "../theme/tokens";
import type { KinePose } from "../onboarding/kine";
import { KineSplitRow } from "./kine-split-row";
import { Icon, type IconName } from "./icon";

type TextVariant = "body" | "title" | "heading" | "label" | "caption";

export function AppText({
  variant = "body",
  muted = false,
  style,
  ...props
}: TextProps & { variant?: TextVariant; muted?: boolean }) {
  const { colors } = useTheme();
  return (
    <Text
      {...props}
      style={[
        typeStyles[variant],
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
        { backgroundColor: colors.card, borderColor: colors.border },
        style,
      ]}
    />
  );
}

export function Screen({
  title,
  description,
  children,
  pose,
  showTitle = true,
  scrollRef,
  adjustKeyboardInsets = false,
}: PropsWithChildren<{
  title: string;
  description?: string;
  pose?: KinePose;
  showTitle?: boolean;
  scrollRef?: Ref<ScrollView>;
  adjustKeyboardInsets?: boolean;
}>) {
  const { colors } = useTheme();
  return (
    <SafeAreaView
      edges={["left", "right"]}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <Head>
        <title>{title} · KineVault Track</title>
      </Head>
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={adjustKeyboardInsets}
        contentContainerStyle={styles.screen}
      >
        {showTitle && (
          <View style={styles.intro}>
            {pose ? (
              <KineSplitRow pose={pose} testIDPrefix={pose}>
                {(columnWidth) => (
                  <AppText variant="title" accessibilityRole="header" style={columnWidth < 180 ? { fontSize: 24, lineHeight: 32 } : undefined}>
                    {title}
                  </AppText>
                )}
              </KineSplitRow>
            ) : (
              <AppText
                variant="title"
                accessibilityRole="header"
                style={{ flexShrink: 1 }}
              >
                {title}
              </AppText>
            )}
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
  const [focused, setFocused] = useState(false);
  const [pressed, setPressed] = useState(false);
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="link"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        style={StyleSheet.flatten([
          styles.destination,
          {
            borderColor: focused ? colors.ring : colors.border,
            backgroundColor: pressed ? colors.accent : colors.card,
            borderWidth: focused ? 2 : 1,
          },
        ])}
      >
        <Icon name={icon} size={22} color={colors.primary} />
        <View style={{ flex: 1, gap: spacing.xs }}>
          <AppText variant="heading">{title}</AppText>
          {description && <AppText muted>{description}</AppText>}
        </View>
        <Icon name="arrow-right" size={18} color={colors.primary} />
      </Pressable>
    </Link>
  );
}

const typeStyles = StyleSheet.create({
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24 },
  title: {
    fontFamily: fonts.semibold,
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -1.2,
  },
  heading: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 28 },
  label: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 20 },
});

const styles = StyleSheet.create({
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
    borderWidth: 1,
    borderRadius: radius.panel,
    gap: spacing.md,
  },
  destination: {
    borderRadius: radius.panel,
    padding: spacing.layout,
    minHeight: 96,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.layout,
  },
});
