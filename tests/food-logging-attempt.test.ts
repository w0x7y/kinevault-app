import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { FoodEntry, Meal } from "../src/daily/model.ts";
import type { CatalogFood } from "../src/food/catalog.ts";
import { entryForFood, type FoodSaveTarget } from "../src/food/log-model.ts";
import {
  createFoodLoggingAttempt,
  defaultAmount,
  type FoodLoggingWrite,
} from "../src/food/logging-attempt.ts";

const dataset: { foods: CatalogFood[] } = JSON.parse(
  readFileSync(new URL("../assets/food/usda-fndds.json", import.meta.url), "utf8"),
);
const findFood = (id: number) => dataset.foods.find((food) => food.fdcId === id);
const banana = dataset.foods.find((food) => food.name === "Banana, raw");
assert.ok(banana?.per100g);
const cola = findFood(2710541);
assert.ok(cola);
const date = "2026-10-01";
const savedFood: CatalogFood = {
  name: "Oat bowl",
  category: "Custom food",
  customId: "custom-oats",
  per100g: { calories: 120, carbs: 16, protein: 5, fat: 4 },
  portions: [{ label: "1 serving", grams: 250 }],
};

function deferred() {
  let resolve!: (saved: boolean) => void;
  const promise = new Promise<boolean>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function open(
  target: FoodSaveTarget,
  options: {
    initialMeal?: Meal;
    catalogItem?: CatalogFood;
    save?: (write: FoodLoggingWrite) => Promise<boolean>;
  } = {},
) {
  const writes: FoodLoggingWrite[] = [];
  const intents: Meal[] = [];
  const attempt = createFoodLoggingAttempt({
    target,
    date,
    initialMeal: options.initialMeal,
    catalogItem: options.catalogItem,
    findFood,
    save: (write) => {
      writes.push(write);
      return options.save ? options.save(write) : Promise.resolve(true);
    },
    syncMealIntent: (meal) => intents.push(meal),
  });
  return { attempt, writes, intents };
}

test("default amounts use a saved item's first serving and 100 g for bundled foods", () => {
  assert.equal(defaultAmount(savedFood), "250");
  assert.equal(
    defaultAmount({ ...savedFood, portions: [{ label: "tiny", grams: 1e-7 }] }),
    "0.0000001",
  );
  assert.equal(defaultAmount({ ...savedFood, portions: [] }), "100");
  assert.ok(banana.portions.length > 0 && banana.portions[0].grams !== 100);
  assert.equal(defaultAmount(banana), "100");
});

test("adding starts from the food's default amount and the chosen or default meal", () => {
  const bundled = open({ kind: "add", food: banana }).attempt.getSnapshot();
  assert.deepEqual(bundled.fields, {
    grams: "100",
    drinkMl: "",
    meal: "breakfast",
    labelNutrition: { calories: "", carbs: "", protein: "", fat: "" },
  });
  assert.equal(bundled.preparation.status, "ready");
  assert.equal(bundled.submittable, true);

  const saved = open({ kind: "add", food: savedFood }, { initialMeal: "dinner" });
  assert.equal(saved.attempt.getSnapshot().fields.grams, "250");
  assert.equal(saved.attempt.getSnapshot().fields.meal, "dinner");

  // The current saved item, not the search result that opened it, supplies the serving.
  const current = { ...savedFood, portions: [{ label: "1 serving", grams: 320 }] };
  const live = open({ kind: "add", food: savedFood }, { catalogItem: current });
  assert.equal(live.attempt.getSnapshot().fields.grams, "320");
  assert.deepEqual(live.attempt.getSnapshot().target, { kind: "add", food: current });

  const drink = open({ kind: "add", food: cola }, { initialMeal: "lunch" }).attempt.getSnapshot();
  assert.equal(drink.fields.drinkMl, "");
  assert.equal(drink.preparation.measurement, "volume");
  assert.equal(drink.preparation.meal, "drinks");
  assert.equal(drink.preparation.status, "incomplete");
  assert.equal(drink.submittable, false);
});

test("editing starts from the logged amount, volume, and meal", () => {
  const entry = entryForFood({ id: "logged", food: banana, grams: 37.5, meal: "snacks" });
  const food = open({ kind: "edit", entry }).attempt.getSnapshot();
  assert.equal(food.fields.grams, "37.5");
  assert.equal(food.fields.drinkMl, "");
  assert.equal(food.fields.meal, "snacks");
  assert.equal(food.preparation.operation, "edit");

  const drinkEntry = entryForFood({
    id: "drink",
    food: cola,
    measurement: "volume",
    drinkMl: 330,
  });
  const drink = open({ kind: "edit", entry: drinkEntry }).attempt.getSnapshot();
  assert.equal(drink.fields.drinkMl, "330");
  assert.equal(drink.fields.grams, "100");
  assert.equal(drink.fields.meal, "drinks");
  assert.equal(drink.preparation.measurement, "volume");
  assert.equal(drink.preparation.status, "ready");
});

test("a submitted attempt writes exactly its prepared input", async () => {
  const { attempt, writes } = open({ kind: "add", food: banana });
  attempt.setGrams("150");
  attempt.chooseMeal("lunch");
  const prepared = attempt.getSnapshot().preparation;
  assert.equal(prepared.status, "ready");
  assert.equal(await attempt.submit(), true);
  assert.deepEqual(writes, [prepared.write]);
  assert.equal(attempt.getSnapshot().failed, false);
  assert.equal(attempt.getSnapshot().pending, false);
});

test("a failed save keeps the entered fields and meal and allows a retry", async () => {
  for (const failure of [
    () => Promise.resolve(false),
    () => Promise.reject(new Error("disk full")),
  ]) {
    const results = [failure, () => Promise.resolve(true)];
    const { attempt, writes } = open(
      { kind: "add", food: banana },
      { save: () => results.shift()!() },
    );
    attempt.setGrams("42");
    attempt.chooseMeal("dinner");
    const fields = attempt.getSnapshot().fields;
    assert.equal(await attempt.submit(), false);
    const failed = attempt.getSnapshot();
    assert.equal(failed.failed, true);
    assert.equal(failed.pending, false);
    assert.equal(failed.fields, fields);
    assert.equal(failed.fields.grams, "42");
    assert.equal(failed.fields.meal, "dinner");
    assert.equal(failed.submittable, true);
    assert.equal(await attempt.submit(), true);
    assert.equal(attempt.getSnapshot().failed, false);
    assert.equal(writes.length, 2);
    assert.deepEqual(writes[1], writes[0]);
  }
});

test("a second submit while saving is ignored", async () => {
  const write = deferred();
  const { attempt, writes } = open({ kind: "add", food: banana }, { save: () => write.promise });
  const first = attempt.submit();
  assert.equal(attempt.getSnapshot().pending, true);
  assert.equal(attempt.getSnapshot().submittable, false);
  assert.equal(await attempt.submit(), false);
  assert.equal(writes.length, 1);
  write.resolve(true);
  assert.equal(await first, true);
  assert.equal(attempt.getSnapshot().pending, false);
});

test("an unavailable food log or unready input cannot be submitted", async () => {
  const { attempt, writes } = open({ kind: "add", food: banana });
  attempt.refresh({ date, catalogItem: undefined, available: false });
  assert.equal(attempt.getSnapshot().submittable, false);
  assert.equal(await attempt.submit(), false);
  attempt.refresh({ date, catalogItem: undefined, available: true });
  attempt.setGrams("");
  assert.equal(attempt.getSnapshot().submittable, false);
  assert.equal(await attempt.submit(), false);
  assert.equal(writes.length, 0);
});

test("a result arriving after close is dropped", async () => {
  for (const outcome of [true, false]) {
    const write = deferred();
    const { attempt } = open({ kind: "add", food: banana }, { save: () => write.promise });
    const result = attempt.submit();
    attempt.close();
    const closed = attempt.getSnapshot();
    assert.equal(closed.submittable, false);
    let notified = 0;
    attempt.subscribe(() => notified++);
    write.resolve(outcome);
    assert.equal(await result, false);
    assert.equal(notified, 0);
    assert.equal(attempt.getSnapshot(), closed);
    assert.equal(closed.failed, false);
  }
});

test("reopening after close accepts new saves", async () => {
  const { attempt, writes } = open({ kind: "add", food: banana });
  attempt.close();
  assert.equal(await attempt.submit(), false);
  attempt.start();
  assert.equal(await attempt.submit(), true);
  assert.equal(writes.length, 1);
});

test("live catalog changes update the preview while a saved catalog edit resets the amount", () => {
  const { attempt } = open({ kind: "add", food: savedFood }, { catalogItem: savedFood });
  attempt.setGrams("80");
  const edited: CatalogFood = {
    ...savedFood,
    per100g: { calories: 200, carbs: 20, protein: 10, fat: 8 },
    portions: [{ label: "1 serving", grams: 180 }],
  };
  attempt.refresh({ date, catalogItem: edited, available: true });
  const live = attempt.getSnapshot();
  assert.equal(live.fields.grams, "80", "a live change keeps the entered amount");
  assert.deepEqual(live.target, { kind: "add", food: edited });
  assert.equal(live.preparation.status, "ready");
  assert.equal(live.preparation.nutrition.calories, 160);

  attempt.catalogSaved(edited);
  assert.equal(attempt.getSnapshot().fields.grams, "180");

  // After deletion the opened item remains on screen until the view returns.
  attempt.refresh({ date, catalogItem: undefined, available: true });
  assert.deepEqual(attempt.getSnapshot().target, { kind: "add", food: savedFood });

  // A catalog edit can turn a saved food into a drink.
  const drink: CatalogFood = {
    ...edited,
    beverage: { kind: "known-volume", source: "label", per100ml: edited.per100g! },
  };
  attempt.refresh({ date, catalogItem: drink, available: true });
  assert.equal(attempt.getSnapshot().preparation.measurement, "volume");
});

test("the Selected day follows refreshes into the prepared write", () => {
  const { attempt } = open({ kind: "add", food: banana });
  attempt.refresh({ date: "2026-10-02", catalogItem: undefined, available: true });
  const { preparation } = attempt.getSnapshot();
  assert.equal(preparation.status, "ready");
  assert.equal(preparation.write.input.date, "2026-10-02");
});

test("choosing a meal while adding syncs the catalog meal intent", () => {
  const adding = open({ kind: "add", food: banana });
  adding.attempt.chooseMeal("lunch");
  assert.deepEqual(adding.intents, ["lunch"]);
  assert.equal(adding.attempt.getSnapshot().fields.meal, "lunch");
  adding.attempt.restoreMeal("snacks");
  assert.deepEqual(adding.intents, ["lunch"], "a restored draft destination is not re-synced");
  assert.equal(adding.attempt.getSnapshot().preparation.meal, "snacks");

  const entry: FoodEntry = entryForFood({ id: "logged", food: banana, grams: 100, meal: "lunch" });
  const editing = open({ kind: "edit", entry });
  editing.attempt.chooseMeal("dinner");
  assert.deepEqual(editing.intents, []);
  assert.equal(editing.attempt.getSnapshot().fields.meal, "dinner");
});
