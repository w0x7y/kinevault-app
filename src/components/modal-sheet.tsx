import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { Modal, Platform, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { clampedEasing, motionEase, useReducedMotion } from "./motion";
import { AppText, Overline } from "./ui";
import { useTheme } from "../theme/provider";
import { radius, spacing } from "../theme/tokens";

/** The iOS sheet curve: a quick start that settles without overshooting the screen edge. */
const sheetEase = clampedEasing(Easing.bezier(0.32, 0.72, 0, 1));
const ease = clampedEasing(motionEase);

const firstControl =
  'input:not([disabled]), textarea:not([disabled]), [role="button"]:not([aria-disabled="true"])';

type Header = { title: string; overline?: string; description?: string };

/**
 * A small modal task over the current screen: a bottom sheet on phones (under 600 pt wide) and
 * a centered dialog on wider windows. The dialog is named by `title`, which it also shows as its
 * heading, with an optional `overline` above and `description` below.
 *
 * `open` drives its presence. Opening, the backdrop fades in while the sheet rises by its own
 * height or the dialog floats in from 0.96; closing, from any cause, plays that back in 200 ms
 * with the last open content and heading, then unmounts and calls `onClosed`. Reduced motion
 * shows and removes it at once. Escape (web) and Android Back call `onDismiss`, unless
 * `dismissDisabled` (e.g. while a save is in flight) or it is already closing; tapping the
 * backdrop does nothing. On web, focus moves to its first available control as it opens and
 * returns to the control that opened it once it has gone (the Modal's own restore).
 */
export function ModalSheet({
  open,
  title,
  overline,
  description,
  onDismiss,
  onClosed,
  dismissDisabled = false,
  testID,
  children,
}: PropsWithChildren<
  Header & {
    open: boolean;
    /** Escape or Android Back asked to close. The caller decides by setting `open`. */
    onDismiss: () => void;
    /** It has finished leaving and unmounted, e.g. to hand over to a picker or a parent. */
    onClosed?: () => void;
    dismissDisabled?: boolean;
    testID?: string;
  }
>) {
  const { colors, appearance } = useTheme();
  const { width, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Phones get a bottom sheet; wider windows keep a centered dialog.
  const sheet = width < 600;
  const presence = usePresence(open, sheet, windowHeight, onClosed);
  const surface = useRef<View>(null);
  // While leaving, it keeps showing what it showed last while open.
  const shown = useRef<Header & { children: typeof children }>({ title, children });
  if (open) shown.current = { title, overline, description, children };
  if (!presence.rendered) return null;
  const content = shown.current;
  return (
    <Modal
      transparent
      visible
      animationType="none"
      accessibilityLabel={content.title}
      onShow={() => {
        // The Modal's own focus trap can land on the scroll view while the sheet is still
        // below the screen, so the first control is focused here.
        if (Platform.OS === "web")
          (surface.current as unknown as HTMLElement | null)
            ?.querySelector<HTMLElement>(firstControl)
            ?.focus();
      }}
      onRequestClose={() => {
        if (open && !dismissDisabled) onDismiss();
      }}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor:
              appearance === "dark" ? "rgba(0, 0, 0, 0.6)" : "rgba(14, 15, 17, 0.42)",
          },
          presence.backdropStyle,
        ]}
      />
      <SafeAreaView
        edges={sheet ? ["top", "left", "right"] : undefined}
        pointerEvents={open ? "auto" : "none"}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: sheet ? "flex-end" : "center",
            alignItems: "center",
            padding: sheet ? 0 : spacing.lg,
            paddingTop: sheet ? spacing.xl : spacing.lg,
          }}
        >
          <Animated.View
            ref={surface}
            testID={testID}
            accessibilityViewIsModal
            onLayout={presence.onSurfaceLayout}
            style={[
              styles.surface,
              {
                maxWidth: sheet ? undefined : 520,
                paddingTop: sheet ? spacing.md : spacing.lg + 4,
                paddingBottom: sheet ? spacing.xl + insets.bottom : spacing.lg + 4,
                backgroundColor: colors.elevated,
                borderColor: colors.border,
                borderBottomWidth: sheet ? 0 : StyleSheet.hairlineWidth,
                borderBottomLeftRadius: sheet ? 0 : 28,
                borderBottomRightRadius: sheet ? 0 : 28,
              },
              presence.surfaceStyle,
            ]}
          >
            {sheet && (
              <View aria-hidden style={[styles.grabber, { backgroundColor: colors.input }]} />
            )}
            <View style={styles.header}>
              {content.overline !== undefined && <Overline>{content.overline}</Overline>}
              <AppText variant="title" accessibilityRole="header">
                {content.title}
              </AppText>
              {content.description !== undefined && (
                <AppText variant="caption" muted style={{ marginTop: 2 }}>
                  {content.description}
                </AppText>
              )}
            </View>
            {content.children}
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

