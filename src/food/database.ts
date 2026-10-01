import data from "../../assets/food/usda-fndds.json";
import { createFoodCatalog } from "./catalog.ts";

export const foodSource = data.source;
export const foodDatabase = createFoodCatalog(data.foods);
