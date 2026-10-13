import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useEffectEvent, useRef } from "react";
import { routeRequestStep, type RouteParam, type RouteRequestMemory } from "./route-request";

// Hands each new value of the `name` route param to `apply` once the screen is ready,
// then clears the param. `apply` sees the current render, so screen rules stay fresh.
export function useRouteRequest(
  name: string,
  { ready }: { ready: boolean },
  apply: (value: string) => void,
) {
  const value: RouteParam = useLocalSearchParams<Record<string, string | string[]>>()[name];
  const router = useRouter();
  const memory = useRef<RouteRequestMemory>(null);
  const handle = useEffectEvent(apply);
  useEffect(() => {
    const step = routeRequestStep(memory.current, value, ready);
    memory.current = step.memory;
    if (step.clear) router.setParams({ [name]: undefined });
    if (step.deliver !== null) handle(step.deliver);
  }, [name, value, ready, router]);
}
