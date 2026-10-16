import { type PropsWithChildren } from "react";
import { StyleSheet, View, type ViewProps } from "react-native";
import { Icon, type IconName } from "../components/icon";
import { AppText, Overline, Panel } from "../components/ui";
import { useTheme } from "../theme/provider";
import { fonts, radius, spacing } from "../theme/tokens";

/** A card whose overline names the group, so forms read as a few calm sections. */
export function Section({
  title,
  titleRole,
  description,
  children,
  style,
  ...props
}: PropsWithChildren<ViewProps & { title?: string; titleRole?: "header"; description?: string }>) {
  return (
    <Panel {...props} style={[{ gap: spacing.layout }, style]}>
      {(title || description) && (
        <View style={{ gap: spacing.xs }}>
          {title ? <Overline accessibilityRole={titleRole}>{title}</Overline> : null}
          {description ? (
            <AppText variant="caption" muted>
              {description}
            </AppText>
          ) : null}
        </View>
      )}
      {children}
    </Panel>
  );
}

/** A quiet inline badge, such as "Generic" or "Custom" on a search row. */
export function Badge({
  label,
  icon,
  testID,
  tone = "neutral",
}: {
  label?: string;
  icon?: IconName;
  testID?: string;
  tone?: "neutral" | "brand";
}) {
  const { colors } = useTheme();
  const color = tone === "brand" ? colors.brand : colors.mutedForeground;
  return (
    // Badges sit inside result buttons whose accessible names already say what they mark.
    <View
      testID={testID}
      aria-hidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.badge,
        { backgroundColor: tone === "brand" ? colors.brandSoft : colors.muted },
      ]}
    >
      {icon && <Icon name={icon} size={12} color={color} />}
      {label ? <AppText style={[styles.badgeText, { color }]}>{label}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    minHeight: 22,
    borderRadius: radius.pill,
    flexShrink: 0,
  },
  badgeText: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 14 },
});
