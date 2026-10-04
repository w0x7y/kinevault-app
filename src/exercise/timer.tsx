import { useEffect, useState } from "react";
import { AppText } from "../components/ui";
import { elapsedSeconds, type WorkoutSession } from "./model";

export function ActiveWorkoutTimer({ session }: { session: WorkoutSession }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => { setNow(Date.now()); const interval = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(interval); }, [session.id]);
  const elapsed = elapsedSeconds(session, now);
  return <AppText testID="active-workout-timer" variant="heading" accessibilityLabel="Elapsed workout time"
    style={{ fontVariant: ["tabular-nums"], textAlign: "right" }}>{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</AppText>;
}
