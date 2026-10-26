import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { View } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  LayoutAnimationConfig,
  ReduceMotion,
  measure as measureView,
  scrollTo,
  useAnimatedRef,
  useAnimatedStyle,
  useFrameCallback,
  useScrollOffset,
  useSharedValue,
  withTiming,
  type AnimatedRef,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { Chip } from "../components/chip";
import { Icon } from "../components/icon";
import {
  clampedEasing,
  cssEaseInOut,
  motionDuration,
  motionEase,
  useLayoutMotion,
  useReducedMotion,
} from "../components/motion";
import { Tappable } from "../components/tappable";
import { useTheme } from "../theme/provider";
import { radius, spacing } from "../theme/tokens";
import { exerciseRowLabel, shortExerciseName, type WorkspaceExercise } from "./short-name";

/** Edit mode on the bar: tiles ask to be removed, move to a new position, and end in Add. */
export type ExerciseBarEditing = {
  /** The tile's X: the caller confirms, then removes the row. */
  onRemove: (id: string) => void;
  onMove: (id: string, to: number) => void;
  onAdd: () => void;
};

/** Exercise pills in a horizontal scroller, fading out at either edge while more lie past it. */
export function ExerciseBar({
  exercises,
  selectedId,
  onSelect,
  editing,
  busy,
}: {
  exercises: readonly WorkspaceExercise[];
  selectedId?: string;
  onSelect: (id: string) => void;
  editing?: ExerciseBarEditing;
  busy: boolean;
}) {
  const { fade } = useLayoutMotion();
  // The tile being dragged; the bar holds still under it.
  const [dragging, setDragging] = useState<string | null>(null);
  // Scrolling reports ~30 times a second; only the fades' flags re-render the chips.
  const bar = useRef({ width: 0, contentWidth: 0, offset: 0 });
  const [before, setBefore] = useState(false);
  const [after, setAfter] = useState(false);
  const measure = (next: Partial<typeof bar.current>) => {
    const { width, contentWidth, offset } = Object.assign(bar.current, next);
    setBefore(offset > 4);
    setAfter(contentWidth - width - offset > 4);
  };
  // Back and Next can pick an exercise whose chip sits off screen; bring it into view.
  const reduced = useReducedMotion();
  const scroller = useAnimatedRef<Animated.ScrollView>();
  const tiles = useRef(new Map<string, TileFrame>());
  // A tile dragged into either end of the bar scrolls it that way; see BarTile.
  const scroll: BarScroll = {
    ref: scroller,
    offset: useScrollOffset(scroller),
    target: useSharedValue(0),
    edge: useSharedValue(0),
  };
  const contentWidth = useSharedValue(0);
  const autoScroll = useFrameCallback(({ timeSincePreviousFrame }) => {
    const edge = scroll.edge.get();
    const frame = edge && measureView(scroller);
    if (!frame) return;
    const end = Math.max(0, contentWidth.get() - frame.width);
    const next = Math.min(
      end,
      Math.max(0, scroll.target.get() + edge * edgeSpeed * (timeSincePreviousFrame ?? 16)),
    );
    if (next === scroll.target.get()) return;
    scroll.target.set(next);
    scrollTo(scroller, next, 0, false);
  }, false);
  useEffect(() => autoScroll.setActive(dragging !== null), [autoScroll, dragging]);
  const reveal = useCallback(
    (x: number, animated: boolean) =>
      scroller.current?.scrollTo({ x: Math.max(0, x - 2 * spacing.card), animated }),
    [scroller],
  );
  useEffect(() => {
    const x = selectedId === undefined ? undefined : tiles.current.get(selectedId)?.x;
    if (x !== undefined) reveal(x, !reduced);
  }, [selectedId, reduced, reveal]);
  return (
    <View testID="exercise-topbar-frame" style={{ minWidth: 0, marginHorizontal: -spacing.card }}>
      {/* Its own root, so the tiles' drag also works inside the sheet's Modal on Android. */}
      <GestureHandlerRootView style={{ minWidth: 0 }}>
        <Animated.ScrollView
          ref={scroller}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          testID="exercise-topbar"
          horizontal
          scrollEnabled={dragging === null}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={32}
          onLayout={(event) => measure({ width: event.nativeEvent.layout.width })}
          onContentSizeChange={(width) => {
            contentWidth.set(width);
            measure({ contentWidth: width });
          }}
          onScroll={(event) => measure({ offset: event.nativeEvent.contentOffset.x })}
          style={{ minWidth: 0, flexGrow: 0 }}
          contentContainerStyle={{
            gap: spacing.sm,
            alignItems: "stretch",
            paddingHorizontal: spacing.card,
            // Room for the tiles' remove badges, which overhang their corners.
            paddingVertical: editing ? spacing.sm + 2 : undefined,
          }}
        >
          {/* Chips present when the bar opens are simply there; an exercise added later fades in. */}
          <LayoutAnimationConfig skipEntering>
            {exercises.map((row, index) => {
              const label = exerciseRowLabel(exercises, row);
              // Screen readers move a tile with actions instead of dragging it.
              const moves = editing
                ? [
                    ...(index > 0 ? [{ name: "earlier", label: "Move earlier" }] : []),
                    ...(index < exercises.length - 1
                      ? [{ name: "later", label: "Move later" }]
                      : []),
                  ]
                : undefined;
              return (
                <BarTile
                  key={row.id}
                  id={row.id}
                  index={index}
                  exercises={exercises}
                  tiles={tiles}
                  label={label}
                  editing={editing}
                  busy={busy}
                  lifted={dragging === row.id}
                  scroll={scroll}
                  onDrag={setDragging}
                  onLayout={(frame) => {
                    tiles.current.set(row.id, frame);
                    // A page that opens on, or adds, an exercise past the edge shows its chip. A
                    // drop stays where it landed.
                    if (row.id === selectedId && dragging === null) reveal(frame.x, false);
                  }}
                >
                  {/* Chips show a short name and position; the accessible names keep the full ones. */}
                  <Chip
                    singleLine
                    minWidth={72}
                    caption={String(index + 1)}
                    label={shortExerciseName(row.exercise.name)}
                    accessibilityLabel={`Select exercise ${label}`}
                    selected={selectedId === row.id}
                    disabled={busy}
                    onPress={() => onSelect(row.id)}
                    actions={moves}
                    onAction={(name) =>
                      editing?.onMove(row.id, index + (name === "earlier" ? -1 : 1))
                    }
                  />
                </BarTile>
              );
            })}
            {editing && (
              <Animated.View entering={fade}>
                <AddTile onPress={editing.onAdd} disabled={busy} />
              </Animated.View>
            )}
          </LayoutAnimationConfig>
        </Animated.ScrollView>
      </GestureHandlerRootView>
      {before && <EdgeFade side="left" />}
      {after && <EdgeFade side="right" />}
    </View>
  );
}

