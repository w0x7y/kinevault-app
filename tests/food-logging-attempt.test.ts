import assert from "node:assert/strict";
import test from "node:test";
import type { FoodEntry } from "../src/daily/model.ts";
import type { CustomFood } from "../src/food/custom-model.ts";
import { entryForFood, parseFoodLog, type FoodSaveTarget } from "../src/food/log-model.ts";
import { createFoodLoggingAttempt, defaultAmount } from "../src/food/logging-attempt.ts";
import { dataset, findFood, flush, foodStores } from "./helpers/food-stores.ts";

const banana = dataset.foods.find((food) => food.name === "Banana, raw");
assert.ok(banana?.per100g);
const cola = findFood(2710541);
assert.ok(cola);
const date = "2026-10-01";
const oats: CustomFood = {
  name: "Oat bowl",
  category: "Custom food",
  customId: "custom-oats",
  per100g: { calories: 120, carbs: 16, protein: 5, fat: 4 },
  portions: [{ label: "1 serving", grams: 250 }],
};
const oatsDraft = {
  name: "Oat bowl",
  servingGrams: "180",
  calories: "360",
  carbs: "36",
  protein: "18",
  fat: "14.4",
};

async function fixture(options?: { foods?: CustomFood[] }) {
  const stores = await foodStores(options);
  function open(target: FoodSaveTarget) {
    const attempt = createFoodLoggingAttempt({
      target,
      date,
      log: stores.log,
      catalog: stores.catalog,
      destination: stores.drafts.destination,
    });
    attempt.start();
    return attempt;
  }
  return { ...stores, open };
}

test("default amounts use a saved item's first serving and 100 g for bundled foods", () => {
  assert.equal(defaultAmount(oats), "250");
  assert.equal(defaultAmount({ ...oats, portions: [{ label: "tiny", grams: 1e-7 }] }), "0.0000001");
  assert.equal(defaultAmount({ ...oats, portions: [] }), "100");
  assert.ok(banana.portions.length > 0 && banana.portions[0].grams !== 100);
  assert.equal(defaultAmount(banana), "100");
});

test("a serving count becomes grams that log like typed grams", async () => {
  const f = await fixture();
  const attempt = f.open({ kind: "add", food: banana });
  assert.equal(attempt.getSnapshot().amount.servingsAvailable, true);
  attempt.setAmountBy("servings");
  const grams = () => attempt.getSnapshot().preparation.amount;
  for (const [count, amount] of [
    ["1", 126],
    ["2", 252],
    ["1,5", 189],
  ] as const) {
    attempt.setServings(count);
    assert.equal(grams(), amount);
  }
  attempt.choosePortion({ label: "1 slice", grams: 6 });
  attempt.setServings("0.333");
  assert.equal(grams(), 2, "rounded to 0.01 g");
  const snapshot = attempt.getSnapshot();
  assert.equal(snapshot.preparation.status, "ready");
  assert.equal(snapshot.amount.caption, "1 slice (6 g) each = 2 g");
  assert.deepEqual(
    snapshot.amount.portions.filter((portion) => portion.chosen).map((portion) => portion.label),
    ["1 slice"],
  );
  assert.equal(snapshot.fields.grams, "100", "the typed weight is kept");
  if (snapshot.preparation.status !== "ready") return;
  assert.equal(snapshot.preparation.write.kind, "add");
  assert.equal(snapshot.preparation.write.input.grams, 2);

  // The plain 100 g chip doesn't repeat its weight.
  attempt.choosePortion({ label: "100 g", grams: 100 });
  attempt.setServings("2");
  assert.equal(attempt.getSnapshot().amount.caption, "100 g each = 200 g");
});

test("an invalid serving count asks for servings, not grams", async () => {
  const f = await fixture();
  const attempt = f.open({ kind: "add", food: banana });
  attempt.setAmountBy("servings");
  for (const [count, status] of [
    ["0", "invalid"],
    ["abc", "invalid"],
    ["100", "invalid"],
    [" ", "incomplete"],
  ] as const) {
    attempt.setServings(count);
    const { preparation, amount } = attempt.getSnapshot();
    assert.equal(preparation.status, status);
    assert.equal(
      preparation.message,
      "Enter a number of servings that comes to more than 0 and up to 10,000 g.",
    );
    assert.equal(amount.caption, "1 banana (126 g) each");
  }
  attempt.setAmountBy("grams");
  assert.equal(attempt.getSnapshot().preparation.status, "ready", "weight still validates grams");
});

