import { AppText, Panel } from "../components/ui";
import { FoodButton } from "./food-button";
import { useFoodLog } from "./log-provider";

export function FoodLogStatus() {
  const log = useFoodLog();
  if (log.state.kind === "ready") return null;
  return (
    <Panel accessibilityRole={log.state.kind === "error" ? "alert" : undefined}>
      {log.state.kind === "loading" ? <AppText accessibilityLiveRegion="polite">Loading your food log...</AppText> : (
        <>
          <AppText variant="heading" accessibilityRole="header">Couldn't load your food log</AppText>
          <AppText muted>We couldn't read your saved entries. Retry to load them before logging food.</AppText>
          <FoodButton label="Retry food log" onPress={log.retryLoad} />
        </>
      )}
    </Panel>
  );
}
