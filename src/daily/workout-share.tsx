import { Image } from "expo-image";
import { useEffect, useEffectEvent, useRef, useState, type Ref } from "react";
import { View, type ViewInstance } from "react-native";
import { AppButton } from "../components/button";
import { Icon } from "../components/icon";
import { InlineMessage } from "../components/inline-message";
import { AppText, Overline, Panel } from "../components/ui";
import { kineAssets } from "../onboarding/kine-assets";
import { LightTheme } from "../theme/provider";
import { fonts, lightColors as colors, spacing } from "../theme/tokens";
import type { WorkoutShare as ShareText } from "./activity";
import { shareImage } from "./share-image";

/** The image's layout in points, 4:5; the capture scales it to 1080 × 1350 pixels. */
const layout = { width: 432, height: 540 };

/**
 * The detailed Workout card's Share action. It draws the share image out of sight, waits for
 * Kine, then opens the share sheet with a PNG. Hidden where images can't be shared (web).
 */
export function WorkoutShare({ share }: { share: ShareText }) {
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const card = useRef<ViewInstance>(null);
  if (!shareImage) return null;
  const send = shareImage;
  async function capture() {
    try {
      await send(card.current, "Share your workout");
    } catch {
      setError("Couldn't share your workout. Try again.");
    } finally {
      setSharing(false);
    }
  }
  return (
    <>
      <AppButton
        icon="arrow-up-from-bracket"
        label={sharing ? "Sharing…" : "Share workout"}
        accessibilityHint="Shares a summary image of this workout"
        busy={sharing}
        onPress={() => {
          setError(null);
          setSharing(true);
        }}
      />
      <InlineMessage>{error}</InlineMessage>
      {sharing && <ShareCard ref={card} share={share} onReady={() => void capture()} />}
    </>
  );
}

/** The share image: the light palette and fixed text sizes, whatever the app's settings. */
function ShareCard({
  share,
  ref,
  onReady,
}: {
  share: ShareText;
  ref: Ref<ViewInstance>;
  onReady: () => void;
}) {
  const ready = useRef(false);
  const display = () => {
    if (ready.current) return;
    ready.current = true;
    onReady();
  };
  // Capture anyway if Kine never reports, so the button can't stay on "Sharing…".
  const fallback = useEffectEvent(display);
  useEffect(() => {
    const timer = setTimeout(fallback, 3000);
    return () => clearTimeout(timer);
  }, []);
  return (
    <LightTheme>
      <View
        ref={ref}
        collapsable={false}
        aria-hidden
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          // Out of sight, but laid out and drawn, so it can be captured.
          position: "absolute",
          left: -10000,
          top: 0,
          ...layout,
          padding: 18,
          gap: spacing.md,
          backgroundColor: colors.background,
        }}
      >
        <Panel style={{ flex: 1, padding: 22, gap: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.md }}>
            <View style={{ flex: 1, minWidth: 0, gap: spacing.xs, paddingTop: spacing.sm }}>
              <Overline allowFontScaling={false}>{share.date}</Overline>
              <AppText allowFontScaling={false} variant="title" numberOfLines={2}>
                {share.name}
              </AppText>
            </View>
            <View style={{ width: 84, height: 84 }}>
              <View
                style={{
                  position: "absolute",
                  left: 6,
                  top: 7,
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  backgroundColor: colors.brandSoft,
                }}
              />
              <Image
                source={kineAssets.review}
                contentFit="contain"
                transition={0}
                onDisplay={display}
                onError={display}
                style={{ width: 84, height: 84 }}
              />
            </View>
          </View>
          <View
            style={{
              flexDirection: "row",
              paddingTop: spacing.md,
              borderTopWidth: 1,
              borderColor: colors.border,
            }}
          >
            {share.stats.map(({ label, value }, index) => (
              <View
                key={label}
                style={{
                  flex: 1,
                  gap: 2,
                  paddingLeft: index ? spacing.md : 0,
                  borderLeftWidth: index ? 1 : 0,
                  borderColor: colors.border,
                }}
              >
                <AppText allowFontScaling={false} variant="caption" muted>
                  {label}
                </AppText>
                <AppText
                  allowFontScaling={false}
                  variant="heading"
                  numberOfLines={1}
                  style={{ fontFamily: fonts.extrabold, fontSize: 20, lineHeight: 26 }}
                >
                  {value}
                </AppText>
              </View>
            ))}
          </View>
          <ShareSection title="Exercises" list={share.exercises} />
          {share.records.lines.length > 0 && (
            <ShareSection title="Personal records" list={share.records} records />
          )}
        </Panel>
        <AppText
          allowFontScaling={false}
          style={{
            fontFamily: fonts.display,
            fontSize: 15,
            lineHeight: 20,
            textAlign: "center",
            color: colors.primary,
          }}
        >
          KineVault Track
        </AppText>
      </View>
    </LightTheme>
  );
}

/** An overline and one line per item, split by hairlines; records are green with a trophy. */
function ShareSection({
  title,
  list,
  records = false,
}: {
  title: string;
  list: ShareText["exercises"];
  records?: boolean;
}) {
  const color = records ? colors.success : colors.foreground;
  return (
    <View>
      <Overline allowFontScaling={false} style={{ marginBottom: spacing.xs }}>
        {title}
      </Overline>
      {list.lines.map(({ name, figure }, index) => (
        <View
          key={index}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            paddingVertical: 4,
            borderTopWidth: index ? 1 : 0,
            borderColor: colors.border,
          }}
        >
          {records && <Icon allowFontScaling={false} name="trophy" size={15} color={color} />}
          <AppText
            allowFontScaling={false}
            variant="label"
            numberOfLines={1}
            style={{ flex: 1, color }}
          >
            {name}
          </AppText>
          <AppText
            allowFontScaling={false}
            variant="label"
            numberOfLines={1}
            style={{ flexShrink: 0, color, fontFamily: fonts.bold, fontVariant: ["tabular-nums"] }}
          >
            {figure}
          </AppText>
        </View>
      ))}
      {list.more && (
        <AppText allowFontScaling={false} variant="caption" muted style={{ paddingTop: 4 }}>
          {list.more}
        </AppText>
      )}
    </View>
  );
}