test("by weight a chip sets grams; leaving servings keeps their total as the weight", async () => {
  const f = await fixture();
  const attempt = f.open({ kind: "add", food: banana });
  attempt.choosePortion({ label: "1 cup", grams: 150 });
  assert.equal(attempt.getSnapshot().fields.grams, "150");
  assert.equal(attempt.getSnapshot().amount.caption, "");
  attempt.setAmountBy("servings");
  attempt.setServings("3");
  attempt.setAmountBy("grams");
  const { fields, amount, preparation } = attempt.getSnapshot();
  assert.equal(amount.by, "grams");
  assert.equal(fields.grams, "378");
  assert.equal(preparation.amount, 378);
});

test("servings are offered only when adding a gram-measured food with a portion", async () => {
  const f = await fixture();
  const available = (target: FoodSaveTarget) => {
    const attempt = f.open(target);
    attempt.setAmountBy("servings");
    const { amount } = attempt.getSnapshot();
    return [amount.servingsAvailable, amount.by];
  };
  assert.deepEqual(available({ kind: "add", food: banana }), [true, "servings"]);
  assert.deepEqual(available({ kind: "add", food: { ...banana, portions: [] } }), [false, "grams"]);
  assert.deepEqual(available({ kind: "add", food: cola }), [false, "grams"]);
  const entry = entryForFood({ id: "logged", food: banana, grams: 50, meal: "lunch" });
  assert.deepEqual(available({ kind: "edit", entry }), [false, "grams"]);
});

test("the counted serving follows the food's current portions", async () => {
  const f = await fixture({ foods: [oats] });
  const attempt = f.open({ kind: "add", food: oats });
  attempt.setAmountBy("servings");
  attempt.setServings("2");
  assert.equal(attempt.getSnapshot().preparation.amount, 500);

  // The edited serving weight replaces the one that no longer exists.
  assert.ok(await f.catalog.updateFood(oats.customId, oatsDraft));
  await flush();
  let snapshot = attempt.getSnapshot();
  assert.equal(snapshot.preparation.amount, 360);
  assert.equal(snapshot.amount.caption, "1 serving (180 g) each = 360 g");

  // A chosen choice still offered stays chosen.
  attempt.choosePortion({ label: "100 g", grams: 100 });
  assert.ok(await f.catalog.updateFood(oats.customId, { ...oatsDraft, servingGrams: "200" }));
  await flush();
  snapshot = attempt.getSnapshot();
  assert.equal(snapshot.preparation.amount, 200);
  assert.deepEqual(
    snapshot.amount.portions.map((portion) => [portion.label, portion.grams, portion.chosen]),
    [
      ["100 g", 100, true],
      ["1 serving", 200, false],
    ],
  );

  // A saved catalog edit restarts the count from the first serving.
  attempt.setServings("3");
  const edited = attempt.getSnapshot().item?.food;
  assert.ok(edited);
  attempt.catalogSaved(edited);
  snapshot = attempt.getSnapshot();
  assert.equal(snapshot.amount.by, "servings");
  assert.equal(snapshot.fields.servings, "1");
  assert.equal(snapshot.preparation.amount, 200);
});

