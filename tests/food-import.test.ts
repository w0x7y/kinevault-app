import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const nutrient = (id: number, unitName: string, amount: unknown) => ({
  nutrient: { id, unitName },
  amount,
});
const record = {
  fdcId: 2709224,
  description: "Banana, raw",
  dataType: "Survey (FNDDS)",
  publicationDate: "10/31/2024",
  wweiaFoodCategory: { wweiaFoodCategoryDescription: "Bananas" },
  foodNutrients: [
    nutrient(1003, "g", 0.74),
    nutrient(1004, "g", 0.28),
    nutrient(1005, "g", 22.7),
    nutrient(1008, "kcal", 97),
  ],
  foodPortions: [
    { portionDescription: "1 cup", gramWeight: 150, sequenceNumber: 2 },
    { portionDescription: "1 banana", gramWeight: 126, sequenceNumber: 1 },
    { portionDescription: "Quantity not specified", gramWeight: 126, sequenceNumber: 3 },
    { portionDescription: "Unknown weight", gramWeight: 0, sequenceNumber: 4 },
  ],
};

async function runImport(t: TestContext, records: unknown[]) {
  const directory = await mkdtemp(join(tmpdir(), "kine-food-import-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const input = join(directory, "input.json");
  const output = join(directory, "catalog.json");
  await writeFile(input, JSON.stringify({ SurveyFoods: records }));
  const result = spawnSync(
    "python3",
    ["scripts/import-food-catalog.py", input, "--output", output],
    { encoding: "utf8" },
  );
  return { result, output };
}

test("USDA import preserves nutrient units, source IDs, and ordered weighed portions", async (t) => {
  const { result, output } = await runImport(t, [record]);
  assert.equal(result.status, 0, result.stderr);
  const catalog = JSON.parse(await readFile(output, "utf8"));
  const { details, ...summary } = catalog.foods[0];
  assert.deepEqual(summary, {
    fdcId: 2709224,
    name: "Banana, raw",
    category: "Bananas",
    per100g: { calories: 97, carbs: 22.7, protein: 0.74, fat: 0.28 },
    portions: [
      { label: "1 banana", grams: 126 },
      { label: "1 cup", grams: 150 },
    ],
  });
  assert.equal(Object.keys(details).length, 12);
  assert.ok(Object.values(details).every((value) => value === null));
  assert.equal(catalog.source.license, "CC0-1.0");
  assert.equal(catalog.source.recordCount, 1);
});

test("USDA import excludes incomplete nutrition instead of fabricating zero values", async (t) => {
  const { result, output } = await runImport(t, [
    record,
    { ...record, fdcId: 2, foodNutrients: [] },
    {
      ...record,
      fdcId: 3,
      foodNutrients: record.foodNutrients.map((n) =>
        n.nutrient.id === 1008 ? nutrient(1008, "kJ", 400) : n,
      ),
    },
    {
      ...record,
      fdcId: 4,
      foodNutrients: record.foodNutrients.map((n) =>
        n.nutrient.id === 1003 ? nutrient(1003, "g", -1) : n,
      ),
    },
  ]);
  assert.equal(result.status, 0, result.stderr);
  const catalog = JSON.parse(await readFile(output, "utf8"));
  assert.equal(catalog.foods.length, 1);
  assert.equal(catalog.source.excludedCount, 3);
});

test("USDA import rejects duplicate food IDs instead of creating ambiguous selections", async (t) => {
  const { result } = await runImport(t, [record, record]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /duplicate/i);
});

test("USDA import rejects a different release instead of mislabeling its provenance", async (t) => {
  const { result } = await runImport(t, [{ ...record, publicationDate: "10/28/2022" }]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /release/i);
});

test("USDA import retains detailed units and distinguishes absent values from real zeros", async (t) => {
  const { result, output } = await runImport(t, [
    {
      ...record,
      foodNutrients: [
        ...record.foodNutrients,
        nutrient(1258, "g", 0.112),
        nutrient(1079, "g", 1.7),
        nutrient(2000, "g", 15.8),
        nutrient(1093, "mg", 0),
        nutrient(1253, "mg", 0),
        nutrient(1092, "mg", 326),
        nutrient(1087, "mg", 5),
        nutrient(1089, "mg", 0.56),
        nutrient(1114, "µg", 0.25),
        nutrient(1057, "mg", 85.3),
        nutrient(1018, "g", 2.1),
      ],
    },
  ]);
  assert.equal(result.status, 0, result.stderr);
  const catalog = JSON.parse(await readFile(output, "utf8"));
  assert.deepEqual(catalog.foods[0].details, {
    saturatedFat: 0.112,
    transFat: null,
    fiber: 1.7,
    totalSugars: 15.8,
    sodium: 0,
    cholesterol: 0,
    potassium: 326,
    calcium: 5,
    iron: 0.56,
    vitaminD: 0.25,
    caffeine: 85.3,
    alcohol: 2.1,
  });
});

test("USDA import does not treat invalid amounts or Vitamin D in IU as valid metric values", async (t) => {
  const { result, output } = await runImport(t, [
    {
      ...record,
      foodNutrients: [
        ...record.foodNutrients,
        nutrient(1257, "g", 0.2),
        nutrient(1093, "g", 5),
        nutrient(1079, "g", -1),
        nutrient(1114, "IU", 10),
        nutrient(1057, "mg", "0"),
      ],
    },
  ]);
  assert.equal(result.status, 0, result.stderr);
  const catalog = JSON.parse(await readFile(output, "utf8"));
  assert.equal(catalog.foods[0].details?.transFat, 0.2);
  assert.equal(catalog.foods[0].details?.sodium, null);
  assert.equal(catalog.foods[0].details?.fiber, null);
  assert.equal(catalog.foods[0].details?.vitaminD, null);
  assert.equal(catalog.foods[0].details?.caffeine, null);
});
