import { useEffect, useRef, useState, type ReactNode } from "react";
import { View } from "react-native";
import { AppButton } from "./button";
import { Icon } from "./icon";
import { IconWell } from "./icon-well";
import { AppText, Panel } from "./ui";
import { useTheme } from "../theme/provider";
import { radius, spacing } from "../theme/tokens";

/**
 * A saved source that couldn't be read: what failed, as one alert, and a retry for it.
 *
 * - `notice` (default) is a sunken box inside the card or sheet that needed the source.
 * - `panel` is a card of its own with a heading and a `description`, for a source a whole view
 *   depends on.
 *
 * The retry stays busy until `onRetry` settles; extra actions (e.g. a reset) go in `children`.
 */
export function LoadFailure({
  message,
  retryLabel,
  onRetry,
  appearance = "notice",
  description,
  children,
}: {
  /** The exact copy, e.g. "Couldn't load your water goal." */
  message: string;
  /** The retry's label and accessible name, e.g. "Retry water goal". */
  retryLabel: string;
  onRetry: () => void | Promise<void>;
  appearance?: "notice" | "panel";
  description?: string;
  children?: ReactNode;
}) {
  const { colors } = useTheme();
  const retry = <RetryButton label={retryLabel} onRetry={onRetry} />;
  if (appearance === "panel")
    return (
      <Panel style={{ gap: spacing.layout }}>
        <View
          role="alert"
          style={{ flexDirection: "row", gap: spacing.md, alignItems: "flex-start" }}
        >
          <IconWell icon="circle-exclamation" color={colors.danger} size="large" />
          <View style={{ flex: 1, minWidth: 0, gap: spacing.xs }}>
            <AppText variant="heading" accessibilityRole="header">
              {message}
            </AppText>
            {description && (
              <AppText muted style={{ fontSize: 15, lineHeight: 22 }}>
                {description}
              </AppText>
            )}
          </View>
        </View>
        {retry}
        {children}
      </Panel>
    );
  return (
    <View
      style={{
        gap: spacing.md,
        padding: spacing.md + 2,
        borderRadius: radius.control,
        backgroundColor: colors.muted,
      }}
    >
      <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" }}>
        <Icon name="circle-exclamation" size={17} color={colors.error} style={{ marginTop: 1 }} />
        <AppText
          variant="label"
          role="alert"
          accessibilityLiveRegion="assertive"
          style={{ flex: 1, color: colors.error }}
        >
          {message}
        </AppText>
      </View>
      {retry}
      {children}
    </View>
  );
}

/**
 * A retry that stays busy and unavailable until the promise `onRetry` returns settles, then
 * becomes available again. A failed retry is not an unhandled rejection.
 */
export function RetryButton({
  label,
  accessibilityLabel = label,
  onRetry,
}: {
  label: string;
  accessibilityLabel?: string;
  onRetry: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  function retry() {
    let pending: void | Promise<void>;
    try {
      pending = onRetry();
    } catch {
      return;
    }
    // A retry that settles at once (most sources reload in the background) never flashes busy.
    if (!pending) return;
    setBusy(true);
    pending
      // A failed retry leaves the failure in place; the button just becomes available again.
      .catch(() => undefined)
      // A successful retry usually replaces this button.
      .finally(() => {
        if (mounted.current) setBusy(false);
      });
  }
  return (
    <AppButton
      label={label}
      accessibilityLabel={accessibilityLabel}
      icon="rotate-right"
      busy={busy}
      onPress={retry}
    />
  );
}
