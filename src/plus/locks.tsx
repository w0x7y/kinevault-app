import type { ReactNode } from "react";
import { Platform, View } from "react-native";
import { AppButton } from "../components/button";
import { Icon } from "../components/icon";
import { AppText } from "../components/ui";
import { useTheme } from "../theme/provider";
import { fonts, radius, spacing } from "../theme/tokens";
import { limitNotice, type PlusFeature, type PlusLimit } from "./gate";
import { usePaywall } from "./paywall";
import { usePlus } from "./provider";

const hidden =
  Platform.OS === "web"
    ? { "aria-hidden": true }
    : {
        accessibilityElementsHidden: true,
        importantForAccessibility: "no-hide-descendants" as const,
      };

/**
 * The small mark on a locked control, which otherwise looks as usual. It's decorative: the
 * control's name says "part of Plus".
 */
export function PlusTag() {
  const { colors } = useTheme();
  return (
    <View
      {...hidden}
      testID="plus-tag"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        paddingLeft: 6,
        paddingRight: spacing.sm,
        paddingVertical: 2,
        borderRadius: radius.pill,
        backgroundColor: colors.brandSoft,
      }}
    >
      <Icon name="wand-magic-sparkles" size={11} color={colors.brand} />
      <AppText
        style={{
          color: colors.brand,
          fontFamily: fonts.extrabold,
          fontSize: 11,
          lineHeight: 16,
          letterSpacing: 0.2,
        }}
      >
        Plus
      </AppText>
    </View>
  );
}

/**
 * A locked view: the person's own data, faded, under one way to unlock it. `children` draw
 * without controls of their own while locked, since they can't be reached.
 */
export function PlusLocked({
  locked,
  feature,
  message,
  children,
}: {
  locked: boolean;
  feature: PlusFeature;
  message: string;
  children: ReactNode;
}) {
  const paywall = usePaywall();
  if (!locked) return children;
  return (
    // Room for the message and button over a short view.
    <View testID={`plus-locked-${feature}`} style={{ minHeight: 132 }}>
      <View {...hidden} style={{ opacity: 0.28, pointerEvents: "none" }}>
        {children}
      </View>
      <View
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          alignItems: "center",
          justifyContent: "center",
          gap: spacing.sm + 2,
          padding: spacing.md,
        }}
      >
        <AppText variant="label" style={{ textAlign: "center", maxWidth: 260 }}>
          {message}
        </AppText>
        <AppButton
          tone="primary"
          size="compact"
          label="See Plus"
          onPress={() => paywall.open(feature)}
        />
      </View>
      {paywall.sheet}
    </View>
  );
}

/** What's left before Free's limit, from one item before it, with the way past it. */
export function LimitNotice({ limit, count }: { limit: PlusLimit; count: number }) {
  const { colors } = useTheme();
  const { unlocked } = usePlus();
  const paywall = usePaywall();
  const notice = limitNotice(limit, count, unlocked);
  if (!notice) return null;
  return (
    <View
      testID={`plus-limit-${limit}`}
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.sm + 2,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md + 2,
        borderRadius: radius.control,
        backgroundColor: colors.brandSoft,
      }}
    >
      <Icon name="wand-magic-sparkles" size={18} color={colors.brand} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, minWidth: 0, gap: spacing.sm, alignItems: "flex-start" }}>
        <AppText variant="label" style={{ fontFamily: fonts.medium }}>
          <AppText variant="label" style={{ fontFamily: fonts.bold }}>
            {notice.lead}
          </AppText>{" "}
          {notice.detail}
        </AppText>
        <AppButton size="small" label="See Plus" onPress={() => paywall.open(limit)} />
      </View>
      {paywall.sheet}
    </View>
  );
}
