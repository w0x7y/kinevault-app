import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type PropsWithChildren,
  type Ref,
  type RefObject,
} from "react";
import {
  BackHandler,
  Platform,
  StyleSheet,
  type StyleProp,
  type View,
  type ViewProps,
  type ViewStyle,
} from "react-native";
import Animated from "react-native-reanimated";
import { cssEase, motionDuration, useReducedMotion } from "./motion";
import { useTheme } from "../theme/provider";

type Anchor = RefObject<View | null>;

/** On web a View's ref is its DOM element. */
const element = (anchor: Anchor) => anchor.current as unknown as HTMLElement | null;

/**
 * Dismissal for a popover that hangs from `trigger` (a menu, a list of choices, the calendar):
 * while `open`, Escape (web) and Android Back call `onDismiss`, and Escape returns focus to the
 * trigger if focus was in the popover or on its trigger. With `lightDismiss` (the default) a
 * pointer press or keyboard focus outside both `container` and `trigger` dismisses it as well
 * (web); native callers draw their own backdrop for that. `lightDismiss: false` keeps a panel
 * open while the person works elsewhere on the page.
 *
 * `close` dismisses and returns focus to the trigger, e.g. after choosing an option.
 */
export function usePopover({
  open,
  onDismiss,
  trigger,
  container,
  lightDismiss = true,
}: {
  open: boolean;
  onDismiss: () => void;
  trigger: Anchor;
  container: Anchor;
  lightDismiss?: boolean;
}) {
  const dismiss = useRef(onDismiss);
  useLayoutEffect(() => {
    dismiss.current = onDismiss;
  });
  const refocus = useCallback(() => {
    if (Platform.OS === "web") element(trigger)?.focus();
  }, [trigger]);
  useEffect(() => {
    if (!open) return;
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      dismiss.current();
      return true;
    });
    if (Platform.OS !== "web") return () => back.remove();
    const inside = (target: EventTarget | null) =>
      target instanceof Node &&
      Boolean(element(container)?.contains(target) || element(trigger)?.contains(target));
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      const focused = document.activeElement;
      const held = !focused || focused === document.body || inside(focused);
      dismiss.current();
      if (held) refocus();
    };
    const onOutside = (event: Event) => {
      if (!inside(event.target)) dismiss.current();
    };
    document.addEventListener("keydown", onKeyDown);
    if (lightDismiss) {
      document.addEventListener("pointerdown", onOutside);
      document.addEventListener("focusin", onOutside);
    }
    return () => {
      back.remove();
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onOutside);
      document.removeEventListener("focusin", onOutside);
    };
  }, [open, lightDismiss, trigger, container, refocus]);
  return {
    close: useCallback(() => {
      dismiss.current();
      refocus();
    }, [refocus]),
  };
}

const entrance = {
  from: { opacity: 0, transform: [{ scale: 0.96 }] },
  to: { opacity: 1, transform: [{ scale: 1 }] },
} as const;

/**
 * The raised surface of a popover: elevated fill, hairline border and the one popover shadow.
 * It fades and scales up from 0.96 out of `origin`, the side that meets its trigger, in 180 ms
 * (none under reduced motion); closing is instant. Callers set its position, size and radius.
 */
export function PopoverSurface({
  origin,
  style,
  ref,
  children,
  ...props
}: PropsWithChildren<
  {
    origin: "top" | "top left" | "top right" | "center";
    style?: StyleProp<ViewStyle>;
    ref?: Ref<View>;
  } & Pick<
    ViewProps,
    "nativeID" | "accessibilityRole" | "accessibilityLabel" | "accessibilityViewIsModal"
  >
>) {
  const { colors, appearance } = useTheme();
  const reduced = useReducedMotion();
  return (
    <Animated.View
      ref={ref}
      {...props}
      style={[
        {
          backgroundColor: colors.elevated,
          borderColor: colors.border,
          borderWidth: StyleSheet.hairlineWidth,
          boxShadow:
            appearance === "dark"
              ? "0px 16px 40px rgba(0, 0, 0, 0.5)"
              : "0px 2px 6px rgba(22, 24, 28, 0.05), 0px 16px 40px rgba(22, 24, 28, 0.14)",
        },
        style,
        !reduced && {
          animationName: entrance,
          animationDuration: motionDuration.toggle,
          animationTimingFunction: cssEase,
          transformOrigin: origin,
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
