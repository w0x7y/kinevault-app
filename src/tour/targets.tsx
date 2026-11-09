import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type PropsWithChildren,
  type RefObject,
} from "react";
import { View, type ViewInstance, type ViewProps } from "react-native";
import type { TourTargetId } from "./steps";

type TargetRef = RefObject<ViewInstance | null>;

/** Where tagged views report themselves to the App tour. `add` returns the removal. */
export const TourTargets = createContext<{
  add: (id: TourTargetId, target: TargetRef) => () => void;
} | null>(null);

/** Tags a view the App tour can highlight. Pass `ref` to tag a view that already has one. */
export function useTourTarget(id: TourTargetId, ref?: TargetRef): TargetRef {
  const own = useRef<ViewInstance>(null);
  const target = ref ?? own;
  const targets = useContext(TourTargets);
  useEffect(() => targets?.add(id, target), [targets, id, target]);
  return target;
}

/** Wraps content the App tour can highlight in a plain view. Lay it out with `style`, and take
 * `onLayout` here rather than from the content, whose position is now inside this view. */
export function TourTarget({
  id,
  style,
  onLayout,
  children,
}: PropsWithChildren<{ id: TourTargetId } & Pick<ViewProps, "style" | "onLayout">>) {
  const ref = useTourTarget(id);
  return (
    <View ref={ref} collapsable={false} style={style} onLayout={onLayout}>
      {children}
    </View>
  );
}
