import type { ComponentType, PropsWithChildren, ReactNode } from "react";
import { RefreshNotice } from "../persistence/refresh-notice";
import { ExerciseProvider, useExercises } from "../exercise/provider";
import { CustomFoodProvider, useCustomFoods } from "../food/custom-provider";
import { FoodLogProvider, useFoodLog } from "../food/log-provider";
import { ProfileMediaProvider } from "../profile/media-provider";
import { StepsLogProvider, useStepsLog } from "../steps/provider";
import { WaterLogProvider, useWaterLog } from "../water/provider";
import { WaterGoalProvider, useWaterGoal } from "../water/goal-provider";

type Refreshable = Parameters<typeof RefreshNotice>[0]["document"];

/** The tracking documents the tabs read, outermost first; notices follow this order. */
const tabDocuments: readonly {
  Provider: ComponentType<PropsWithChildren>;
  refresh?: { label: string; useDocument(): Refreshable };
}[] = [
  { Provider: ExerciseProvider, refresh: { label: "Exercises", useDocument: useExercises } },
  { Provider: CustomFoodProvider, refresh: { label: "Custom foods", useDocument: useCustomFoods } },
  { Provider: FoodLogProvider, refresh: { label: "Food log", useDocument: useFoodLog } },
  { Provider: WaterLogProvider, refresh: { label: "Water log", useDocument: useWaterLog } },
  { Provider: WaterGoalProvider, refresh: { label: "Water goal", useDocument: useWaterGoal } },
  { Provider: ProfileMediaProvider },
  { Provider: StepsLogProvider, refresh: { label: "Logged steps", useDocument: useStepsLog } },
];

/** Mounts every tracking document the tabs read. Profile mounts above, with the account scope. */
export function AccountTrackingProvider({ children }: PropsWithChildren) {
  return tabDocuments.reduceRight<ReactNode>(
    (inner, { Provider }) => <Provider>{inner}</Provider>,
    children,
  );
}

/** One notice per tracking document whose background refresh failed. */
export function TrackingRefreshNotices() {
  return tabDocuments.map(
    ({ refresh }) =>
      refresh && (
        <DocumentRefreshNotice
          key={refresh.label}
          label={refresh.label}
          useDocument={refresh.useDocument}
        />
      ),
  );
}

function DocumentRefreshNotice({
  label,
  useDocument,
}: {
  label: string;
  useDocument(): Refreshable;
}) {
  return <RefreshNotice label={label} document={useDocument()} />;
}
