import assert from "node:assert/strict";
import test from "node:test";
import { createFoodCatalog, foodKey, type CatalogFood } from "../src/food/catalog.ts";

const food = (
  fdcId: number,
  name: string,
  brand?: string,
): CatalogFood & { per100g: NonNullable<CatalogFood["per100g"]> } => ({
  fdcId,
  name,
  ...(brand === undefined ? {} : { brand }),
  category: "Test",
  per100g: { calories: 1, carbs: 1, protein: 1, fat: 1 },
  portions: [],
});
const ids = (foods: CatalogFood[]) => foods.map(foodKey);

test("iPhone and compatible apostrophe typography finds the original saved food without changing its identity", () => {
  const original = food(1, "McDonald's hamburger", "McDonald’s");
  const catalog = createFoodCatalog([original]);
  for (const apostrophe of ["'", "’", "‘", "ʼ", "‛", "＇"]) {
    const result = catalog.search(`\u00a0McDonald${apostrophe}s\u202fhamburger\u3000`);
    assert.deepEqual(result.items, [original], apostrophe);
    assert.equal(result.items[0], original);
    assert.equal(foodKey(result.items[0]!), "usda:1");
    assert.equal(original.name, "McDonald's hamburger");
    assert.equal(original.brand, "McDonald’s");
  }
  for (const query of ["McDonald’s diet", "McDonald’s zero", "McDonald’s cooked", "McDonald’s 123"])
    assert.equal(catalog.search(query).total, 0, query);
});

test("formatting keys come from arbitrary names and brands including embedded contiguous spans", () => {
  const catalog = createFoodCatalog([
    food(1, "Energy drink (Red Bull)"),
    food(2, "McDonald’s hamburger"),
    food(3, "Lemon café drink", "Acme & Sons"),
    food(4, "Redbull beverage"),
  ]);
  for (const query of ["redbull", "red-bull", "Red Bull"])
    assert.deepEqual(
      new Set(ids(catalog.search(query).items)),
      new Set(["usda:1", "usda:4"]),
      query,
    );
  for (const query of ["McDonalds", "McDonald's", "mcdonald’s"])
    assert.deepEqual(ids(catalog.search(query).items), ["usda:2"], query);
  assert.deepEqual(ids(catalog.search("acmesons cafe").items), ["usda:3"]);
  assert.equal(catalog.search("bullred").total, 0);
  assert.equal(catalog.search("cafelemon").total, 0);
});

test("one-edit typos require every term and rank below exact and formatting matches", () => {
  const catalog = createFoodCatalog([
    food(1, "Dr Pepper cherry"),
    food(2, "Drpeper cherry"),
    food(3, "Banana raw"),
    food(4, "Apple pie"),
    food(5, "Chicken breast grilled"),
  ]);
  assert.deepEqual(ids(catalog.search("drpeper cherry").items), ["usda:2", "usda:1"]);
  assert.deepEqual(ids(catalog.search("dr peper").items), ["usda:2", "usda:1"]);
  assert.deepEqual(ids(catalog.search("chiken breast").items), ["usda:5"]);
  assert.equal(catalog.search("chikn breast").total, 0);
  for (const query of ["drpeper banana", "apple diet", "drpeper mango", "chiken banana"])
    assert.equal(catalog.search(query).total, 0, query);
});

test("completed variants and numbers are exact while final incomplete variants can prefix", () => {
  const catalog = createFoodCatalog([
    food(1, "Pepsi regular"),
    food(2, "Pepsi diet"),
    food(3, "Pepsi zero sugar"),
    food(4, "Pepsi dietary supplement"),
    food(5, "Chicken raw"),
    food(6, "Chicken cooked"),
    food(7, "Formula 123"),
    food(8, "Formula 124"),
    food(9, "Sugarfree drink"),
  ]);
  assert.deepEqual(ids(catalog.search("pepsi diet").items), ["usda:2"]);
  assert.deepEqual(ids(catalog.search("pepsi zero").items), ["usda:3"]);
  assert.equal(catalog.search("pepsi deit").total, 0);
  assert.deepEqual(ids(catalog.search("chicken raw").items), ["usda:5"]);
  assert.equal(catalog.search("chicken row").total, 0);
  assert.deepEqual(ids(catalog.search("formula 123").items), ["usda:7"]);
  assert.equal(catalog.search("formula 12").total, 0);
  assert.deepEqual(ids(catalog.search("sugar free").items), ["usda:9"]);
  assert.ok(catalog.search("pepsi di").items.some((item) => item.fdcId === 2));
  assert.equal(catalog.search("pepsi sugarfree").total, 0);
});

