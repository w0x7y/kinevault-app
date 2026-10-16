import assert from "node:assert/strict";
import test from "node:test";
import type { CustomFood } from "../src/food/custom-model.ts";
import { entryForFood } from "../src/food/log-model.ts";
import type { BrandedProduct } from "../src/food/product-model.ts";
import { createFoodTabView, type FoodTabPage } from "../src/food/tab-view.ts";
import { dataset, flush, foodStores } from "./helpers/food-stores.ts";

const banana = dataset.foods.find((food) => food.name === "Banana, raw");
assert.ok(banana?.per100g);
const date = "2026-10-01";
const nextDay = "2026-10-02";
const oats: CustomFood = {
  name: "Oats",
  category: "Custom food",
  customId: "oats",
  per100g: { calories: 200, carbs: 30, protein: 10, fat: 4 },
  portions: [{ label: "1 serving", grams: 100 }],
};
const product: BrandedProduct = {
  barcode: "3017620422003",
  name: "Cereal",
  brand: "Label brand",
  volumeBased: false,
  draft: {
    name: "Cereal",
    servingGrams: "100",
    calories: "300",
    carbs: "45",
    protein: "10",
    fat: "5",
  },
};

async function fixture({ foods = [oats] }: { foods?: CustomFood[] } = {}) {
  const stores = await foodStores({ foods });
  const lookups: { resolve: (product: BrandedProduct | null) => void; signal: AbortSignal }[] = [];
  const tab = createFoodTabView({
    date,
    drafts: stores.drafts,
    log: stores.log,
    catalog: stores.catalog,
    lookup: {
      lookupProduct: ({ signal }) => new Promise((resolve) => lookups.push({ resolve, signal })),
    },
  });
  tab.start();
  tab.setPresence({ focused: true, foreground: true });
  const page = () => tab.getSnapshot().page;
  function detail() {
    const current = page();
    assert.equal(current.kind, "detail");
    return current as Extract<FoodTabPage, { kind: "detail" }>;
  }
  return { ...stores, tab, page, detail, lookups };
}

test("a day change returns day-specific views to the new day's log and resets the destination", async () => {
  const f = await fixture();
  f.tab.search("banana");
  f.tab.select(banana);
  const { attempt } = f.detail();
  attempt.chooseMeal("lunch");
  f.tab.setDay(nextDay);
  assert.deepEqual(f.page(), { kind: "log" });
  assert.equal(f.tab.getSnapshot().query, "");
  assert.equal(f.drafts.destination.get(), "breakfast");
  assert.equal(attempt.getSnapshot().submittable, false, "the left attempt is closed");

  let day = nextDay;
  for (const open of [
    () => f.tab.macros(),
    () => f.tab.editEntry(entryForFood({ id: "logged", food: banana, grams: 50, meal: "dinner" })),
  ]) {
    open();
    day = day === date ? nextDay : date;
    f.tab.setDay(day);
    assert.deepEqual(f.page(), { kind: "log" });
  }
});

test("catalog views survive a day change and their Logging attempt follows the new day", async () => {
  const f = await fixture();
  f.tab.create();
  f.tab.setDay(nextDay);
  assert.equal(f.page().kind, "create");

  f.drafts.destination.set("snacks");
  f.tab.search("oats");
  f.tab.select(oats);
  f.tab.editCatalog();
  f.tab.setDay(date);
  assert.equal(f.detail().editor, true, "an open catalog editor survives");
  assert.equal(f.tab.getSnapshot().query, "oats");
  assert.equal(f.drafts.destination.get(), "snacks");
  f.tab.back();
  const { preparation } = f.detail().attempt.getSnapshot();
  assert.equal(preparation.date, date);
  f.tab.setDay(nextDay);
  assert.equal(f.page().kind, "log", "search details without an editor do not survive");

  const session = f.drafts.openCreation();
  if (session.kind === "food")
    f.drafts.changeFood(session.handle, { ...session.draft, name: "Bars", calories: "1" });
  f.tab.resume(session.handle);
  f.tab.created({ ...oats, customId: "bars", name: "Bars" });
  assert.equal(f.detail().origin, "created");
  f.tab.setDay(date);
  assert.equal(f.detail().origin, "created");
  assert.equal(f.detail().attempt.getSnapshot().preparation.date, date);
});

