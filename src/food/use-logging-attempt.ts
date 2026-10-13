import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Meal } from "../daily/model";
import type { CatalogFood } from "./catalog.ts";
import { useCustomFoods } from "./custom-provider";
import { foodDatabase } from "./database";
import { useFoodDrafts } from "./draft-provider";
import type { FoodSaveTarget } from "./log-model.ts";
import { useFoodLog } from "./log-provider";
import { createFoodLoggingAttempt } from "./logging-attempt.ts";

export function useFoodLoggingAttempt({
  target,
  date,
  initialMeal,
  catalogItem,
}: {
  target: FoodSaveTarget;
  date: string;
  initialMeal?: Meal;
  catalogItem?: CatalogFood;
}) {
  const log = useFoodLog();
  const custom = useCustomFoods();
  const drafts = useFoodDrafts();
  const owners = useRef({ log, drafts });
  owners.current = { log, drafts };
  const busy = log.saving || custom.saving;
  const available = !busy && log.state.kind === "ready";
  const [attempt] = useState(() =>
    createFoodLoggingAttempt({
      target,
      date,
      initialMeal,
      catalogItem,
      available,
      findFood: foodDatabase.getById,
      save: (write) =>
        write.kind === "edit"
          ? owners.current.log.edit(write.input)
          : owners.current.log.add(write.input),
      syncMealIntent: (meal) => owners.current.drafts.setMealIntent(meal),
    }),
  );
  const snapshot = useSyncExternalStore(
    attempt.subscribe,
    attempt.getSnapshot,
    attempt.getSnapshot,
  );
  useLayoutEffect(() => {
    attempt.start();
    return attempt.close;
  }, [attempt]);
  useLayoutEffect(() => {
    attempt.refresh({ date, catalogItem, available });
  }, [attempt, date, catalogItem, available]);
  return { attempt, ...snapshot, busy, saving: log.saving };
}
export type FoodLoggingAttemptView = ReturnType<typeof useFoodLoggingAttempt>;
