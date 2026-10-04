import { useEffect, useState } from "react";
import { View } from "react-native";
import { AppText, Panel } from "../components/ui";
import { elapsedSeconds, type WorkoutSession } from "./model";
import { ExerciseButton } from "./controls";
import { spacing } from "../theme/tokens";

export function ActiveWorkoutTimer({ session, onOpen }: { session: WorkoutSession; onOpen: () => void }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => { setNow(Date.now()); const interval = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(interval); }, [session.id]);
  const elapsed = elapsedSeconds(session, now);
  return <Panel testID="active-workout-timer">
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.layout }}>
      <View style={{ flex: 1, minWidth: 0 }}><AppText variant="label">{session.name || "Active workout"}</AppText>
        <AppText variant="caption" muted>Started for {session.date}</AppText></View>
      <AppText variant="heading" accessibilityLabel="Elapsed workout time" style={{ fontVariant: ["tabular-nums"] }}>{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</AppText>
    </View>
    <ExerciseButton label="Open active workout" onPress={onOpen} />
  </Panel>;
}
