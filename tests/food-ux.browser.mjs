import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";

const baseURL = process.env.KINE_PREVIEW_URL || "http://localhost:8081";
const storageKey = "kinevault-track.custom-foods.v1";
const answers = { name: "Alex", goal: "maintain", activity: "moderate", age: "30", height: "180", weight: "80",
  sex: "male", estimateEnabled: true, eligible: true, customCalories: "" };
const product = { code: "3017620422003", product_name: "Fixture cereal", brands: "FixtureBrand", nutriments: {
  "energy-kcal_100g": 300, carbohydrates_100g: 45, proteins_100g: 10, fat_100g: 5,
  sodium_100g: 0.1, fiber_100g: 0, "vitamin-d_100g": 0.000002 } };
const button = (page, name) => page.getByRole("button", { name: name === "Log food" || name === "Log meal" ? new RegExp(`^${name} to `) : name, exact: true });
const field = (page, name) => page.getByRole("textbox", { name, exact: true });
const heading = (page, name) => page.getByRole("heading", { name, exact: true }).waitFor();
const catalog = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
async function open(t) {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(({ answers }) => {
    localStorage.setItem("kinevault-track.profile.v1", JSON.stringify({ version: 1, kind: "complete", answers }));
  }, { answers });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  await page.goto(baseURL);
  await page.getByRole("tab", { name: "Food", exact: true }).click();
  await heading(page, "Daily food log");
  return page;
}
async function expectCatalogSaved(page) {
  await page.getByText("Saved to your foods", { exact: true }).waitFor();
  assert.equal(await page.getByRole("dialog").count(), 0);
}
async function scan(page, code) {
  await button(page, "Scan food barcode").click();
  await heading(page, "Scan food barcode");
  await field(page, "Product barcode").fill(code);
  await button(page, "Look up barcode").click();
}
async function fillMacros(page) {
  for (const [name, value] of [["Calories (kcal)", "200"], ["Carbs (g)", "30"], ["Protein (g)", "10"], ["Fat (g)", "4"]])
    await field(page, name).fill(value);
}
const json = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

test("food and meal drafts survive global navigation, discard and successful save", async t => {
  const page = await open(t);
  await button(page, "Create food/meal").click();
  await field(page, "Food name").fill("Retained oats");
  await fillMacros(page);
  await button(page, "More nutrients").click();
  await field(page, "Sodium (mg)").fill("123");
  await field(page, "Search foods").fill("apple");
  await button(page, "Create food/meal").click();
  assert.equal(await field(page, "Food name").inputValue(), "Retained oats");
  if (!await field(page, "Sodium (mg)").count()) await button(page, "More nutrients").click();
  assert.equal(await field(page, "Sodium (mg)").inputValue(), "123");
  await button(page, "Save food").click();
  await expectCatalogSaved(page);
  await button(page, "Edit food").click();
  await field(page, "Food name").fill("Edited draft oats");
  await field(page, "Search foods").fill("apple");
  await button(page, "Resume draft: Edited draft oats").click();
  assert.equal(await field(page, "Food name").inputValue(), "Edited draft oats");
  await button(page, "Cancel").click();
  assert.equal(await button(page, "Resume draft: Edited draft oats").count(), 0);
  await button(page, "Create food/meal").click();
  assert.equal(await field(page, "Food name").inputValue(), "");
  await page.getByTestId("food-creation-switch").getByRole("button", { name: "Meal", exact: true }).click();
  await field(page, "Meal name").fill("Retained bowl");
  await field(page, "Search ingredients").fill("Retained oats");
  await button(page, "Add Retained oats to meal, custom food").click();
  await field(page, "Amount for Retained oats (g)").fill("75");
  await field(page, "Calories (kcal)").fill("321");
  await button(page, "More nutrients").click();
  await field(page, "Sodium (mg)").fill("45");
  await field(page, "Search foods").fill("apple");
  await button(page, "Create food/meal").click();
  assert.equal(await field(page, "Meal name").inputValue(), "Retained bowl");
  assert.equal(await field(page, "Amount for Retained oats (g)").inputValue(), "75");
  assert.equal(await field(page, "Calories (kcal)").inputValue(), "321");
  if (!await field(page, "Sodium (mg)").count()) await button(page, "More nutrients").click();
  assert.equal(await field(page, "Sodium (mg)").inputValue(), "45");
  await button(page, "Cancel").click();
  await button(page, "Create food/meal").click();
  assert.equal(await field(page, "Meal name").inputValue(), "");
  assert.equal(await field(page, "Amount for Retained oats (g)").count(), 0);
});

