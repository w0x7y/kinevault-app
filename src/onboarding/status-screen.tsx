import type { PropsWithChildren, ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon, type IconName } from "../components/icon";
import { AppText, DocumentTitle } from "../components/ui";
import { useTheme } from "../theme/provider";
import { spacing } from "../theme/tokens";
import { KineStage, type KinePose } from "./kine";

/**
 * The calm full-screen layout shared by auth links, recovery, not-found and data
 * errors: an icon well (or Kine), a serif headline, a muted line, then one card and
 * one primary action supplied by the caller.
 */
export function StatusScreen({
  icon,
  kine,
  tone = "brand",
  title,
  titleRole = "header",
  message,
  documentTitle,
  children,
}: PropsWithChildren<{
  icon?: IconName;
  kine?: KinePose;
  tone?: "brand" | "success" | "danger";
  title: string;
  /** Errors that replace a screen announce themselves through the headline. */
  titleRole?: "header" | "alert";
  message?: ReactNode;
  documentTitle?: string;
}>) {
  const { colors } = useTheme();
  const accent =
    tone === "success" ? colors.success : tone === "danger" ? colors.error : colors.brand;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {documentTitle && <DocumentTitle title={documentTitle} />}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            alignSelf: "center",
            width: "100%",
            maxWidth: 480,
            paddingHorizontal: spacing.gutter,
            paddingVertical: spacing.xl,
            gap: spacing.lg,
          }}
        >
          <View style={{ alignItems: "center", gap: spacing.md }}>
            {kine ? (
              <KineStage size={120} pose={kine} />
            ) : (
              icon && (
                <View
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: tone === "brand" ? colors.brandSoft : colors.muted,
                  }}
                >
                  <Icon name={icon} size={28} color={accent} />
                </View>
              )
            )}
            <View style={{ alignItems: "center", gap: spacing.xs }}>
              <AppText
                variant="title"
                accessibilityRole={titleRole}
                style={{ textAlign: "center" }}
              >
                {title}
              </AppText>
              {typeof message === "string" ? (
                <AppText muted style={{ textAlign: "center" }}>
                  {message}
                </AppText>
              ) : (
                message
              )}
            </View>
          </View>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
