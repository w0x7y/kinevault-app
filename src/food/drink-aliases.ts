import type { CatalogFood } from "./catalog.ts";

type DrinkAliases =
  | { kind: "generic"; texts: readonly string[] }
  | { kind: "qualifier"; texts: readonly string[] };
type BuiltInDrink = {
  name: string;
  category: string;
  aliases: DrinkAliases;
};

const colaBrands = ["pepsi", "coke", "coca cola"];
const pepperBrands = ["dr pepper"];
const dietQualifiers = ["diet", "zero sugar", "sugar free"];

function genericAliases(brands: readonly string[], diet: boolean): DrinkAliases {
  return { kind: "generic",
    texts: diet ? brands.flatMap(brand => dietQualifiers.map(qualifier => `${brand} ${qualifier}`)) : brands };
}

// IDs and descriptions are from the bundled FNDDS catalog. Aliases change search only;
// these generic drinks never claim to contain a named brand's nutrition.
const builtInDrinks = new Map<number, BuiltInDrink>([
  [2710541, { name: "Soft drink, cola", category: "Soft drinks", aliases: genericAliases(colaBrands, false) }],
  [2710542, { name: "Soft drink, cola, diet", category: "Diet soft drinks", aliases: genericAliases([...colaBrands, "cola"], true) }],
  [2710543, { name: "Soft drink, cola, decaffeinated", category: "Soft drinks", aliases: genericAliases(colaBrands, false) }],
  [2710544, { name: "Soft drink, cola, decaffeinated, diet", category: "Diet soft drinks", aliases: genericAliases([...colaBrands, "cola"], true) }],
  [2710545, { name: "Soft drink, pepper type", category: "Soft drinks", aliases: genericAliases(pepperBrands, false) }],
  [2710546, { name: "Soft drink, pepper type, diet", category: "Diet soft drinks", aliases: genericAliases(pepperBrands, true) }],
  [2710547, { name: "Soft drink, pepper type, decaffeinated", category: "Soft drinks", aliases: genericAliases(pepperBrands, false) }],
  [2710548, { name: "Soft drink, pepper type, decaffeinated, diet", category: "Diet soft drinks", aliases: genericAliases(pepperBrands, true) }],
  [2710757, { name: "Energy drink, low calorie (Monster)", category: "Diet sport and energy drinks", aliases: { kind: "qualifier", texts: ["diet"] } }],
  [2710758, { name: "Energy drink, sugar free (Monster)", category: "Diet sport and energy drinks", aliases: { kind: "qualifier", texts: ["zero sugar"] } }],
]);

export function drinkAliasesFor(food: CatalogFood): DrinkAliases | undefined {
  if (food.fdcId === undefined || food.customId !== undefined || food.brand !== undefined) return undefined;
  const drink = builtInDrinks.get(food.fdcId);
  return drink?.name === food.name && drink.category === food.category ? drink.aliases : undefined;
}