test("interior substrings and sorted whole-name joins are not matches", () => {
  const catalog = createFoodCatalog([
    food(1, "Pineapple raw"),
    food(2, "Blueberry muffin"),
    food(3, "Bull red drink"),
  ]);
  for (const query of ["apple", "berry", "redbull"])
    assert.equal(catalog.search(query).total, 0, query);
});

test("fuzzy branded records beat generic suggestions and preserve returned identity", () => {
  const generic = { ...food(2710545, "Soft drink, pepper type"), category: "Soft drinks" };
  const saved: CatalogFood = {
    customId: "pepper",
    name: "Cherry soda",
    brand: "Dr Pepper",
    category: "Saved",
    per100g: generic.per100g,
    portions: [],
  };
  const catalog = createFoodCatalog([generic, saved]);
  const result = catalog.search("drpeper");
  assert.equal(result.items[0], saved);
  assert.deepEqual(result.genericDrinkKeys, ["usda:2710545"]);
  assert.equal(catalog.search("drpeper cherry").items[0], saved);
  assert.equal(catalog.search("drpeper banana").total, 0);
  assert.equal(catalog.search("drpeper zero").total, 0);
});

test("reconstruction reflects saved record additions edits and removals without stale keys", () => {
  const original = food(1, "Banana raw");
  const saved: CatalogFood = {
    customId: "saved",
    name: "Pear drink",
    brand: "Red Bull",
    category: "Saved",
    per100g: original.per100g,
    portions: [],
  };
  assert.equal(createFoodCatalog([original]).search("redbull").total, 0);
  assert.equal(createFoodCatalog([original, saved]).search("redbull").items[0], saved);
  const edited = { ...saved, brand: "Acme Sons", name: "Apple drink" };
  const catalog = createFoodCatalog([original, edited]);
  assert.equal(catalog.search("redbull").total, 0);
  assert.equal(catalog.search("acmesons").items[0], edited);
  assert.equal(createFoodCatalog([original]).search("acmesons").total, 0);
});

test("stable fuzzy pagination has no skips or duplicates across rebuilds", () => {
  const foods = Array.from({ length: 45 }, (_, index) =>
    food(index + 1, `Dr Pepper bottle ${String(index).padStart(2, "0")}`),
  );
  const catalog = createFoodCatalog(foods);
  const pages = [0, 1, 2].map((page) => catalog.search("drpeper", page));
  assert.deepEqual(
    pages.map((page) => page.total),
    [45, 45, 45],
  );
  assert.deepEqual(
    pages.map((page) => page.items.length),
    [20, 20, 5],
  );
  assert.deepEqual(ids(pages.flatMap((page) => page.items)), foods.map(foodKey));
  assert.deepEqual(
    ids(createFoodCatalog([...foods].reverse()).search("drpeper").items),
    ids(pages[0]!.items),
  );
});

test("canonical short drink brands do not fuzz into unrelated ordinary foods", () => {
  const generic = { ...food(2710541, "Soft drink, cola"), category: "Soft drinks" };
  const catalog = createFoodCatalog([food(1, "Cake"), food(2, "Colada cocktail"), generic]);
  assert.deepEqual(ids(catalog.search("coke").items), ["usda:2710541"]);
  assert.deepEqual(ids(catalog.search("cola").items), ["usda:2710541"]);
});

test("joined completed qualifiers do not prefix a different variant", () => {
  const catalog = createFoodCatalog([food(1, "Pepsi zero sugary")]);
  assert.equal(catalog.search("pepsi zerosugar").total, 0);
});

test("compacting a query cannot fuzz a short word but preserves eligible typos", () => {
  const catalog = createFoodCatalog([food(2, "Red Bull"), food(3, "Drpepper")]);
  assert.equal(catalog.search("red bulx").total, 0);
  assert.deepEqual(ids(catalog.search("dr peper").items), ["usda:3"]);
});

for (const { query, wrongName, exactName, incomplete } of [
  {
    query: "pepsidiet",
    wrongName: "Pepsi dietary supplement",
    exactName: "Pepsi diet",
    incomplete: "pepsidi",
  },
  {
    query: "pepsizerosugar",
    wrongName: "Pepsi zero sugary",
    exactName: "Pepsi zero sugar",
    incomplete: "pepsizerosug",
  },
  {
    query: "chickenraw",
    wrongName: "Chicken rawhide",
    exactName: "Chicken raw",
    incomplete: "chickenra",
  },
  {
    query: "drpepperdiet",
    wrongName: "Dr Pepper dietary supplement",
    exactName: "Dr Pepper diet",
    incomplete: "drpepperdi",
  },
]) {
  test(`joined ${query} preserves completed qualifier boundaries and incomplete prefixes`, () => {
    assert.equal(createFoodCatalog([food(1, wrongName)]).search(query).total, 0);
    const exact = food(2, exactName);
    const catalog = createFoodCatalog([exact]);
    assert.equal(catalog.search(query).items[0], exact);
    assert.equal(catalog.search(incomplete).items[0], exact);
  });
}

