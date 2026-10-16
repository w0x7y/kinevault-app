import { createDocumentProvider } from "../persistence/document-provider";
import { createWaterLogPersistence } from "./persistence";

export const {
  Provider: WaterLogProvider,
  useDocument: useWaterLog,
  useStore: useWaterLogPersistence,
} = createDocumentProvider({
  name: "WaterLogProvider",
  create: (storage) => createWaterLogPersistence({ storage }),
});
