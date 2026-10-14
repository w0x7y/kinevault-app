import { useEffect, useRef, useState } from "react";
import { AppButton } from "../../components/button";

/** A Retry button that stays busy and disabled until `onRetry` settles. */
export function RetryButton({
  accessibilityLabel,
  onRetry,
}: {
  accessibilityLabel: string;
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
  async function retry() {
    setBusy(true);
    try {
      await onRetry();
    } catch {
      // A failed retry leaves the notice in place; the button just becomes available again.
    } finally {
      // A successful retry usually replaces this button.
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <AppButton
      label="Retry"
      accessibilityLabel={accessibilityLabel}
      busy={busy}
      disabled={busy}
      onPress={() => void retry()}
    />
  );
}
