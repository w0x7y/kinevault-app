import { scaleNutrients, type DetailedNutrients } from "./nutrients.ts";

export type Nutrition = { calories: number; carbs: number; protein: number; fat: number };
export type ServingNutrition = Nutrition & { details?: DetailedNutrients };
export type FoodIdentity = { fdcId: number; customId?: never } | { customId: string; fdcId?: never };
export type CatalogFood = FoodIdentity & {
  name: string;
  category: string;
  per100g: Nutrition;
  details?: DetailedNutrients;
  portions: readonly { label: string; grams: number }[];
};
export const foodPageSize = 20;
export const foodKey = (food: FoodIdentity) => food.customId === undefined ? `usda:${food.fdcId}` : `custom:${food.customId}`;

function words(text: string): string[] {
  return (text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])
    .map(word => {
      if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
      if (word.length > 4 && /(oes|ches|shes|xes|zes)$/.test(word)) return word.slice(0, -2);
      if (word.length > 3 && word.endsWith("s") && !/(ss|us|is)$/.test(word)) return word.slice(0, -1);
      return word;
    });
}

export function createFoodCatalog(foods: readonly CatalogFood[]) {
  const byId = new Map<number, CatalogFood>();
  for (const food of foods) if (food.fdcId !== undefined) byId.set(food.fdcId, food);
  const index = foods.map(food => {
    const tokens = words(food.name);
    return { food, tokens, text: tokens.join(" ") };
  });
  return {
    getById: (fdcId: number) => byId.get(fdcId),
    search(query: string, page = 0): { items: CatalogFood[]; total: number } {
      const terms = words(query.slice(0, 100));
      if (!terms.some(term => term.length >= 2)) return { items: [], total: 0 };
      const phrase = terms.join(" ");
      const matches = index
        .filter(entry => terms.every(term => entry.tokens.some(token => token.startsWith(term))))
        .map(entry => ({ ...entry, rank: entry.text === phrase ? 0 : entry.text.startsWith(`${phrase} `) ? 1 : 2 }))
        .sort((a, b) => a.rank - b.rank || a.tokens.length - b.tokens.length ||
          a.food.name.length - b.food.name.length || a.food.name.localeCompare(b.food.name) || foodKey(a.food).localeCompare(foodKey(b.food)));
      const offset = (Number.isFinite(page) ? Math.max(0, Math.floor(page)) : 0) * foodPageSize;
      return { items: matches.slice(offset, offset + foodPageSize).map(entry => entry.food), total: matches.length };
    },
  };
}

export function nutritionForGrams(food: CatalogFood, grams: number): ServingNutrition {
  if (!Number.isFinite(grams) || grams <= 0) throw new RangeError("Food weight must be positive and finite");
  const factor = grams / 100;
  return {
    calories: food.per100g.calories * factor, carbs: food.per100g.carbs * factor,
    protein: food.per100g.protein * factor, fat: food.per100g.fat * factor,
    ...(food.details ? { details: scaleNutrients(food.details, factor) } : {}),
  };
}

export function parseFoodGrams(input: string): number | null {
  const text = input.trim();
  if (!/^(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(text)) return null;
  const grams = Number(text.replace(",", "."));
  return Number.isFinite(grams) && grams > 0 && grams <= 10000 ? grams : null;
}