test("adding starts from the food's default amount and the Meal destination", async () => {
  const f = await fixture({ foods: [{ ...oats, portions: [{ label: "1 serving", grams: 320 }] }] });
  const bundled = f.open({ kind: "add", food: banana }).getSnapshot();
  assert.deepEqual(bundled.fields, {
    grams: "100",
    amountBy: "grams",
    servings: "1",
    serving: undefined,
    drinkMl: "",
    meal: "breakfast",
    labelNutrition: { calories: "", carbs: "", protein: "", fat: "" },
  });
  assert.equal(bundled.preparation.status, "ready");
  assert.equal(bundled.submittable, true);
  assert.equal(bundled.item, undefined);

  // The current saved item, not the search result that opened it, supplies the serving.
  f.drafts.destination.set("dinner");
  const saved = f.open({ kind: "add", food: oats }).getSnapshot();
  assert.equal(saved.fields.grams, "320");
  assert.equal(saved.fields.meal, "dinner");
  assert.equal(saved.item?.kind, "food");
  assert.deepEqual(saved.target, { kind: "add", food: saved.item?.food });

  const drink = f.open({ kind: "add", food: cola }).getSnapshot();
  assert.equal(drink.fields.drinkMl, "");
  assert.equal(drink.preparation.measurement, "volume");
  assert.equal(drink.preparation.meal, "drinks");
  assert.equal(drink.preparation.status, "incomplete");
  assert.equal(drink.submittable, false);
});

test("the attempt names what it logs: a food, a saved meal or a drink", async () => {
  const f = await fixture();
  assert.equal(f.open({ kind: "add", food: banana }).getSnapshot().noun, "food");
  const meal = await f.catalog.addMeal({
    name: "Banana bowl",
    overrides: {},
    ingredients: [{ id: "banana", food: banana, amount: "120" }],
  });
  assert.ok(meal);
  assert.equal(f.open({ kind: "add", food: meal }).getSnapshot().noun, "meal");
  assert.equal(f.open({ kind: "add", food: cola }).getSnapshot().noun, "drink");
  const logged = entryForFood({ id: "drink", food: cola, measurement: "volume", drinkMl: 330 });
  assert.equal(f.open({ kind: "edit", entry: logged }).getSnapshot().noun, "drink");
});

test("editing starts from the logged amount, volume, and meal", async () => {
  const f = await fixture();
  const entry = entryForFood({ id: "logged", food: banana, grams: 37.5, meal: "snacks" });
  const food = f.open({ kind: "edit", entry }).getSnapshot();
  assert.equal(food.fields.grams, "37.5");
  assert.equal(food.fields.drinkMl, "");
  assert.equal(food.fields.meal, "snacks");
  assert.equal(food.preparation.operation, "edit");

  const drinkEntry = entryForFood({ id: "drink", food: cola, measurement: "volume", drinkMl: 330 });
  const drink = f.open({ kind: "edit", entry: drinkEntry }).getSnapshot();
  assert.equal(drink.fields.drinkMl, "330");
  assert.equal(drink.fields.grams, "100");
  assert.equal(drink.fields.meal, "drinks");
  assert.equal(drink.preparation.measurement, "volume");
  assert.equal(drink.preparation.status, "ready");
});

test("a submitted attempt durably logs exactly its prepared input", async () => {
  const f = await fixture();
  const attempt = f.open({ kind: "add", food: banana });
  attempt.setGrams("150");
  attempt.chooseMeal("lunch");
  const prepared = attempt.getSnapshot().preparation;
  assert.equal(prepared.status, "ready");
  assert.equal(await attempt.submit(), true);
  const [entry] = f.entries();
  assert.equal(entry.meal, "lunch");
  assert.equal(entry.grams, 150);
  if (prepared.status === "ready") assert.equal(entry.calories, prepared.nutrition.calories);
  assert.equal(attempt.getSnapshot().failed, false);
  assert.equal(attempt.getSnapshot().saving, false);
});

test("a failed save keeps the entered fields and meal and allows one retry", async () => {
  const f = await fixture();
  const attempt = f.open({ kind: "add", food: banana });
  attempt.setGrams("42");
  attempt.chooseMeal("dinner");
  const fields = attempt.getSnapshot().fields;
  const write = f.logStorage.holdWrite();
  const result = attempt.submit();
  write.open(true);
  assert.equal(await result, false);
  const failed = attempt.getSnapshot();
  assert.equal(failed.failed, true);
  assert.equal(failed.saving, false);
  assert.deepEqual(failed.fields, fields);
  assert.equal(failed.submittable, true);
  assert.deepEqual(f.entries(), []);
  assert.equal(await attempt.submit(), true);
  assert.equal(attempt.getSnapshot().failed, false);
  assert.deepEqual(
    f.entries().map(({ grams, meal }) => ({ grams, meal })),
    [{ grams: 42, meal: "dinner" }],
  );
});

