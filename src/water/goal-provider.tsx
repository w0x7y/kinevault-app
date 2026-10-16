import { createDocumentProvider } from "../persistence/document-provider";
import { createWaterGoalPersistence } from "./goal-persistence";

export const {
  Provider: WaterGoalProvider,
  useDocument: useWaterGoal,
  useStore: useWaterGoalPersistence,
} = createDocumentProvider({
  name: "WaterGoalProvider",
  create: (storage) => createWaterGoalPersistence({ storage }),
});
