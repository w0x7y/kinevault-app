import type { ComponentType, PropsWithChildren, ReactNode } from "react";
import { RefreshNotice } from "../persistence/refresh-notice";
import { ExerciseProvider, useExercises } from "../exercise/provider";
import { exerciseStorageKey } from "../exercise/persistence";
import { CustomFoodProvider, useCustomFoods } from "../food/custom-provider";
import { customFoodStorageKey } from "../food/custom-persistence";
import { FoodLogProvider, useFoodLog } from "../food/log-provider";
import { foodLogStorageKey } from "../food/log-persistence";
import { ProfileMediaProvider } from "../profile/media-provider";
import type { profileStorageKey } from "../profile/persistence";
import { StepsLogProvider, useStepsLog } from "../steps/provider";
import { stepsLogStorageKey } from "../steps/persistence";
import { WaterLogProvider, useWaterLog } from "../water/provider";
import { waterLogStorageKey } from "../water/persistence";
import { WaterGoalProvider, useWaterGoal } from "../water/goal-provider";
import { waterGoalStorageKey } from "../water/goal-persistence";
import type { AccountDocumentKey } from "./tracking-documents";

type Refreshable = Parameters<typeof RefreshNotice>[0]["document"];

/** The tracking documents the tabs read, outermost first. */
const tabProviders: readonly ComponentType<PropsWithChildren>[] = [
  ExerciseProvider,
  CustomFoodProvider,
  FoodLogProvider,
  WaterLogProvider,
  WaterGoalProvider,
  ProfileMediaProvider,
  StepsLogProvider,
];

/**
 * A refresh notice for every synced document but Profile (the root layout shows its own), in
 * display order. A document whose refresh failed refuses writes until retried, so typecheck
 * fails when a registry document has no notice.
 */
const refreshNotices = {
  [exerciseStorageKey]: { label: "Exercises", useDocument: useExercises },
  [customFoodStorageKey]: { label: "Custom foods", useDocument: useCustomFoods },
  [foodLogStorageKey]: { label: "Food log", useDocument: useFoodLog },
  [waterLogStorageKey]: { label: "Water log", useDocument: useWaterLog },
  [waterGoalStorageKey]: { label: "Water goal", useDocument: useWaterGoal },
  [stepsLogStorageKey]: { label: "Logged steps", useDocument: useStepsLog },
} satisfies Record<
  Exclude<AccountDocumentKey, typeof profileStorageKey>,
  { label: string; useDocument(): Refreshable }
>;

/** Mounts every tracking document the tabs read. Profile mounts above, with the account scope. */
export function AccountTrackingProvider({ children }: PropsWithChildren) {
  return tabProviders.reduceRight<ReactNode>(
    (inner, Provider) => <Provider>{inner}</Provider>,
    children,
  );
}

/** One notice per tracking document whose background refresh failed. */
export function TrackingRefreshNotices() {
  return Object.entries(refreshNotices).map(([key, { label, useDocument }]) => (
    <DocumentRefreshNotice key={key} label={label} useDocument={useDocument} />
  ));
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