test("import review resumes without another request and preserves provenance through failed save", async t => {
  const page = await open(t);
  let requests = 0;
  await page.route("**/api/v2/product/**", route => { requests++; return json(route, { status: 1, product }); });
  await scan(page, product.code);
  await heading(page, "Review imported food");
  await field(page, "Food name").fill("Imported draft");
  await field(page, "Brand (optional)").fill("Draft brand");
  await field(page, "Carbs (g)").fill("42");
  await field(page, "Search foods").fill("apple");
  await button(page, "Resume draft: Imported draft").click();
  assert.equal(requests, 1);
  assert.equal(await field(page, "Food name").inputValue(), "Imported draft");
  assert.equal(await field(page, "Carbs (g)").inputValue(), "42");
  await page.evaluate(key => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(nextKey, value) {
      if (nextKey === key) { Storage.prototype.setItem = original; throw new Error("Fixture save failure"); }
      return original.call(this, nextKey, value);
    };
  }, storageKey);
  await button(page, "Save food").click();
  await page.getByRole("alert").filter({ hasText: "Couldn't save" }).waitFor();
  await field(page, "Search foods").fill("apple");
  await button(page, "Resume draft: Imported draft").click();
  assert.equal(await field(page, "Food name").inputValue(), "Imported draft");
  await button(page, "Save food").click();
  await expectCatalogSaved(page);
  const saved = (await catalog(page)).foods[0];
  assert.equal(saved.importSource.barcode, product.code);
  assert.equal(saved.importSource.method, "barcode");
  assert.equal(saved.brand, "Draft brand");
  assert.equal(await button(page, "Resume draft: Imported draft").count(), 0);
});

const intake = page => page.evaluate(() => {
  const document = JSON.parse(localStorage.getItem("kinevault-track.food-log.v1") || "null");
  return document ? Object.values(document.days).flat() : [];
});

// Set a destination through the global search/detail flow, which also updates
// the draft owner context used by create and barcode review.
async function chooseDestination(page, meal) {
  await field(page, "Search foods").fill("");
  await field(page, "Search foods").fill("banana");
  await button(page, "View nutrition for Banana, raw").click();
  await button(page, meal).click();
}

