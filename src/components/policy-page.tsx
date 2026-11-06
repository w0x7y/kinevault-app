import { router, type Href } from "expo-router";
import type { ReactNode } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppButton } from "./button";
import { AppText, Panel, Screen } from "./ui";
import { ViewHeader } from "./view-header";
import { useTheme } from "../theme/provider";
import { spacing } from "../theme/tokens";

/** A string is a paragraph, an array of strings is a bulleted list, and `href` is a route link. */
export type PolicyBlock = string | string[] | { label: string; href: Href };
export type PolicySection = { title: string; body: PolicyBlock[] };

/** A public page of text, such as the privacy policy: a Back button, a title and its sections. */
export function PolicyPage({
  title,
  intro,
  sections,
}: {
  title: string;
  /** What follows the title. */
  intro: ReactNode;
  sections: PolicySection[];
}) {
  const { colors } = useTheme();
  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <Screen title={title} contentContainerStyle={{ maxWidth: 680 }}>
        <View style={{ minHeight: 44, alignItems: "flex-start" }}>
          <AppButton
            label="Back"
            size="compact"
            icon="chevron-left"
            // Opened from a link, a Health Connect screen or a typed URL, there's nothing to go back to.
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          />
        </View>
        <ViewHeader overline="KineVault Track" title={title}>
          {intro}
        </ViewHeader>
        {sections.map((section) => (
          <Panel key={section.title}>
            <AppText variant="heading" accessibilityRole="header">
              {section.title}
            </AppText>
            {section.body.map((block) =>
              typeof block === "string" ? (
                <AppText key={block}>{block}</AppText>
              ) : Array.isArray(block) ? (
                <View key={block.join()} role="list" style={{ gap: spacing.xs }}>
                  {block.map((item) => (
                    <View
                      key={item}
                      role="listitem"
                      style={{ flexDirection: "row", gap: spacing.sm }}
                    >
                      <AppText aria-hidden>•</AppText>
                      <AppText style={{ flex: 1 }}>{item}</AppText>
                    </View>
                  ))}
                </View>
              ) : (
                <AppButton
                  key={block.label}
                  label={block.label}
                  tone="link"
                  icon="arrow-right"
                  iconAfter
                  href={block.href}
                />
              ),
            )}
          </Panel>
        ))}
      </Screen>
    </SafeAreaView>
  );
}
