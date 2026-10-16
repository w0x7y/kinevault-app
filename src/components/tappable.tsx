import { Link, type Href } from "expo-router";
import { useState, type ReactNode, type Ref } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type TargetedEvent,
  type View as ViewType,
  type ViewStyle,
} from "react-native";
import Animated from "react-native-reanimated";
import { cssEase, motionDuration, useReducedMotion } from "./motion";
import { useTheme } from "../theme/provider";

export type TappableState = {
  /** A finger, pointer or key is holding the control down. */
  pressed: boolean;
  /** Keyboard focus (on web, `:focus-visible`), which draws the ring. */
  focused: boolean;
};

type StateStyle = StyleProp<ViewStyle> | ((state: TappableState) => StyleProp<ViewStyle>);

/** Every control that shrinks on press uses this one scale. */
const pressedScale = 0.97;
/** Every unavailable control fades to this. */
export const disabledOpacity = 0.45;
/** The smallest touch target, in points. */
const minimumTarget = 44;

/** A Pressable that can take Reanimated CSS transitions (press feedback). */
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Tracks focus for drawing the ring. On web a pointer press also focuses, so the ring follows
 * `:focus-visible` and appears only for keyboard focus.
 */
function useFocusRing(onBlurred?: () => void) {
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

/**
 * The one pressable. It owns the accessible role, name and state, the keyboard focus ring, the
 * pressed state and its feedback, the disabled fade and the 44 pt minimum target; callers draw
 * only what the control looks like.
 *
 * - `feedback`: `scale` shrinks the control while pressed (an eased 120 ms; none under reduced
 *   motion), `fill` gives its surface the pressed accent fill instead (rows, menu entries, text
 *   links), `none` leaves the press unmarked. Every `style` and child function also receives
 *   `pressed`, so a scaling control can still darken its own fill.
 * - `style` is the control. With `surface`, the control is a transparent hit area and `surface`
 *   is the visible shape inside it, which takes the ring, fill and fade; `surfaceHeight` sets a
 *   surface shorter than 44 pt, centered in a 44 pt hit area that the layout sees at the
 *   surface's height.
 * - `ring`: `border` recolors the surface's 2 pt border (transparent until focused), `outline`
 *   draws a ring just outside surfaces whose own border must not change, such as cards.
 * - `eases` lists colors of `style` that ease into a new state (a chip filling as it is chosen)
 *   instead of snapping; nothing eases under reduced motion.
 * - `busy` also makes the control unavailable until the work ends.
 * - `href` makes it a link that opens that route (an anchor on web).
 */
export function Tappable({
  role = "button",
  label,
  hint,
  disabled = false,
  busy = false,
  selected,
  expanded,
  checked,
  current,
  href,
  onPress,
  onPressIn,
  onBlur,
  feedback = "scale",
  ring = "border",
  eases,
  style,
  surface,
  surfaceHeight,
  testID,
  nativeID,
  ref,
  onLayout,
  children,
}: {
  role?: "button" | "link" | "menuitem" | "tab" | "radio" | "checkbox" | "switch";
  /** The accessible name. */
  label: string;
  hint?: string;
  disabled?: boolean;
  busy?: boolean;
  /** A toggle's state: `aria-pressed` on a button, `aria-selected` on a tab. */
  selected?: boolean;
  expanded?: boolean;
  /** A radio, checkbox or switch's state. */
  checked?: boolean;
  /** The entry for the current page or date. */
  current?: "page" | "date";
  href?: Href;
  onPress?: (event: GestureResponderEvent) => void;
  /** For a control that reads where the press began, such as a chart. */
  onPressIn?: (event: GestureResponderEvent) => void;
  /** Called as focus leaves the control, after the ring clears. */
  onBlur?: () => void;
  feedback?: "scale" | "fill" | "none";
  ring?: "border" | "outline";
  eases?: readonly ("backgroundColor" | "borderColor")[];
  style?: StateStyle;
  surface?: StateStyle;
  surfaceHeight?: number;
  testID?: string;
  nativeID?: string;
  ref?: Ref<ViewType>;
  /** The control's frame (the hit area when `surface` is set), e.g. to place an indicator. */
  onLayout?: (event: LayoutChangeEvent) => void;
  children?: ReactNode | ((state: TappableState) => ReactNode);
}) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const focus = useFocusRing(onBlur);
  const [held, setHeld] = useState(false);
  const unavailable = disabled || busy;
  const state = { pressed: held && !unavailable, focused: focus.focused };
  const resolve = (value: StateStyle) => (typeof value === "function" ? value(state) : value);
  const look = [
    ring === "border" && { borderWidth: 2, borderColor: "transparent" },
    resolve(surface ?? style),
    feedback === "fill" && state.pressed && { backgroundColor: colors.accent },
    ring === "border"
      ? state.focused && { borderColor: colors.ring }
      : {
          outlineWidth: state.focused ? 2 : 0,
          outlineStyle: "solid" as const,
          outlineColor: colors.ring,
          outlineOffset: 2,
        },
    unavailable && { opacity: disabledOpacity },
  ];
  const short = surface !== undefined && surfaceHeight !== undefined;
  const scales = feedback === "scale" && !reduced;
  // The scale eases in 120 ms instead of snapping, alongside any `eases` colors.
  const transition = !reduced &&
    (scales || eases !== undefined) && {
      transitionProperty: [...(scales ? (["transform"] as const) : []), ...(eases ?? [])],
      transitionDuration: [
        ...(scales ? [motionDuration.press] : []),
        ...(eases ?? []).map(() => motionDuration.toggle),
      ],
      transitionTimingFunction: cssEase,
    };
  const content = typeof children === "function" ? children(state) : children;
  const pressable = (
    <AnimatedPressable
      ref={ref}
      testID={testID}
      nativeID={nativeID}
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: unavailable, busy, selected, expanded, checked }}
      aria-pressed={role === "button" ? selected : undefined}
      aria-selected={role === "tab" ? selected : undefined}
      aria-checked={checked}
      aria-expanded={expanded}
      aria-busy={busy || undefined}
      aria-current={current}
      disabled={unavailable}
      onPress={onPress}
      onPressIn={(event) => {
        setHeld(true);
        onPressIn?.(event);
      }}
      onPressOut={() => setHeld(false)}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      onLayout={onLayout}
      // Flat: Link's asChild slot rejects style arrays.
      style={StyleSheet.flatten([
        // The ring above replaces the browser's own focus outline.
        {
          minWidth: minimumTarget,
          minHeight: minimumTarget,
          outlineWidth: 0,
          outlineStyle: "solid",
        },
        short && {
          marginVertical: -(minimumTarget - surfaceHeight) / 2,
          justifyContent: "center",
        },
        surface === undefined ? look : resolve(style),
        scales && { transform: [{ scale: state.pressed ? pressedScale : 1 }] },
        transition,
      ])}
    >
      {surface === undefined ? (
        content
      ) : (
        <View style={[short && { minHeight: surfaceHeight }, look]}>{content}</View>
      )}
    </AnimatedPressable>
  );
  return href === undefined ? (
    pressable
  ) : (
    <Link href={href} asChild>
      {pressable}
    </Link>
  );
}
