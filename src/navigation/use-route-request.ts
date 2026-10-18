import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useEffectEvent, useRef } from "react";
import { routeRequestStep, type RouteParam, type RouteRequestMemory } from "./route-request";
import { parseRouteRequest, type RouteRequestName, type RouteRequestValue } from "./track-tabs";

// Hands each new value of the `name` route param to `apply` once the screen is ready,
// then clears the param. Values the request's parser rejects are cleared unhandled.
// `apply` sees the current render, so screen rules stay fresh.
export function useRouteRequest<N extends RouteRequestName>(
  name: N,
  { ready }: { ready: boolean },
  apply: (value: RouteRequestValue<N>) => void,
) {
  const value: RouteParam = useLocalSearchParams<Record<string, string | string[]>>()[name];
  const router = useRouter();
  const memory = useRef<RouteRequestMemory>(null);
  const handle = useEffectEvent(apply);
  useEffect(() => {
    const step = routeRequestStep(memory.current, value, ready);
    memory.current = step.memory;
    if (step.clear) router.setParams({ [name]: undefined });
    const request = step.deliver === null ? null : parseRouteRequest(name, step.deliver);
    if (request !== null) handle(request);
  }, [name, value, ready, router]);
}
