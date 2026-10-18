import { useIsFocused } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";
import { deviceSteps, type DeviceStepsAccess } from "./device-steps";
import { stepDayRange, type PhoneSteps, type PhoneStepsReading } from "./summary";

/**
 * The phone's step count for `date`. Rechecks access and recounts whenever the screen gains focus,
 * the app returns to the foreground (e.g. from the system settings) or the date changes. A null
 * date reads nothing and stays loading.
 */
export function useDeviceSteps(date: string | null): PhoneStepsReading {
  const focused = useIsFocused();
  const [access, setAccess] = useState<DeviceStepsAccess | null>(null);
  const [reading, setReading] = useState<{ date: string; steps: number | null } | null>(null);
  const [refresh, setRefresh] = useState(0);
  const retry = useCallback(() => setRefresh((value) => value + 1), []);
  const enabled = date !== null;
  useEffect(() => {
    if (!enabled) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") retry();
    });
    return () => subscription.remove();
  }, [retry, enabled]);
  useEffect(() => {
    if (!focused || date === null) return;
    let cancelled = false;
    void (async () => {
      const next = await deviceSteps.access().catch((): DeviceStepsAccess => "unavailable");
      if (cancelled) return;
      setAccess(next);
      if (next !== "granted") return;
      const range = stepDayRange(date, new Date());
      // A day that hasn't started has no steps to read.
      const steps = range ? await deviceSteps.count(range.start, range.end).catch(() => null) : 0;
      if (!cancelled) setReading({ date, steps });
    })();
    return () => {
      cancelled = true;
    };
  }, [focused, date, refresh]);
  const current = reading?.date === date ? reading : null;
  const state: PhoneSteps["state"] = !current
    ? "loading"
    : current.steps === null
      ? "error"
      : "ready";
  const steps = current?.steps ?? null;
  // A stable reading lets Daily activity skip recounting the day on unrelated renders.
  return useMemo(
    () => ({
      access,
      state,
      steps,
      retry,
      async connect() {
        setAccess(await deviceSteps.request().catch((): DeviceStepsAccess => "unavailable"));
        retry();
      },
      openSettings: () => deviceSteps.openSettings(),
    }),
    [access, state, steps, retry],
  );
}
