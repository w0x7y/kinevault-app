import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  completeReminderTap,
  getPendingReminderTap,
  subscribeToReminderTaps,
  type ReminderTap,
} from "./notifications";

/**
 * Opens the screen for a tapped reminder, including the tap that launched the
 * app. `wait` holds the tap while startup finishes; `ignore` drops it when
 * tracking isn't available, such as while signed out or during setup.
 */
export function useReminderTapRouting(access: "wait" | "open" | "ignore") {
  const router = useRouter();
  const [tap, setTap] = useState<ReminderTap | null>(getPendingReminderTap);
  useEffect(() => subscribeToReminderTaps(setTap), []);
  useEffect(() => {
    if (!tap || access === "wait") return;
    completeReminderTap(tap);
    setTap(null);
    if (access === "open") router.navigate(tap.route);
  }, [tap, access, router]);
}
