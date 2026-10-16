import { createDocumentEdit, type ParsedDraft } from "../persistence/document-edit.ts";
import { waterGoalFromText, waterGoalRangeMessage } from "./goal-model.ts";
import type { createWaterGoalPersistence } from "./goal-persistence.ts";

type WaterGoalStore = Pick<
  ReturnType<typeof createWaterGoalPersistence>,
  "getSnapshot" | "subscribe" | "retryLoad" | "setGoal"
>;

// A Water goal edit owns its entered amount and save feedback. Until the user
// types, the draft follows the saved goal, including another device's update.
export function createWaterGoalEdit(goal: WaterGoalStore) {
  return createDocumentEdit({
    document: goal,
    draft: "",
    seed: (document) => String(document.dailyMl),
    follow: true,
    parse(draft): ParsedDraft<number> {
      const ml = waterGoalFromText(draft);
      return ml === null ? { error: waterGoalRangeMessage } : { value: ml };
    },
    write: (ml) => goal.setGoal(ml),
    failure: "Couldn't save your water goal. Try again.",
  });
}
