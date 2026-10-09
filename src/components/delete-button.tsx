import { useCallback, useEffect, useRef, useState } from "react";
import { AppButton } from "./button";
import { AppText } from "./ui";
import { useTheme } from "../theme/provider";

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

export function DeleteButton({
  label,
  accessibilityLabel = label,
  confirmAccessibilityLabel = "Are you sure?",
  onDelete,
  disabled = false,
  testID,
  hint,
  fill = false,
}: {
  label: string;
  accessibilityLabel?: string;
  confirmAccessibilityLabel?: string;
  onDelete: () => void | Promise<unknown>;
  disabled?: boolean;
  testID?: string;
  hint?: string;
  fill?: boolean;
}) {
  const { colors } = useTheme();
  const { armed, busy, failed, arm, disarm, confirm } = useDeleteConfirmation({
    onDelete,
    disabled,
  });
  return (
    <>
      <AppButton
        testID={testID}
        label={armed ? "Are you sure?" : label}
        accessibilityLabel={armed ? confirmAccessibilityLabel : accessibilityLabel}
        accessibilityHint={hint}
        disabled={disabled || busy}
        busy={busy}
        destructive
        fill={fill}
        onPress={() => (armed ? void confirm() : arm())}
        onBlur={disarm}
      />
      {failed && (
        <AppText accessibilityRole="alert" variant="caption" style={{ color: colors.error }}>
          Couldn't delete. Try again.
        </AppText>
      )}
    </>
  );
}
