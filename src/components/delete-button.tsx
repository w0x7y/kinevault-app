import { useCallback, useEffect, useRef, useState } from "react";
import { AppButton } from "./button";
import { Icon, type IconName } from "./icon";
import { Tappable } from "./tappable";
import { AppText } from "./ui";
import { useTheme } from "../theme/provider";
import { fonts, radius, spacing } from "../theme/tokens";
import { InlineMessage } from "./inline-message";

/**
 * Arm, then confirm. `onDelete` throwing counts as a failure; resolving `false` means the
 * deletion didn't happen and the caller reported why, so it stays armed for another try.
 */
export function useDeleteConfirmation({
  onDelete,
  disabled = false,
}: {
  onDelete: () => void | Promise<unknown>;
  disabled?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const pending = useRef(false),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  function arm() {
    if (disabled || pending.current) return;
    setArmed(true);
  }
  const cancel = useCallback(() => {
    if (pending.current) return;
    setArmed(false);
    setFailed(false);
  }, []);
  const disarm = useCallback(() => setArmed(false), []);
  async function confirm() {
    if (!armed || disabled || pending.current) return;
    pending.current = true;
    setBusy(true);
    setFailed(false);
    try {
      const result = await onDelete();
      if (mounted.current && result !== false) setArmed(false);
    } catch {
      if (mounted.current) setFailed(true);
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return { armed, busy, failed, arm, cancel, disarm, confirm };
}

/**
 * The one delete control. The first press arms it: the same control turns into a filled red
 * "Are you sure?" that confirms, named by `confirmAccessibilityLabel`. Leaving it disarms. A
 * failed deletion stays armed under a short alert.
 *
 * `appearance`: `button` is red text on a soft red fill at the regular size, `pill` the same on
 * a 44 pt pill for a row, and `icon` a quiet 44 pt icon (named by `label`; a trash can unless
 * `icon` says otherwise) whose armed state is the red pill.
 */
export function DeleteButton({
  label,
  accessibilityLabel = label,
  confirmAccessibilityLabel = "Are you sure?",
  onDelete,
  disabled = false,
  appearance = "button",
  icon,
  iconSize = 18,
  hint,
  fill = false,
  testID,
}: {
  label: string;
  accessibilityLabel?: string;
  confirmAccessibilityLabel?: string;
  onDelete: () => void | Promise<unknown>;
  disabled?: boolean;
  appearance?: "button" | "pill" | "icon";
  /** Shown beside the label until armed; the `icon` appearance's glyph, a trash can by default. */
  icon?: IconName;
  /** The `icon` appearance's glyph size. */
  iconSize?: number;
  hint?: string;
  fill?: boolean;
  testID?: string;
}) {
  const { colors } = useTheme();
  const { armed, busy, failed, arm, disarm, confirm } = useDeleteConfirmation({
    onDelete,
    disabled,
  });
  const name = armed ? confirmAccessibilityLabel : accessibilityLabel;
  const press = () => (armed ? void confirm() : arm());
  return (
    <>
      {appearance === "icon" ? (
        <Tappable
          testID={testID}
          label={name}
          hint={hint}
          disabled={disabled}
          busy={busy}
          onPress={press}
          onBlur={disarm}
          style={({ pressed }) => ({
            height: 44,
            paddingHorizontal: armed ? spacing.md + 2 : 0,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: radius.pill,
            backgroundColor: armed ? colors.destructive : pressed ? colors.accent : "transparent",
          })}
        >
          {armed ? (
            <AppText
              variant="label"
              style={{ color: colors.destructiveForeground, fontFamily: fonts.bold }}
            >
              Are you sure?
            </AppText>
          ) : (
            <Icon name={icon ?? "trash-can"} size={iconSize} color={colors.mutedForeground} />
          )}
        </Tappable>
      ) : (
        <AppButton
          testID={testID}
          label={armed ? "Are you sure?" : label}
          accessibilityLabel={name}
          accessibilityHint={hint}
          disabled={disabled}
          busy={busy}
          tone={armed ? "destructive" : "danger"}
          size={appearance === "pill" ? "compact" : "regular"}
          icon={armed ? undefined : icon}
          fill={fill}
          onPress={press}
          onBlur={disarm}
        />
      )}
      {failed && <InlineMessage>Couldn't delete. Try again.</InlineMessage>}
    </>
  );
}