/**
 * Whether the sheet is on screen, and its arrival and departure. A sheet waits for its height
 * so it rises exactly that far; a dialog starts at once. Closing keeps it rendered until the
 * departure ends.
 */
function usePresence(
  open: boolean,
  sheet: boolean,
  windowHeight: number,
  onClosed: (() => void) | undefined,
) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);
  // Until the sheet is measured it waits a full window below the screen.
  const surfaceHeight = useSharedValue(0);
  const [wasOpen, setWasOpen] = useState(open);
  const [leaving, setLeaving] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    setLeaving(!open && !reduced);
  }
  const closed = useRef(onClosed);
  useLayoutEffect(() => {
    closed.current = onClosed;
  });
  const shownOnce = useRef(false);
  const entering = useRef(false);
  const enter = useCallback(() => {
    if (entering.current) return;
    entering.current = true;
    progress.set(
      withTiming(1, {
        duration: sheet ? 300 : 200,
        easing: sheet ? sheetEase : ease,
        reduceMotion: ReduceMotion.Never,
      }),
    );
  }, [progress, sheet]);
  useEffect(() => {
    if (!open) return;
    shownOnce.current = true;
    if (reduced) {
      cancelAnimation(progress);
      progress.set(1);
    } else if (!sheet || surfaceHeight.get() > 0) enter();
  }, [open, reduced, sheet, progress, surfaceHeight, enter]);
  useEffect(() => {
    if (open) return;
    entering.current = false;
    if (leaving) {
      progress.set(
        withTiming(0, { duration: 200, easing: ease, reduceMotion: ReduceMotion.Never }, (done) => {
          if (done) scheduleOnRN(setLeaving, false);
        }),
      );
      return;
    }
    cancelAnimation(progress);
    progress.set(0);
    surfaceHeight.set(0);
    if (!shownOnce.current) return;
    shownOnce.current = false;
    closed.current?.();
  }, [open, leaving, progress, surfaceHeight]);
  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.get() }));
  const surfaceStyle = useAnimatedStyle(() => {
    const shown = progress.get();
    return sheet
      ? { transform: [{ translateY: (1 - shown) * (surfaceHeight.get() || windowHeight) }] }
      : { opacity: shown, transform: [{ scale: 0.96 + 0.04 * shown }] };
  }, [sheet, windowHeight]);
  return {
    rendered: open || leaving,
    backdropStyle: reduced ? undefined : backdropStyle,
    surfaceStyle: reduced ? undefined : surfaceStyle,
    onSurfaceLayout: ({ nativeEvent }: { nativeEvent: { layout: { height: number } } }) => {
      surfaceHeight.set(nativeEvent.layout.height);
      if (open && !reduced) enter();
    },
  };
}

const styles = StyleSheet.create({
  surface: {
    width: "100%",
    gap: spacing.md + 2,
    paddingHorizontal: spacing.lg + 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  grabber: {
    width: 40,
    height: 5,
    borderRadius: radius.pill,
    alignSelf: "center",
    marginBottom: spacing.sm,
  },
  header: { gap: spacing.xs, marginBottom: 2 },
});
