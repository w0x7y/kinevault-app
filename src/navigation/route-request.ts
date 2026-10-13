export type RouteParam = string | string[] | undefined;
export type RouteRequestMemory = string | string[] | null;

// A route param such as `/profile?section=photos` asks a screen to act once.
// The request is cleared when handled; remembering it until the param disappears
// keeps a stale render from handling it twice, and forgetting it afterwards lets
// a later link with the same value act again. Array values are cleared unhandled.
export function routeRequestStep(
  memory: RouteRequestMemory,
  value: RouteParam,
  ready: boolean,
): { memory: RouteRequestMemory; clear: boolean; deliver: string | null } {
  if (value === undefined) return { memory: null, clear: false, deliver: null };
  if (!ready || memory === value) return { memory, clear: false, deliver: null };
  return { memory: value, clear: true, deliver: typeof value === "string" ? value : null };
}