type TileFrame = { x: number; width: number };
/**
 * The bar's scrolling while a tile is dragged: `target` is the offset the drag has scrolled to,
 * and `edge` how deep the finger sits in an end zone, from -1 (left) to 1 (right), 0 outside.
 */
type BarScroll = {
  ref: AnimatedRef<Animated.ScrollView>;
  offset: SharedValue<number>;
  target: SharedValue<number>;
  edge: SharedValue<number>;
};
/** How far into the bar from either end a dragged tile starts scrolling it. */
const edgeZone = 56;
/** Points per millisecond at the very end of the bar: 600 pt a second. */
const edgeSpeed = 0.6;

/** A gentle rock either way, as home screen icons do in edit mode. */
const wiggle = {
  from: { transform: [{ rotate: "-1.5deg" }] },
  to: { transform: [{ rotate: "1.5deg" }] },
} as const;
const settleEase = clampedEasing(motionEase);

/**
 * One exercise's tile on the bar. In edit mode it wiggles, wears a remove badge at its top
 * right, and a press and hold lifts it to drag along the bar; dropping it moves the exercise to
 * the slot under its center.
 */
function BarTile({
  id,
  index,
  exercises,
  tiles,
  label,
  editing,
  busy,
  lifted,
  scroll,
  onDrag,
  onLayout,
  children,
}: {
  id: string;
  index: number;
  exercises: readonly WorkspaceExercise[];
  tiles: RefObject<Map<string, TileFrame>>;
  label: string;
  editing?: ExerciseBarEditing;
  busy: boolean;
  lifted: boolean;
  scroll: BarScroll;
  onDrag: (id: string | null) => void;
  onLayout: (frame: TileFrame) => void;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  const { fade, layout } = useLayoutMotion();
  const reduced = useReducedMotion();
  const shift = useSharedValue(0),
    lift = useSharedValue(0);
  // While held, the tile also moves with the bar's scroll since it was lifted.
  const held = useSharedValue(false),
    liftedAt = useSharedValue(0);
  // A dropped tile's offset from its new slot, applied once it has moved there.
  const landing = useRef<number | null>(null);
  const timing = {
    duration: reduced ? 0 : motionDuration.toggle,
    easing: settleEase,
    reduceMotion: ReduceMotion.Never,
  };
  function settle() {
    lift.set(withTiming(0, timing));
    shift.set(withTiming(0, timing, () => scheduleOnRN(onDrag, null)));
  }
  useLayoutEffect(() => {
    if (landing.current === null) return;
    shift.set(landing.current);
    landing.current = null;
    settle();
    // Only a move to a new index lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);
  function drop(dx: number) {
    const frame = tiles.current.get(id);
    if (!frame || !editing) return settle();
    const center = frame.x + frame.width / 2 + dx;
    const others = exercises.filter((row) => row.id !== id);
    const to = others.filter((row) => {
      const other = tiles.current.get(row.id);
      return other && other.x + other.width / 2 < center;
    }).length;
    const target = tiles.current.get(exercises[to]!.id);
    if (to === index || !target) return settle();
    // Tiles between close the gap, so moving right lands flush with the target's right edge.
    landing.current =
      frame.x + dx - (to > index ? target.x + target.width - frame.width : target.x);
    editing.onMove(id, to);
  }
  const pan = Gesture.Pan()
    .enabled(Boolean(editing) && !busy)
    .activateAfterLongPress(350)
    .onStart(() => {
      lift.set(withTiming(1, timing));
      liftedAt.set(scroll.offset.get());
      scroll.target.set(scroll.offset.get());
      held.set(true);
      scheduleOnRN(onDrag, id);
    })
    .onUpdate((event) => {
      shift.set(event.translationX);
      const bar = measureView(scroll.ref);
      if (!bar) return;
      const left = event.absoluteX - bar.pageX,
        right = bar.pageX + bar.width - event.absoluteX;
      scroll.edge.set(
        left < edgeZone
          ? -Math.min(1, 1 - left / edgeZone)
          : right < edgeZone
            ? Math.min(1, 1 - right / edgeZone)
            : 0,
      );
    })
    .onEnd((event) => {
      scroll.edge.set(0);
      held.set(false);
      // Where the finger left the tile, in the bar's content.
      const dx = event.translationX + scroll.target.get() - liftedAt.get();
      shift.set(dx);
      scheduleOnRN(drop, dx);
    });
  const dragStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: shift.get() + (held.get() ? scroll.target.get() - liftedAt.get() : 0) },
      { scale: 1 + 0.06 * lift.get() },
    ],
  }));
  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        entering={fade}
        // The lifted tile follows the finger; the others slide aside as the order changes.
        layout={editing && !lifted ? layout : undefined}
        onLayout={(event) => onLayout(event.nativeEvent.layout)}
        style={[dragStyle, lifted && { zIndex: 1 }]}
      >
        <Animated.View
          style={
            editing &&
            !reduced &&
            !lifted && {
              animationName: wiggle,
              animationDuration: 140,
              animationDelay: (index % 3) * 45,
              animationIterationCount: "infinite",
              animationDirection: "alternate",
              animationTimingFunction: cssEaseInOut,
            }
          }
        >
          {children}
          {editing && (
            <Tappable
              label={`Remove ${label} from workout`}
              disabled={busy}
              onPress={() => editing.onRemove(id)}
              style={{
                position: "absolute",
                top: -18,
                right: -18,
                width: 44,
                height: 44,
                alignItems: "center",
                justifyContent: "center",
              }}
              surface={{
                width: 24,
                height: 24,
                borderRadius: 12,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.foreground,
              }}
            >
              <Icon name="xmark" size={13} color={colors.background} />
            </Tappable>
          )}
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

