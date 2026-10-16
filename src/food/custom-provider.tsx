import { useMemo } from "react";
import data from "../../assets/food/usda-fndds.json";
import { createId } from "../persistence/create-id";
import { createDocumentProvider } from "../persistence/document-provider";
import { createFoodSelection } from "./catalog-selection.ts";
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
          bundledFoods: data.foods,
        }),
      [snapshot.state],
    );
    return { ...snapshot, selection, retryLoad: store.retryLoad };
  },
});
