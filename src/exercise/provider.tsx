import { useEffect } from "react";
import { useAccountStorage } from "../account/storage-context";
import { createId } from "../persistence/create-id";
import { createDocumentProvider } from "../persistence/document-provider";
import { createExercisePersistence } from "./persistence";

// Each account scope has its own storage, so a guest scope is one without an owner.
export const { Provider: ExerciseProvider, useDocument: useExercises } = createDocumentProvider({
  name: "ExerciseProvider",
  create: (storage) =>
    createExercisePersistence({
      storage,
      development: __DEV__ && storage.ownerId === null,
      createId,
      now: Date.now,
    }),
  useValue(snapshot, store) {
    const guest = useAccountStorage().ownerId === null;
    const seedDocument = snapshot.state.kind === "ready" ? snapshot.state.document : null;
    useEffect(() => {
      if (__DEV__ && guest && seedDocument && !seedDocument.developmentExamplesSeeded)
        void store.seedDevelopmentExamples();
    }, [store, seedDocument, guest]);
    const {
      getSnapshot: _getSnapshot,
      subscribe: _subscribe,
      start: _start,
      stop: _stop,
      seedDevelopmentExamples: _seedDevelopmentExamples,
      ...commands
    } = store;
    return { ...snapshot, ...commands };
  },
});