test("a second submit while saving is ignored", async () => {
  const f = await fixture();
  const attempt = f.open({ kind: "add", food: banana });
  const write = f.logStorage.holdWrite();
  const first = attempt.submit();
  assert.equal(attempt.getSnapshot().saving, true);
  assert.equal(attempt.getSnapshot().busy, true);
  assert.equal(attempt.getSnapshot().submittable, false);
  assert.equal(await attempt.submit(), false);
  await flush();
  assert.equal(f.logStorage.writes(), 1);
  write.open();
  assert.equal(await first, true);
  assert.equal(attempt.getSnapshot().saving, false);
  assert.equal(f.entries().length, 1);
});

test("an unloaded food log, a catalog write, or unready input cannot be submitted", async () => {
  const f = await fixture({ foods: [oats] });
  const attempt = f.open({ kind: "add", food: banana });
  const reads = f.logStorage.holdReads();
  f.log.stop();
  f.log.start();
  assert.equal(f.log.getSnapshot().state.kind, "loading");
  assert.equal(attempt.getSnapshot().submittable, false);
  assert.equal(await attempt.submit(), false);
  reads.open();
  await flush();
  assert.equal(attempt.getSnapshot().submittable, true);

  const catalogWrite = f.catalogStorage.holdWrite();
  const removing = f.catalog.remove(oats.customId);
  assert.equal(attempt.getSnapshot().busy, true);
  assert.equal(attempt.getSnapshot().saving, false);
  assert.equal(attempt.getSnapshot().submittable, false);
  assert.equal(await attempt.submit(), false);
  catalogWrite.open();
  assert.equal(await removing, true);
  assert.equal(attempt.getSnapshot().busy, false);

  attempt.setGrams("");
  assert.equal(attempt.getSnapshot().submittable, false);
  assert.equal(await attempt.submit(), false);
  assert.equal(f.logStorage.writes(), 0);
});

test("a food-log refresh is not this attempt's save: logging stays available and waits for it", async () => {
  const f = await fixture();
  const attempt = f.open({ kind: "add", food: banana });
  attempt.chooseMeal("lunch");
  const reads = f.logStorage.holdReads();
  const other = entryForFood({ id: "other-device", food: banana, grams: 80, meal: "dinner" });
  f.logStorage.replace(JSON.stringify({ version: 1, days: { [date]: [other] } }));
  assert.equal(f.log.getSnapshot().saving, true, "the durable document is refreshing");
  const refreshing = attempt.getSnapshot();
  assert.equal(refreshing.saving, false);
  assert.equal(refreshing.busy, false);
  assert.equal(refreshing.submittable, true);

  const logged = attempt.submit();
  assert.equal(attempt.getSnapshot().saving, true);
  await flush();
  assert.equal(f.logStorage.writes(), 0, "the write waits for the refresh");
  reads.open();
  assert.equal(await logged, true);
  assert.deepEqual(
    f.entries().map(({ id, meal }) => [id, meal]),
    [
      ["other-device", "dinner"],
      ["entry-1", "lunch"],
    ],
  );
  assert.equal(attempt.getSnapshot().saving, false);
  assert.equal(attempt.getSnapshot().failed, false);
});

test("a result arriving after close is dropped", async () => {
  for (const outcome of [true, false]) {
    const f = await fixture();
    const attempt = f.open({ kind: "add", food: banana });
    const write = f.logStorage.holdWrite();
    const result = attempt.submit();
    attempt.close();
    const closed = attempt.getSnapshot();
    assert.equal(closed.submittable, false);
    assert.equal(closed.saving, false);
    let notified = 0;
    attempt.subscribe(() => notified++);
    write.open(!outcome);
    assert.equal(await result, false);
    assert.equal(notified, 0);
    assert.equal(attempt.getSnapshot(), closed);
    assert.equal(closed.failed, false);
  }
});

