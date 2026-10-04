import { useEffect, useState } from "react";
import { AppText, Panel } from "../components/ui";
import { elapsedSeconds, type WorkoutSession } from "./model";
import { ExerciseButton } from "./controls";

export function ActiveWorkoutTimer({ session, onOpen }: { session: WorkoutSession; onOpen: () => void }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => { setNow(Date.now()); const interval = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(interval); }, [session.id]);
  const elapsed = elapsedSeconds(session, now);
  return <Panel testID="active-workout-timer"><AppText variant="heading">{session.name || "Active workout"}</AppText>
    <AppText variant="heading" accessibilityLabel="Elapsed workout time" style={{ fontVariant: ["tabular-nums"] }}>{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</AppText>
    <AppText variant="caption" muted>Started for {session.date}</AppText>
    <ExerciseButton label="Open active workout" onPress={onOpen} />
  </Panel>;
}
