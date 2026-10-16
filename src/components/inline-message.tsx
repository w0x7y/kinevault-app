import Animated from "react-native-reanimated";
import { Icon, type IconName } from "./icon";
import { useLayoutMotion } from "./motion";
import { AppText } from "./ui";
import { useTheme } from "../theme/provider";
import { fonts } from "../theme/tokens";

type MessageTone = "error" | "success" | "info";

const icons: Record<MessageTone, IconName> = {
  error: "circle-exclamation",
  success: "check",
  info: "circle-info",
};

/**
 * One line of feedback, placed directly under what it describes: an error, a confirmation of a
 * save that stays on the same view, or a neutral note. An error is one alert; a success or note
 * is a polite status. It fades in where it appears (still under reduced motion), so content it
 * pushes down doesn't jump. The role, live region and `testID` sit on the text itself, so the
 * message node holds only its words. Renders nothing without a message, so callers can pass a nullable
 * error straight through.
 */
export function InlineMessage({
  tone = "error",
  align = "start",
  testID,
  children,
}: {
  tone?: MessageTone;
  /** `center` for a message under centered content, such as a large figure. */
  align?: "start" | "center";
  testID?: string;
  children: string | null | undefined | false;
}) {
  const { colors } = useTheme();
  const { fade } = useLayoutMotion();
  if (!children) return null;
  const error = tone === "error";
  return (
    <Animated.View
      entering={fade}
      style={{
        flexDirection: "row",
        gap: 6,
        alignItems: "flex-start",
        alignSelf: align === "center" ? "center" : "stretch",
      }}
    >
      <Icon
        name={icons[tone]}
        size={15}
        color={error ? colors.error : tone === "success" ? colors.success : colors.mutedForeground}
        style={{ marginTop: 1.5 }}
      />
      <AppText
        testID={testID}
        role={error ? "alert" : "status"}
        accessibilityLiveRegion={error ? "assertive" : "polite"}
        variant="caption"
        muted={tone === "info"}
        style={[
          { flexShrink: 1 },
          error && { color: colors.error },
          tone === "success" && { fontFamily: fonts.semibold },
          align === "center" && { textAlign: "center" },
        ]}
      >
        {children}
      </AppText>
    </Animated.View>
  );
}