test("global search opens nutrition on the first focused click and logs a source portion to Lunch", async t => {
  const page = await open(t);
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.equal(await page.getByRole("button", { name: /^Add food to / }).count(), 0);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await field(page, "Search foods").fill("banana");
  assert.ok(await field(page, "Search foods").evaluate(input => document.activeElement === input));
  await page.getByTestId("food-catalog-results").getByRole("button", { name: /^View nutrition for Banana, raw$/ }).click();
  await page.getByTestId("food-nutrition-detail").waitFor();
  assert.equal(await field(page, "Search foods").evaluate(input => document.activeElement === input), false);
  assert.equal(await button(page, "Breakfast").getAttribute("aria-pressed"), "true");
  await button(page, "Lunch").click();
  const detail = page.getByTestId("food-nutrition-detail");
  const portion = detail.getByRole("button", { name: /, [0-9.]+ g$/ }).first();
  await portion.click();
  const grams = Number(await field(page, "Amount (g)").inputValue());
  assert.notEqual(grams, 100);
  assert.equal(await button(page, "Lunch").getAttribute("aria-pressed"), "true");
  assert.deepEqual(await intake(page), []);
  // Serving presets precede nutrition and the final log action in reading order.
  assert.ok(await portion.evaluate(element => Boolean(element.compareDocumentPosition(
    document.querySelector('[data-testid="food-nutrition-detail"] button[aria-label="Log food to Lunch"]')) & Node.DOCUMENT_POSITION_FOLLOWING)));
  await button(page, "Log food to Lunch").click();
  await heading(page, "Daily food log");
  const entries = await intake(page);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].meal, "lunch");
  assert.equal(entries[0].grams, grams);
  const lunch = page.getByTestId("meal-lunch");
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const edit = await button(lunch, "Edit Banana, raw in Lunch").boundingBox();
    const name = await lunch.getByText("Banana, raw", { exact: true }).boundingBox();
    const remove = await button(lunch, "Remove Banana, raw from Lunch").boundingBox();
    assert.ok(edit.height >= 44 && edit.width >= 44);
    assert.ok(remove.height >= 44 && remove.width >= 44);
    assert.ok(edit.x + edit.width <= name.x, "Edit precedes the entry name at the far left");
    assert.ok(name.x + name.width <= remove.x, "Remove follows the entry name on the right");
    assert.equal(await page.getByRole("button", { name: /^Add food to / }).count(), 0);
  }
});

test("detail meal choice retains Snacks through barcode review resume and catalog save", async t => {
  const page = await open(t);
  await page.route("**/api/v2/product/**", route => json(route, { status: 1, product }));
  await chooseDestination(page, "Snacks");
  await scan(page, product.code);
  await heading(page, "Review imported food");
  await field(page, "Food name").fill("Snack cereal");
  await field(page, "Search foods").fill("banana");
  await field(page, "Search foods").fill("");
  await chooseDestination(page, "Lunch");
  await button(page, "Resume draft: Snack cereal").click();
  await button(page, "Save food").click();
  await expectCatalogSaved(page);
  assert.deepEqual(await intake(page), []);
  assert.equal((await catalog(page)).foods.length, 1);
  assert.equal(await button(page, "Snacks").getAttribute("aria-pressed"), "true");
  await button(page, "Log food to Snacks").click();
  await heading(page, "Daily food log");
  assert.equal((await intake(page))[0].meal, "snacks");
});

test("Lunch creation saves inline without intake and destination remains changeable", async t => {
  const page = await open(t);
  await chooseDestination(page, "Lunch");
  await button(page, "Create food/meal").click();
  await field(page, "Food name").fill("Lunch oats");
  await fillMacros(page);
  await field(page, "Search foods").fill("banana");
  await button(page, "Create food/meal").click();
  await button(page, "Save food").click();
  await expectCatalogSaved(page);
  assert.deepEqual(await intake(page), []);
  assert.equal(await button(page, "Lunch").getAttribute("aria-pressed"), "true");
  await button(page, "Dinner").click();
  await button(page, "Log food to Dinner").click();
  await heading(page, "Daily food log");
  assert.equal((await intake(page))[0].meal, "dinner");
});

test("expanded source servings scale nutrition and keep the Lunch destination", async t => {
  const page = await open(t);
  await field(page, "Search foods").fill("banana");
  await button(page, "View nutrition for Banana, raw").click();
  await button(page, "Lunch").click();
  assert.equal(await button(page, "1 cup, mashed, 225 g").count(), 0);
  assert.equal(await button(page, "More serving sizes").getAttribute("aria-expanded"), "false");
  await button(page, "More serving sizes").click();
  assert.equal(await button(page, "Fewer serving sizes").getAttribute("aria-expanded"), "true");
  await button(page, "1 cup, mashed, 225 g").click();
  assert.equal(await field(page, "Amount (g)").inputValue(), "225");
  await page.getByText("Nutrition for 225 g", { exact: true }).waitFor();
  await page.getByText("218 kcal", { exact: true }).waitFor();
  assert.equal(await button(page, "Lunch").getAttribute("aria-pressed"), "true");
  await button(page, "Log food to Lunch").click();
  await heading(page, "Daily food log");
  const [entry] = await intake(page);
  assert.equal(entry.meal, "lunch");
  assert.equal(entry.grams, 225);
  assert.equal(entry.calories, 218.25);
});