test("a closed attempt stops following its sources and reopening accepts new saves", async () => {
  const f = await fixture();
  const attempt = f.open({ kind: "add", food: banana });
  attempt.close();
  assert.equal(await attempt.submit(), false);
  let notified = 0;
  attempt.subscribe(() => notified++);
  f.drafts.destination.set("snacks");
  assert.equal(notified, 0);
  attempt.start();
  assert.equal(attempt.getSnapshot().fields.meal, "snacks");
  assert.equal(await attempt.submit(), true);
  assert.equal(f.entries().length, 1);
});

test("live catalog changes update the preview while a saved catalog edit resets the amount", async () => {
  const f = await fixture({ foods: [oats] });
  const attempt = f.open({ kind: "add", food: oats });
  const opened = attempt.getSnapshot().item?.food;
  attempt.setGrams("80");
  const edited = await f.catalog.updateFood(oats.customId, oatsDraft);
  assert.ok(edited);
  const live = attempt.getSnapshot();
  assert.equal(live.fields.grams, "80", "a live change keeps the entered amount");
  assert.deepEqual(live.target, { kind: "add", food: edited });
  assert.equal(live.preparation.status, "ready");
  if (live.preparation.status === "ready") assert.equal(live.preparation.nutrition.calories, 160);

  attempt.catalogSaved(edited);
  assert.equal(attempt.getSnapshot().fields.grams, "180");

  // A catalog edit can turn a saved food into a drink.
  await f.catalog.updateFood(oats.customId, { ...oatsDraft, drink: true });
  assert.equal(attempt.getSnapshot().preparation.measurement, "volume");

  // After deletion the opened item remains on screen until the view returns.
  assert.equal(await f.catalog.remove(oats.customId), true);
  assert.deepEqual(attempt.getSnapshot().target, { kind: "add", food: opened });
  assert.equal(attempt.getSnapshot().item?.food, opened);
});

test("a Selected day change while waiting for a refresh logs to the new day", async () => {
  const f = await fixture();
  const attempt = f.open({ kind: "add", food: banana });
  const reads = f.logStorage.holdReads();
  f.logStorage.replace(JSON.stringify({ version: 1, days: {} }));
  const logged = attempt.submit();
  await flush();
  attempt.setDate("2026-10-02");
  reads.open();
  assert.equal(await logged, true);
  assert.deepEqual(Object.keys(parseFoodLog(f.logStorage.raw()).days), ["2026-10-02"]);
});

test("the Selected day follows into the prepared write", async () => {
  const f = await fixture();
  const attempt = f.open({ kind: "add", food: banana });
  attempt.setDate("2026-10-02");
  const { preparation } = attempt.getSnapshot();
  assert.equal(preparation.status, "ready");
  if (preparation.status === "ready") assert.equal(preparation.write.input.date, "2026-10-02");
});

test("adding moves the shared Meal destination; a reopened catalog session restores its own", async () => {
  const f = await fixture({ foods: [oats] });
  const adding = f.open({ kind: "add", food: oats });
  adding.chooseMeal("dinner");
  assert.equal(f.drafts.destination.get(), "dinner");
  // The catalog editor captures Dinner; logging elsewhere moves on to Lunch.
  const session = f.drafts.open({ kind: "edit-food", item: oats });
  assert.equal(session.destination, "dinner");
  if (session.kind === "food")
    f.drafts.changeFood(session.handle, { ...session.draft, name: "Dinner oats" });
  adding.chooseMeal("lunch");
  assert.equal(adding.getSnapshot().fields.meal, "lunch");
  // Reopening the retained editor restores Dinner for the attempt that opened it.
  f.drafts.open({ kind: "edit-food", item: oats });
  assert.equal(adding.getSnapshot().fields.meal, "dinner");
  assert.equal(adding.getSnapshot().preparation.meal, "dinner");

  const entry: FoodEntry = entryForFood({ id: "logged", food: banana, grams: 100, meal: "lunch" });
  const editing = f.open({ kind: "edit", entry });
  editing.chooseMeal("snacks");
  assert.equal(editing.getSnapshot().fields.meal, "snacks");
  assert.equal(f.drafts.destination.get(), "dinner", "an edit keeps the destination");
  f.drafts.destination.set("breakfast");
  assert.equal(editing.getSnapshot().fields.meal, "snacks");
});
