import { useState } from "react";
import { Platform, type NativeSyntheticEvent, type TargetedEvent } from "react-native";

/**
 * Tracks focus for drawing a ring. On web a pointer press also focuses, so the ring follows
 * `:focus-visible` and appears only for keyboard focus.
 */
export function useFocusRing(onBlurred?: () => void) {
  const [focused, setFocused] = useState(false);
  return {
    focused,
    onFocus: (event: NativeSyntheticEvent<TargetedEvent>) => {
      const target = event?.target as unknown as { matches?: (selector: string) => boolean };
      setFocused(Platform.OS !== "web" || !target?.matches || target.matches(":focus-visible"));
    },
    onBlur: () => {
      setFocused(false);
      onBlurred?.();
    },
  };
}