for (const mode of ["barcode", "manual barcode"]) {
  test(`reopening the same ${mode} restores retained Snacks destination after Lunch entry`, async t => {
    const page = await open(t);
    let requests = 0;
    await page.route("**/api/v2/product/**", route => {
      requests++;
      return json(route, mode === "manual barcode" ? { status: 0 } : { status: 1, product });
    });
    async function reopenReview() {
      await scan(page, product.code);
      if (mode === "manual barcode") {
        await heading(page, "Product not found");
        await button(page, "Enter food manually").click();
      }
      await heading(page, "Review imported food");
    }
    await chooseDestination(page, "Snacks");
    await reopenReview();
    if (mode === "manual barcode") await fillMacros(page);
    await field(page, "Food name").fill(`Retained ${mode} snack`);
    await field(page, "Carbs (g)").fill("42");
    await field(page, "Search foods").fill("banana");
    await field(page, "Search foods").fill("");
    await chooseDestination(page, "Lunch");
    await reopenReview();
    assert.equal(requests, 1);
    assert.equal(await field(page, "Food name").inputValue(), `Retained ${mode} snack`);
    assert.equal(await field(page, "Carbs (g)").inputValue(), "42");
    await button(page, "Save food").click();
    await expectCatalogSaved(page);
    assert.deepEqual(await intake(page), []);
    assert.equal(await button(page, "Snacks").getAttribute("aria-pressed"), "true");
    await button(page, "Log food to Snacks").click();
    await heading(page, "Daily food log");
    const [entry] = await intake(page);
    assert.equal(entry.meal, "snacks");
    assert.equal(entry.name, `Retained ${mode} snack`);
    assert.equal((await catalog(page)).foods[0].importSource.method, "barcode");
  });
}

async function createLunchFood(page) {
  await chooseDestination(page, "Lunch");
  await button(page, "Create food/meal").click();
  await field(page, "Food name").fill("Destination oats");
  await fillMacros(page);
  await button(page, "Save food").click();
  await expectCatalogSaved(page);
}

for (const outcome of ["Cancel", "Save food changes"]) {
  test(`changed Dinner destination survives catalog editor ${outcome}`, async t => {
    const page = await open(t);
    await createLunchFood(page);
    await button(page, "Dinner").click();
    await button(page, "Edit food").click();
    await field(page, "Food name").fill("Dinner oats");
    await button(page, outcome).click();
    assert.equal(await button(page, "Dinner").getAttribute("aria-pressed"), "true");
    assert.deepEqual(await intake(page), []);
    await button(page, "Log food to Dinner").click();
    await heading(page, "Daily food log");
    const [entry] = await intake(page);
    assert.equal(entry.meal, "dinner");
    assert.equal(entry.name, outcome === "Cancel" ? "Destination oats" : "Dinner oats");
    // Returning to the daily log resets add intent to Breakfast. Intake edit must
    // still initialize from the saved Dinner entry.
    await button(page, `Edit ${entry.name} in Dinner`).click();
    assert.equal(await button(page, "Dinner").getAttribute("aria-pressed"), "true");
    await field(page, "Amount (g)").fill("75");
    await button(page, "Save changes").click();
    await heading(page, "Daily food log");
    const [edited] = await intake(page);
    assert.equal(edited.meal, "dinner");
    assert.equal(edited.grams, 75);
  });
}