test("resumable drafts are offered unless a draft page or catalog editor is open", async () => {
  const f = await fixture();
  const resumable = () => f.tab.getSnapshot().resumable;
  assert.equal(resumable(), true);
  f.tab.create();
  assert.equal(resumable(), true);
  f.tab.macros();
  assert.equal(resumable(), true);
  f.tab.search("oats");
  f.tab.select(oats);
  assert.equal(resumable(), true);
  f.tab.editCatalog();
  assert.equal(resumable(), false);
  f.tab.back();
  assert.equal(resumable(), true);
  assert.equal(f.tab.scan(), true);
  assert.equal(resumable(), false);
  f.tab.back();
  const session = f.drafts.openCreation();
  f.tab.resume(session.handle);
  assert.equal(resumable(), false);
});

test("food-log and catalog writes lock the tab's actions until they settle", async () => {
  const f = await fixture();
  const snapshot = () => f.tab.getSnapshot();
  assert.equal(snapshot().busy, false);
  assert.equal(snapshot().createDisabled, false);
  assert.equal(snapshot().macrosDisabled, false);

  const write = f.logStorage.holdWrite();
  const adding = f.log.add({ date, food: banana, grams: 50, meal: "lunch" });
  assert.equal(snapshot().busy, true);
  assert.equal(snapshot().createDisabled, true);
  assert.equal(snapshot().macrosDisabled, true);
  assert.equal(f.tab.scan(), false);
  write.open();
  assert.equal(await adding, true);
  assert.equal(snapshot().busy, false);

  const reads = f.catalogStorage.holdReads();
  f.catalog.stop();
  f.catalog.start();
  assert.equal(snapshot().createDisabled, true, "Scan and Create need loaded Custom foods");
  assert.equal(snapshot().macrosDisabled, false);
  reads.open();
  await flush();
  assert.equal(snapshot().createDisabled, false);
});

test("Back from search details keeps the results and destination; other pages return to the log", async () => {
  const f = await fixture();
  f.tab.search("banana");
  f.tab.select(banana);
  f.detail().attempt.chooseMeal("dinner");
  const top = f.tab.getSnapshot().logTop;
  f.tab.back();
  assert.deepEqual(f.page(), { kind: "log" });
  assert.equal(f.tab.getSnapshot().query, "banana");
  assert.equal(f.drafts.destination.get(), "dinner");
  assert.equal(f.tab.getSnapshot().logTop, top);

  f.tab.macros();
  assert.equal(f.tab.getSnapshot().query, "");
  f.tab.back();
  assert.deepEqual(f.page(), { kind: "log" });
  assert.equal(f.drafts.destination.get(), "breakfast");
  assert.equal(f.tab.getSnapshot().logTop, top + 1);
});

test("logging returns to the log only for the attempt still on screen", async () => {
  const f = await fixture();
  f.tab.search("banana");
  f.tab.select(banana);
  f.detail().attempt.chooseMeal("lunch");
  assert.equal(await f.tab.submit(), true);
  assert.deepEqual(f.page(), { kind: "log" });
  assert.equal(f.tab.getSnapshot().query, "");
  assert.equal(f.entries()[0].meal, "lunch");

  f.tab.editEntry(f.entries()[0]);
  const write = f.logStorage.holdWrite();
  const saving = f.tab.submit();
  f.tab.setDay(nextDay);
  f.tab.macros();
  write.open();
  assert.equal(await saving, false, "a closed attempt drops its late result");
  assert.equal(f.page().kind, "macros");
});

test("a page waits hidden while the tab is away and returns with its attempt", async () => {
  const f = await fixture();
  f.tab.search("banana");
  f.tab.select(banana);
  const { attempt } = f.detail();
  attempt.setGrams("42");
  f.tab.setPresence({ focused: false, foreground: true });
  assert.equal(f.tab.getSnapshot().sheet, false);
  assert.equal(f.detail().attempt, attempt);

  // A log finishing while the page is hidden still returns its tab to the log.
  const write = f.logStorage.holdWrite();
  const saving = f.tab.submit();
  write.open();
  assert.equal(await saving, true);
  assert.deepEqual(f.page(), { kind: "log" });
  assert.equal(f.entries()[0].grams, 42);

  f.tab.setPresence({ focused: true, foreground: true });
  f.tab.select(banana);
  assert.equal(f.tab.getSnapshot().sheet, true);
});

