import { LoadFailure } from "../components/load-failure";
import { Panel } from "../components/ui";
import { useFoodLog } from "./log-provider";
import { KineLoading } from "../components/kine-loading";

export function FoodLogStatus() {
  const log = useFoodLog();
  if (log.state.kind === "ready") return null;
  if (log.state.kind === "loading")
    return (
      <Panel>
        <KineLoading compact label="Loading your food log..." />
      </Panel>
    );
  return (
    <LoadFailure
      appearance="panel"
      message="Couldn't load your food log"
      description="We couldn't read your saved entries. Retry to load them before logging food."
      retryLabel="Retry food log"
      onRetry={log.retryLoad}
    />
  );
}
