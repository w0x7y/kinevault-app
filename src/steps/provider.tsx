import { createDocumentProvider } from "../persistence/document-provider";
import { createStepsLogPersistence } from "./persistence";

export const {
  Provider: StepsLogProvider,
  useDocument: useStepsLog,
  useStore: useStepsLogPersistence,
} = createDocumentProvider({
  name: "StepsLogProvider",
  create: (storage) => createStepsLogPersistence({ storage }),
});
