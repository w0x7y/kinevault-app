import { useEffect, useRef, useState } from "react";
import { Pressable } from "react-native";
import { AppText } from "./ui";
import { useTheme } from "../theme/provider";
import { radius, spacing } from "../theme/tokens";

export function DeleteButton({ label, accessibilityLabel = label, confirmAccessibilityLabel = "Are you sure?", onDelete, disabled = false, testID, hint }: {
  label: string;
  accessibilityLabel?: string;
  confirmAccessibilityLabel?: string;
  onDelete: () => void | Promise<unknown>;
  disabled?: boolean;
  testID?: string;
  hint?: string;
}) {
  const { colors } = useTheme();
  const [armed, setArmed] = useState(false);
  const [focused, setFocused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const pending = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function press() {
    if (disabled || pending.current) return;
    if (!armed) { setArmed(true); return; }
    pending.current = true; setBusy(true); setFailed(false);
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
  return <>
    <Pressable testID={testID} accessibilityRole="button"
    accessibilityLabel={armed ? confirmAccessibilityLabel : accessibilityLabel} accessibilityHint={hint}
    accessibilityState={{ disabled: disabled || busy }} disabled={disabled || busy}
    onPress={() => { void press(); }} onFocus={() => setFocused(true)}
    onBlur={() => { setFocused(false); setArmed(false); }}
    style={({ pressed }) => ({ minHeight: 44, padding: spacing.layout, borderWidth: 1,
      borderRadius: radius.control, borderColor: focused ? colors.ring : colors.destructive,
      backgroundColor: colors.destructive, justifyContent: "center", opacity: disabled || busy ? 0.5 : pressed ? 0.8 : 1 })}>
    <AppText variant="label" style={{ color: colors.destructiveForeground, textAlign: "center" }}>{armed ? "Are you sure?" : label}</AppText>
    </Pressable>
    {failed && <AppText accessibilityRole="alert" variant="caption" style={{ color: colors.error }}>Couldn't delete. Try again.</AppText>}
  </>;
}
