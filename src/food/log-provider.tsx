import { createId } from "../persistence/create-id";
import { createDocumentProvider } from "../persistence/document-provider";
import { foodDatabase } from "./database";
import { createFoodLogPersistence } from "./log-persistence";

export const {
  Provider: FoodLogProvider,
  useDocument: useFoodLog,
  /** The food log persistence itself, for owners that write entries. */
  useStore: useFoodLogPersistence,
} = createDocumentProvider({
  name: "FoodLogProvider",
  create: (storage) =>
    createFoodLogPersistence({ storage, findFood: foodDatabase.getById, createId }),
});
