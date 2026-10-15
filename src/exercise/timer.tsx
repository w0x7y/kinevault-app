import { useEffect, useState } from "react";
import { View } from "react-native";
import { AppText } from "../components/ui";
import { elapsedSeconds, type WorkoutSession } from "./model";

export function ActiveWorkoutTimer({ session }: { session: WorkoutSession }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [session.id]);
  const elapsed = elapsedSeconds(session, now);
  return (
    <View>
      <AppText variant="label" muted>
        Elapsed
      </AppText>
      <AppText
        testID="active-workout-timer"
        variant="hero"
        accessibilityLabel="Elapsed workout time"
      >
        {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
      </AppText>
    </View>
  );
}
