import { createFoodCatalog } from "./catalog.ts";

type BundledCatalog = typeof import("../../assets/food/usda-fndds.json");
let database: ReturnType<typeof loadFoodDatabase> | undefined;

function loadFoodDatabase() {
  // A lazy require keeps parsing the 2.6 MB catalog out of app startup. Metro still bundles it.
  const data = require("../../assets/food/usda-fndds.json") as BundledCatalog;
  return { ...createFoodCatalog(data.foods), foods: data.foods, source: data.source };
}

/** The bundled USDA catalog, loaded on first use. */
export const getFoodDatabase = () => (database ??= loadFoodDatabase());