/** The last tile in edit mode: adds an exercise. */
function AddTile({ onPress, disabled }: { onPress: () => void; disabled: boolean }) {
  const { colors } = useTheme();
  return (
    <Tappable
      label="Add exercise"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        flexGrow: 1,
        minWidth: 72,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radius.pill,
        backgroundColor: pressed ? colors.accent : colors.muted,
      })}
    >
      <Icon name="plus" size={20} color={colors.primary} />
    </Tappable>
  );
}

/** A card-colored fade over one end of the exercise bar. */
function EdgeFade({ side }: { side: "left" | "right" }) {
  const { colors } = useTheme();
  const id = `exercise-bar-fade-${side}`;
  return (
    <View
      testID={id}
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        ...(side === "left" ? { left: 0 } : { right: 0 }),
        width: 40,
        pointerEvents: "none",
      }}
    >
      <Svg width="100%" height="100%">
        <Defs>
          {/* Clear at the chips, solid at the edge. */}
          <LinearGradient
            id={id}
            x1={side === "left" ? "1" : "0"}
            y1="0"
            x2={side === "left" ? "0" : "1"}
            y2="0"
          >
            <Stop offset="0" stopColor={colors.card} stopOpacity={0} />
            <Stop offset="0.75" stopColor={colors.card} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}