test("leaving the tab closes the scanner and interrupts a lookup without losing its import", async () => {
  const f = await fixture();
  assert.equal(f.tab.scan(), true);
  f.tab.setPresence({ focused: false, foreground: true });
  assert.deepEqual(f.page(), { kind: "log" });
  f.tab.setPresence({ focused: true, foreground: true });

  assert.equal(f.tab.scan(), true);
  const page = f.page();
  assert.equal(page.kind, "import");
  if (page.kind !== "import") return;
  void page.flow.lookupBarcode(product.barcode);
  assert.equal(f.tab.getSnapshot().step, "import-loading");
  f.tab.setPresence({ focused: false, foreground: true });
  assert.equal(f.lookups[0].signal.aborted, true);
  const away = f.page();
  assert.equal(away.kind === "import" && away.state.kind, "error");
  f.tab.setPresence({ focused: true, foreground: true });
  assert.equal(f.tab.getSnapshot().sheet, true);
  assert.equal(f.page(), away);

  void page.flow.retry();
  f.lookups[1].resolve(product);
  await flush();
  assert.equal(f.tab.getSnapshot().step, "import-draft");
  const session = f.drafts.getSnapshot().session;
  assert.equal(session?.draft.name, "Cereal");
  f.tab.setPresence({ focused: false, foreground: true });
  f.tab.setDay(nextDay);
  f.tab.setPresence({ focused: true, foreground: true });
  assert.equal(f.tab.getSnapshot().step, "import-draft", "a review survives both");
  f.tab.back();
  assert.deepEqual(f.page(), { kind: "log" });
  assert.equal(f.drafts.getSnapshot().resumable.length, 1, "Back keeps the reviewed import");
});

test("a catalog save finishing while the tab is away opens the saved item", async () => {
  const f = await fixture();
  f.drafts.destination.set("dinner");
  f.tab.create();
  const session = f.drafts.getSnapshot().session;
  if (session?.kind !== "food") throw new Error("Expected a food draft");
  f.drafts.changeFood(session.handle, {
    ...session.draft,
    name: "Dinner bars",
    calories: "100",
    carbs: "10",
    protein: "5",
    fat: "2",
  });
  const write = f.catalogStorage.holdWrite();
  // The form hands its page's route to the owner; the form itself may be gone by then.
  const saved = f.drafts.save(session.handle, f.tab.created);
  f.tab.setPresence({ focused: false, foreground: true });
  write.open();
  assert.ok(await saved);
  const page = f.detail();
  assert.equal(page.origin, "created");
  assert.equal(page.saved, true);
  assert.equal(page.attempt.getSnapshot().fields.meal, "dinner");
  assert.equal(f.tab.getSnapshot().sheet, false);
  f.tab.setPresence({ focused: true, foreground: true });
  assert.equal(f.tab.getSnapshot().sheet, true);
});

test("editing the saved item restores its draft destination and a saved edit resets the amount", async () => {
  const f = await fixture();
  f.tab.search("oats");
  f.tab.select(oats);
  const { attempt } = f.detail();
  attempt.chooseMeal("dinner");
  f.tab.editCatalog();
  const session = f.drafts.getSnapshot().session;
  assert.equal(session?.destination, "dinner");
  if (session?.kind !== "food") return;
  f.drafts.changeFood(session.handle, { ...session.draft, servingGrams: "150" });
  f.tab.back();
  attempt.chooseMeal("lunch");
  attempt.setGrams("20");
  f.tab.editCatalog();
  assert.equal(attempt.getSnapshot().fields.meal, "dinner", "the retained draft's destination");
  const saved = await f.drafts.save(session.handle, f.tab.catalogSaved);
  assert.ok(saved);
  assert.equal(f.detail().editor, false);
  assert.equal(f.detail().saved, true);
  assert.equal(attempt.getSnapshot().fields.grams, "150");
});

test("deleting the saved item leaves its details; a failure stays with that page", async () => {
  const f = await fixture();
  f.tab.search("oats");
  f.tab.select(oats);
  const first = f.detail().attempt;
  const failing = f.catalogStorage.holdWrite();
  const removing = f.tab.deleteItem();
  failing.open(true);
  assert.equal(await removing, false);
  assert.equal(f.detail().attempt, first);
  assert.equal(f.drafts.getSnapshot().deletion?.caller, first);

  f.tab.back();
  f.tab.select(oats);
  assert.notEqual(f.drafts.getSnapshot().deletion?.caller, f.detail().attempt);
  assert.equal(await f.tab.deleteItem(), true);
  assert.deepEqual(f.page(), { kind: "log" });
  assert.equal(f.tab.getSnapshot().query, "oats");
  const state = f.catalog.getSnapshot().state;
  assert.equal(state.kind === "ready" && state.document.foods.length, 0);
});