test("joined completed qualifier can finish at a source word boundary", () => {
  const continued = food(3, "Pepsi diet cola");
  assert.equal(createFoodCatalog([continued]).search("pepsidiet").items[0], continued);
});

for (const { query, wrongName } of [
  { query: "pepsidiet", wrongName: "Pepsi dirt" },
  { query: "chickenraw", wrongName: "Chicken row" },
  { query: "pepsisugar", wrongName: "Pepsi sugax" },
  { query: "redbulx", wrongName: "Red Bull" },
]) {
  test(`joined ${query} cannot fuzz a completed qualifier or short source component`, () => {
    assert.equal(createFoodCatalog([food(1, wrongName)]).search(query).total, 0);
  });
}

test("joined ordinary and brand typos remain eligible when protected components are unchanged", () => {
  const catalog = createFoodCatalog([
    food(1, "Dr Pepper"),
    food(2, "Drpepper cherry"),
    food(3, "Chicken breast"),
    food(4, "Pepsi diet"),
    food(5, "Chicken raw"),
  ]);
  assert.deepEqual(new Set(ids(catalog.search("drpeper").items)), new Set(["usda:1", "usda:2"]));
  assert.equal(catalog.search("dr peper cherry").items[0]?.fdcId, 2);
  assert.equal(catalog.search("chikenbreast").items[0]?.fdcId, 3);
  assert.equal(catalog.search("pepsxdiet").items[0]?.fdcId, 4);
  assert.equal(catalog.search("chikenraw").items[0]?.fdcId, 5);
});

// Common preparation and nutrition labels attested in the bundled source catalog.
for (const qualifier of [
  "roasted",
  "toasted",
  "salted",
  "unsalted",
  "broiled",
  "smoked",
  "dried",
  "fresh",
  "frozen",
  "canned",
  "whole",
  "light",
  "reduced",
  "lean",
  "fortified",
  "prepared",
  "cured",
  "pickled",
  "mashed",
  "creamed",
  "breaded",
  "skinless",
  "boneless",
  "malted",
  "dry",
  "roast",
  "evaporated",
  "condensed",
  "instant",
  "sodium",
  "high",
  "full",
  "skin",
  "added",
  "no",
  "caffeine",
]) {
  for (const separator of [" ", ""]) {
    test(`${qualifier} stays exact in ${separator ? "separated" : "compact"} food queries`, () => {
      const exact = food(1, `Peanut ${qualifier}`);
      const query = `peanut${separator}${qualifier}`;
      const altered = `${qualifier.slice(0, -1)}x`;
      // Isolated wrong records prove rejection independently of result ranking.
      assert.equal(createFoodCatalog([food(2, `Peanut ${altered}`)]).search(query).total, 0);
      assert.equal(createFoodCatalog([exact]).search(`peanut${separator}${altered}`).total, 0);
      assert.equal(createFoodCatalog([food(3, `Peanut ${qualifier}extra`)]).search(query).total, 0);
      const catalog = createFoodCatalog([exact]);
      assert.equal(catalog.search(query).items[0], exact);
      assert.equal(catalog.search(`peanut${separator}${qualifier.slice(0, -1)}`).items[0], exact);
    });
  }
}

for (const [qualifier, wrong] of [
  ["roasted", "toasted"],
  ["toasted", "roasted"],
  ["salted", "malted"],
  ["whole", "while"],
  ["light", "night"],
]) {
  for (const separator of [" ", ""]) {
    test(`${qualifier} cannot become ${wrong} in ${separator ? "separated" : "compact"} queries`, () => {
      assert.equal(
        createFoodCatalog([food(1, `Peanut ${wrong}`)]).search(`peanut${separator}${qualifier}`)
          .total,
        0,
      );
    });
  }
}

for (const query of ["peanux roasted", "peanuxroasted", "dr peper roasted", "drpeperroasted"]) {
  test(`ordinary or brand typo ${query} retains unchanged preparation`, () => {
    const exact = query.startsWith("peanux")
      ? food(1, "Peanut roasted")
      : food(1, "Dr Pepper roasted");
    assert.equal(createFoodCatalog([exact]).search(query).items[0], exact);
  });
}
