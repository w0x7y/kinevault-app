import { View } from "react-native";
import Animated from "react-native-reanimated";
import { useAppear } from "../components/motion";
import { AppButton } from "../components/button";
import { Icon } from "../components/icon";
import { AppText } from "../components/ui";
import { useTheme } from "../theme/provider";
import { fonts, radius, spacing } from "../theme/tokens";

type Refreshable = {
  refreshError?: string | null;
  saving: boolean;
  retryLoad(): void;
};

/** A slim inline banner: what couldn't refresh, and a quiet retry beside it. */
export function RefreshNotice({ label, document }: { label: string; document: Refreshable }) {
  const { colors } = useTheme();
  const appear = useAppear("fade", { duration: 200 });
  if (!document.refreshError) return null;
  return (
    <Animated.View
      style={[
        {
          width: "100%",
          maxWidth: 768,
          alignSelf: "center",
          paddingHorizontal: spacing.gutter,
          paddingTop: spacing.sm,
        },
        appear,
      ]}
    >
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          gap: spacing.sm,
          paddingVertical: spacing.sm,
          paddingLeft: spacing.md + 2,
          paddingRight: spacing.sm,
          borderRadius: radius.control,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
        }}
      >
        <View
          style={{ flex: 1, flexBasis: 180, flexDirection: "row", gap: spacing.sm, minWidth: 0 }}
        >
          <Icon
            name="circle-exclamation"
            size={16}
            color={colors.danger}
            style={{ marginTop: 1 }}
          />
          <AppText variant="caption" accessibilityRole="alert" style={{ flex: 1 }}>
            <AppText variant="caption" style={{ fontFamily: fonts.bold }}>
              {label}:
            </AppText>{" "}
            {document.refreshError}
          </AppText>
        </View>
        {/* Its own box, so the pill stays centered beside a message that wraps. */}
        <View>
          <AppButton
            size="compact"
            label={`Retry ${label.toLowerCase()}`}
            icon="rotate-right"
            disabled={document.saving}
            onPress={document.retryLoad}
          />
        </View>
      </View>
    </Animated.View>
  );
}