test("changed Dinner destination belongs to a retained catalog-editor draft", async t => {
  const page = await open(t);
  await createLunchFood(page);
  await button(page, "Dinner").click();
  await button(page, "Edit food").click();
  await field(page, "Food name").fill("Dinner editor draft");
  await field(page, "Search foods").fill("banana");
  await field(page, "Search foods").fill("");
  await chooseDestination(page, "Snacks");
  await button(page, "Resume draft: Dinner editor draft").click();
  await button(page, "Save food changes").click();
  await expectCatalogSaved(page);
  assert.equal(await button(page, "Dinner").getAttribute("aria-pressed"), "true");
  assert.deepEqual(await intake(page), []);
  await button(page, "Log food to Dinner").click();
  await heading(page, "Daily food log");
  assert.equal((await intake(page))[0].meal, "dinner");
});

async function seedEditableCatalog(page) {
  await page.evaluate(key => {
    const food = { customId: "review-oats", name: "Review oats", category: "Custom food",
      per100g: { calories: 200, carbs: 30, protein: 10, fat: 4 }, portions: [{ label: "1 serving", grams: 100 }] };
    const meal = { customId: "review-bowl", name: "Review bowl", category: "Custom meal",
      per100g: food.per100g, portions: [{ label: "1 meal", grams: 100 }],
      ingredients: [{ id: "oats", food, grams: 100 }], overrides: {} };
    localStorage.setItem(key, JSON.stringify({ version: 1, foods: [food], meals: [meal] }));
  }, storageKey);
  await page.reload();
  await page.getByRole("tab", { name: "Food", exact: true }).click();
  await heading(page, "Daily food log");
}
async function openSavedItem(page, kind) {
  const name = kind === "food" ? "Review oats" : "Review bowl";
  await field(page, "Search foods").fill("");
  await field(page, "Search foods").fill(name);
  await button(page, `View nutrition for ${name}, custom ${kind}`).click();
}

for (const kind of ["food", "meal"]) {
  test(`ordinary catalog ${kind} Edit reentry restores retained Dinner destination`, async t => {
    const page = await open(t);
    await seedEditableCatalog(page);
    await chooseDestination(page, "Lunch");
    await openSavedItem(page, kind);
    await button(page, "Dinner").click();
    await button(page, `Edit ${kind}`).click();
    const nameField = kind === "food" ? "Food name" : "Meal name";
    await field(page, nameField).fill(`Retained dinner ${kind}`);
    await field(page, "Search foods").fill("banana");
    await field(page, "Search foods").fill("");
    await chooseDestination(page, "Snacks");
    await openSavedItem(page, kind);
    await button(page, `Edit ${kind}`).click();
    assert.equal(await field(page, nameField).inputValue(), `Retained dinner ${kind}`);
    await button(page, `Save ${kind} changes`).click();
    assert.equal(await button(page, "Dinner").getAttribute("aria-pressed"), "true");
    assert.deepEqual(await intake(page), []);
    // A new editor draft must inherit the restored owner context too, rather
    // than only retaining Dinner locally on this detail screen.
    await button(page, `Edit ${kind}`).click();
    await field(page, nameField).fill(`Follow-on dinner ${kind}`);
    await field(page, "Search foods").fill("banana");
    await button(page, `Resume draft: Follow-on dinner ${kind}`).click();
    await button(page, `Save ${kind} changes`).click();
    assert.equal(await button(page, "Dinner").getAttribute("aria-pressed"), "true");
    await button(page, `Log ${kind} to Dinner`).click();
    await heading(page, "Daily food log");
    const [entry] = await intake(page);
    assert.equal(entry.meal, "dinner");
    assert.equal(entry.name, `Follow-on dinner ${kind}`);
  });

  test(`paused editor deletion reconciles only the ${kind} draft after success`, async t => {
    const page = await open(t);
    await seedEditableCatalog(page);
    const otherKind = kind === "food" ? "meal" : "food";
    await openSavedItem(page, otherKind);
    await button(page, `Edit ${otherKind}`).click();
    await field(page, otherKind === "food" ? "Food name" : "Meal name").fill("Unrelated retained editor");
    await openSavedItem(page, kind);
    await button(page, `Edit ${kind}`).click();
    await field(page, kind === "food" ? "Food name" : "Meal name").fill("Deleted editor draft");
    await openSavedItem(page, kind);
    await button(page, `Delete ${kind}`).click();
    const confirmation = page.getByRole("dialog", { name: `Delete custom ${kind}?` });
    await page.evaluate(key => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function(nextKey, value) {
        if (nextKey === key) { Storage.prototype.setItem = original; throw new Error("Fixture delete failure"); }
        return original.call(this, nextKey, value);
      };
    }, storageKey);
    await confirmation.getByRole("button", { name: `Delete ${kind}`, exact: true }).click();
    await confirmation.getByRole("alert").waitFor();
    await confirmation.getByRole("button", { name: "Cancel", exact: true }).click();
    assert.equal(await button(page, "Resume draft: Deleted editor draft").count(), 1);
    assert.equal(await button(page, "Resume draft: Unrelated retained editor").count(), 1);
    assert.equal((await catalog(page))[kind === "food" ? "foods" : "meals"].length, 1);
    await button(page, "Resume draft: Deleted editor draft").click();
    assert.equal(await field(page, kind === "food" ? "Food name" : "Meal name").inputValue(), "Deleted editor draft");
    await openSavedItem(page, kind);
    await button(page, `Delete ${kind}`).click();
    await confirmation.getByRole("button", { name: `Delete ${kind}`, exact: true }).click();
    await confirmation.waitFor({ state: "hidden" });
    assert.equal((await catalog(page))[kind === "food" ? "foods" : "meals"].length, 0);
    assert.equal(await button(page, "Resume draft: Deleted editor draft").count(), 0);
    assert.equal(await button(page, "Resume draft: Unrelated retained editor").count(), 1);
    await button(page, "Resume draft: Unrelated retained editor").click();
    assert.equal(await field(page, otherKind === "food" ? "Food name" : "Meal name").inputValue(), "Unrelated retained editor");
    assert.deepEqual(await intake(page), []);
  });
}


