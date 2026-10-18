import { LoadFailure } from "../components/load-failure";
import { Panel } from "../components/ui";
import { KineLoading } from "../components/kine-loading";
import type { DaySource } from "../daily/activity";

export function FoodLogStatus({ source }: { source: DaySource }) {
  if (source.kind === "ready") return null;
  if (source.kind === "loading")
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
      onRetry={source.retry}
    />
  );
}
