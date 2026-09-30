import { ArrowRight, type LucideIcon } from "lucide-react-native";
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
import { useState, type PropsWithChildren } from "react";
import { useTheme } from "../theme/provider";
import { fonts, radius, spacing } from "../theme/tokens";
import { Kine, type KinePose } from "../onboarding/kine";

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
}: PropsWithChildren<{
  title: string;
  description?: string;
  pose?: KinePose;
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
      <ScrollView contentContainerStyle={styles.screen}>
        <View style={styles.intro}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 16,
            }}
          >
            <AppText
              variant="title"
              accessibilityRole="header"
              style={{ flexShrink: 1 }}
            >
              {title}
            </AppText>
            {pose && <Kine pose={pose} size={144} />}
          </View>
          {description && (
            <AppText muted style={{ maxWidth: 600 }}>
              {description}
            </AppText>
          )}
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Destination({
  href,
  title,
  description,
  icon: Icon,
}: {
  href: Href;
  title: string;
  description?: string;
  icon: LucideIcon;
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
        <Icon size={22} color={colors.primary} aria-hidden={true} />
        <View style={{ flex: 1, gap: spacing.xs }}>
          <AppText variant="heading">{title}</AppText>
          {description && <AppText muted>{description}</AppText>}
        </View>
        <ArrowRight size={18} color={colors.primary} aria-hidden={true} />
      </Pressable>
    </Link>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
}: PropsWithChildren<{
  icon: LucideIcon;
  title: string;
  description: string;
}>) {
  const { colors } = useTheme();
  return (
    <Panel style={styles.empty}>
      <Icon
        size={36}
        strokeWidth={1.4}
        color={colors.mutedForeground}
        aria-hidden={true}
      />
      <AppText
        variant="heading"
        accessibilityRole="header"
        style={{ textAlign: "center" }}
      >
        {title}
      </AppText>
      <AppText muted style={{ textAlign: "center", maxWidth: 400 }}>
        {description}
      </AppText>
      {children}
    </Panel>
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
    padding: spacing.panel,
    paddingBottom: 64,
    gap: spacing.panel,
  },
  intro: { gap: spacing.md, marginBottom: spacing.sm },
  panel: {
    padding: spacing.panel,
    borderWidth: 1,
    borderRadius: radius.panel,
    gap: spacing.md,
  },
  destination: {
    borderRadius: radius.panel,
    padding: spacing.xl,
    minHeight: 96,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  empty: {
    minHeight: 280,
    borderStyle: "dashed",
    borderRadius: radius.largePanel,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.lg,
  },
});
