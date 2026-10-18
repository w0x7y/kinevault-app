import { useMemo } from "react";
import { createId } from "../persistence/create-id";
import { createDocumentProvider } from "../persistence/document-provider";
import { createFoodSelection } from "./catalog-selection.ts";
import { getFoodDatabase } from "./database";
import { createCustomFoodPersistence } from "./custom-persistence.ts";

export const {
  Provider: CustomFoodProvider,
  useDocument: useCustomFoods,
  /** The Custom food persistence itself, for owners that save or follow the catalog. */
  useStore: useCustomFoodPersistence,
} = createDocumentProvider({
  name: "CustomFoodProvider",
  create: (storage) => createCustomFoodPersistence({ storage, createId }),
  useValue(snapshot, store) {
    const selection = useMemo(
      () =>
        createFoodSelection({
          savedFoods: snapshot.state.kind === "ready" ? snapshot.state.document.foods : [],
          savedMeals: snapshot.state.kind === "ready" ? snapshot.state.document.meals : [],
          bundledFoods: () => getFoodDatabase().foods,
        }),
      [snapshot.state],
    );
    return { ...snapshot, selection, retryLoad: store.retryLoad };
  },
});
