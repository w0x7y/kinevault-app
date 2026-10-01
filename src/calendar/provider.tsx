import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type PropsWithChildren,
} from "react";
import { AppState, Platform } from "react-native";
import { createSelectedDay, type SelectedDaySnapshot, type SelectedDayWakeEvents } from "./selection";

type DaySelection = SelectedDaySnapshot & {
  selectDay: (day: string) => void;
};

const DayContext = createContext<DaySelection | null>(null);

const wakeEvents: SelectedDayWakeEvents = {
  subscribe(wake) {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") wake();
    });
    const visible = () => {
      if (document.visibilityState === "visible") wake();
    };
    if (Platform.OS === "web") document.addEventListener("visibilitychange", visible);
    return () => {
      subscription.remove();
      if (Platform.OS === "web") document.removeEventListener("visibilitychange", visible);
    };
  },
};

export function DayProvider({ children }: PropsWithChildren) {
  const [controller] = useState(() => createSelectedDay({
    clock: {
      now: () => new Date(),
      schedule(callback, delay) {
        const timer = setTimeout(callback, delay);
        return () => { clearTimeout(timer); };
      },
    },
    wakeEvents,
  }));
  const selection = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => {
    controller.start();
    return () => { controller.stop(); };
  }, [controller]);

  const value = useMemo(() => ({ ...selection, selectDay: controller.selectDay }), [selection, controller]);
  return <DayContext.Provider value={value}>{children}</DayContext.Provider>;
}

export function useSelectedDay(): DaySelection {
  const selection = useContext(DayContext);
  if (!selection) throw new Error("useSelectedDay must be used inside DayProvider");
  return selection;
}