test("saving each creation retires only that draft across food and meal switches", async t => {
  const page = await open(t);
  await chooseDestination(page, "Lunch");
  await button(page, "Create food/meal").click();
  await field(page, "Food name").fill("Independent lunch oats");
  await fillMacros(page);
  await chooseDestination(page, "Dinner");
  await button(page, "Create food/meal").click();
  await page.getByTestId("food-creation-switch").getByRole("button", { name: "Meal", exact: true }).click();
  await field(page, "Meal name").fill("Independent bowl");
  await field(page, "Search ingredients").fill("banana");
  await button(page, "Add Banana, raw to meal").click();
  await field(page, "Amount for Banana, raw (g)").fill("75");
  await page.getByTestId("food-creation-switch").getByRole("button", { name: "Food", exact: true }).click();
  assert.equal(await field(page, "Food name").inputValue(), "Independent lunch oats");
  await button(page, "Save food").click();
  await expectCatalogSaved(page);
  assert.equal(await button(page, "Lunch").getAttribute("aria-pressed"), "true");
  await button(page, "Create food/meal").click();
  assert.equal(await field(page, "Food name").inputValue(), "");
  await page.getByTestId("food-creation-switch").getByRole("button", { name: "Meal", exact: true }).click();
  assert.equal(await field(page, "Meal name").inputValue(), "Independent bowl");
  assert.equal(await field(page, "Amount for Banana, raw (g)").inputValue(), "75");
  await button(page, "Save meal").click();
  await page.getByText("Saved to your meals", { exact: true }).waitFor();
  assert.equal((await catalog(page)).foods.length, 1);
  assert.equal((await catalog(page)).meals.length, 1);
  assert.deepEqual(await intake(page), []);
  await button(page, "Create food/meal").click();
  assert.equal(await field(page, "Meal name").inputValue(), "");
});
