import { AppButton } from "../components/button";
import { AppText, Panel } from "../components/ui";
import { useFoodLog } from "./log-provider";
import { KineLoading } from "../components/kine-loading";

export function FoodLogStatus({ fill = false }: { fill?: boolean }) {
  const log = useFoodLog();
  if (log.state.kind === "ready") return null;
  if (log.state.kind === "loading")
    return <KineLoading label="Loading your food log..." fill={fill} />;
  return (
    <Panel accessibilityRole="alert">
      <AppText variant="heading" accessibilityRole="header">
        Couldn't load your food log
      </AppText>
      <AppText muted>
        We couldn't read your saved entries. Retry to load them before logging food.
      </AppText>
      <AppButton label="Retry food log" onPress={log.retryLoad} />
    </Panel>
  );
}
