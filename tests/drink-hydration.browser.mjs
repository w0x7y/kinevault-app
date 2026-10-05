import { installAccountFixture } from "./helpers/account-fixture.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const baseURL = process.env.KINE_PREVIEW_URL || "http://localhost:8081";
const foodKey = "kinevault-track.food-log.v1";
const waterKey = "kinevault-track.water-log.v1";
const date = "2026-10-01";
const answers = { name: "Drink fixture", goal: "maintain", activity: "moderate", age: "30", height: "180", weight: "80",
  sex: "male", estimateEnabled: true, eligible: true, customCalories: "" };
const button = (page, name) => page.getByRole("button", { name, exact: true });
const field = (page, name) => page.getByRole("textbox", { name, exact: true });
const heading = (page, name) => page.getByRole("heading", { name, exact: true }).waitFor();
function projectedProduct(route, product) {
  const fields = new URL(route.request().url()).searchParams.get("fields")?.split(",") ?? [];
  return Object.fromEntries(Object.entries(product).filter(([key]) => fields.includes(key)));
}
const stored = (page, key) => page.evaluate(key => JSON.parse(window.accountFixture.getItem(key)), key);
const entries = async page => (await stored(page, foodKey))?.days[date] ?? [];
async function open(t, { food = null, water = null, waterState = "ready", custom = [] } = {}) {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 320, height: 844 }, timezoneId: "Asia/Jerusalem" });
  await context.addInitScript(({ answers, foodKey, waterKey, food, water, waterState, custom }) => {
    if (!sessionStorage.getItem("drink-fixture-seeded")) {
      localStorage.setItem("kinevault-track.profile.v1", JSON.stringify({ version: 1, kind: "complete", answers }));
      if (food !== null) localStorage.setItem(foodKey, JSON.stringify(food));
      localStorage.setItem("kinevault-track.custom-foods.v1", JSON.stringify({ version: 1, foods: custom, meals: [] }));
      if (water !== null) localStorage.setItem(waterKey, JSON.stringify(water));
      sessionStorage.setItem("drink-fixture-seeded", "true");
    }
    const get = Storage.prototype.getItem;
    window.__waterFailure = waterState === "error";
    let delayed = waterState === "loading";
    Storage.prototype.getItem = function(key) {
      if (key.endsWith(waterKey) && window.accountFixture?.domainReady && window.__waterFailure) throw new Error("Fixture read error");
      if (key.endsWith(waterKey) && window.accountFixture?.domainReady && delayed) {
        delayed = false;
        return new Promise(resolve => { window.__releaseWaterRead = () => resolve(get.call(this, key)); });
      }
      return get.call(this, key);
    };
  }, { answers, foodKey, waterKey, food, water, waterState, custom });
  await installAccountFixture(context);
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.setDefaultNavigationTimeout(30000);
  await page.clock.install({ time: new Date("2026-10-01T12:00:00+03:00") });
  await page.goto(baseURL);
  await page.getByTestId("home-water").waitFor();
  return page;
}
async function tab(page, name) { await page.getByRole("tab", { name, exact: true }).click(); }
async function addCola(page) {
  await tab(page, "Food");
  await field(page, "Search foods").fill("cola");
  await page.getByTestId("food-catalog-results").getByRole("button", { name: "View nutrition for Soft drink, cola", exact: true }).click();
  await field(page, "Drink amount (ml)").waitFor();
}
async function total(page, litres) {
  await tab(page, "Home");
  await page.getByTestId("home-water").getByText(litres, { exact: true }).waitFor();
}
async function log(page) { await button(page, "Log drink to Drinks").click(); await heading(page, "Daily food log"); }
async function edit(page) { await button(page, "Edit Soft drink, cola in Drinks").click(); await field(page, "Drink amount (ml)").waitFor(); }
async function saveEdit(page) { await button(page, "Save changes").click(); await heading(page, "Daily food log"); }
async function failNextFoodWrite(page) {
  await page.evaluate(key => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function(k, value) {
      if (k.endsWith(key)) { Storage.prototype.setItem = set; throw new Error("Fixture write failure"); }
      return set.call(this, k, value);
    };
  }, foodKey);
}
async function previousDay(page) {
  await button(page, "Expand calendar").click();
  await button(page, "Select previous day").click();
  await button(page, "Collapse calendar").click();
}

test("Drinks Add logs explicit ml, combines manual water, scales nutrition, removes and reloads by date", async t => {
  const page = await open(t, { water: { version: 1, days: { [date]: 100 } } });
  await addCola(page);
  const detail = page.getByTestId("food-nutrition-detail");
  assert.equal(await detail.getByRole("alert").count(), 0, "untouched required volume uses neutral guidance");
  for (const name of ["Breakfast", "Lunch", "Dinner", "Snacks", "Drinks"]) assert.equal(await button(detail, name).count(), 0);
  assert.equal(await field(page, "Amount (g)").count(), 0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  for (const invalid of ["", "0", "1.5", "10001", "-5"]) {
    await field(page, "Drink amount (ml)").fill(invalid);
    assert.equal(await button(page, "Log drink to Drinks").isDisabled(), true);
    assert.equal(await detail.getByRole("alert").count(), invalid ? 1 : 0);
  }
  await field(page, "Drink amount (ml)").fill("250");
  await page.setViewportSize({ width: 390, height: 844 });
  if (process.env.KINE_SCREENSHOT_DIR) await field(detail, "Drink amount (ml)").scrollIntoViewIfNeeded();
  if (process.env.KINE_SCREENSHOT_DIR) await detail.screenshot({ path: join(process.env.KINE_SCREENSHOT_DIR, "kine-task2-drinks-detail.png") });
  await page.setViewportSize({ width: 320, height: 844 });
  await log(page);
  await page.getByTestId("meal-drinks").getByText(/250 ml/).waitFor();
  assert.equal((await entries(page))[0].grams, undefined);
  await total(page, "0.35");
  await page.getByTestId("home-water").getByText("Includes Drinks", { exact: true }).waitFor();
  if (process.env.KINE_SCREENSHOT_DIR) {
    // Finish the tab's 160ms fade before recording the hydration evidence.
    await page.clock.runFor(250);
    await page.waitForFunction(() => {
      let element = document.querySelector('[data-testid="home-water"]');
      while (element) {
        if (Number(getComputedStyle(element).opacity) < 1) return false;
        element = element.parentElement;
      }
      return true;
    });
  }
  if (process.env.KINE_SCREENSHOT_DIR) await page.getByTestId("home-water").screenshot({ path: join(process.env.KINE_SCREENSHOT_DIR, "kine-task2-home-water.png") });
  await page.getByTestId("home-water").click();
  const modal = page.getByRole("dialog", { name: "Edit water", exact: true });
  await modal.getByText("Edit manual water for this day. Drinks count separately in your Home total.", { exact: true }).waitFor();
  assert.equal(await field(modal, "Manual water (ml)").inputValue(), "100");
  const drinksBeforeWaterEdit = await stored(page, foodKey);
  await field(modal, "Manual water (ml)").fill("250");
  await button(modal, "Save water").click();
  await modal.waitFor({ state: "detached" });
  assert.deepEqual(await stored(page, foodKey), drinksBeforeWaterEdit);
  await total(page, "0.5");
  await page.getByTestId("home-water").click();
  assert.equal(await field(modal, "Manual water (ml)").inputValue(), "250");
  await field(modal, "Manual water (ml)").fill("0");
  await button(modal, "Save water").click();
  await modal.waitFor({ state: "detached" });
  await total(page, "0.25");
  assert.deepEqual(await stored(page, foodKey), drinksBeforeWaterEdit);
  assert.equal((await stored(page, waterKey)).days[date], 0);
  await page.getByTestId("home-water").click();
  assert.equal(await field(modal, "Manual water (ml)").inputValue(), "0");
  await field(modal, "Manual water (ml)").fill("250");
  await button(modal, "Save water").click();
  await modal.waitFor({ state: "detached" });
  await total(page, "0.5");
  await tab(page, "Food");
  await edit(page);
  assert.equal(await field(page, "Drink amount (ml)").inputValue(), "250");
  await field(page, "Drink amount (ml)").fill("250");
  assert.equal(await field(page, "Drink amount (ml)").inputValue(), "250");
  await saveEdit(page);
  await total(page, "0.5");
  await tab(page, "Food"); await edit(page);
  await field(page, "Drink amount (ml)").fill("400");
  await saveEdit(page);
  await total(page, "0.65");
  await tab(page, "Food"); await edit(page);
  await field(page, "Drink amount (ml)").fill("300");
  await saveEdit(page);
  await total(page, "0.55");
  await page.reload();
  await page.getByTestId("home-water").getByText("0.55", { exact: true }).waitFor();
  await previousDay(page);
  await total(page, "0");
  await addCola(page);
  await field(page, "Drink amount (ml)").fill("200"); await log(page);
  await total(page, "0.2");
  await button(page, "Expand calendar").click(); await button(page, "Select today").click(); await button(page, "Collapse calendar").click();
  await total(page, "0.55");
  await tab(page, "Food");
  if (await button(page, "Remove Soft drink, cola from Drinks").count()) {
    await button(page, "Remove Soft drink, cola from Drinks").click();
  }
  await button(page, "Confirm remove Soft drink, cola from Drinks").click();
  await page.getByTestId("meal-drinks").getByText("No food has been logged yet", { exact: true }).waitFor();
  await total(page, "0.25");
  assert.deepEqual(await stored(page, waterKey), { version: 1, days: { [date]: 250 } });
  assert.equal((await stored(page, foodKey)).days["2026-09-30"][0].drinkMl, 200);
});

test("legacy snacks and drinks never guess ml, and unreadable manual water never shows a partial total", async t => {
  const legacy = { id: "legacy", fdcId: 2709224, name: "Legacy beverage", grams: 300, calories: 100, carbs: 10, protein: 2, fat: 1 };
  for (const waterState of ["ready", "error", "loading"]) {
    const food = { version: 1, days: { [date]: [ { ...legacy, meal: "snacks" }, { ...legacy, id: "old-drink", meal: "drinks" },
      { ...legacy, id: "drink", meal: "drinks", drinkMl: 250 } ] } };
    const page = await open(t, { food, water: { version: 1, days: { [date]: 100 } }, waterState });
    const water = page.getByTestId("home-water");
    if (waterState === "ready") await water.getByText("0.35", { exact: true }).waitFor();
    else {
      await water.getByText(waterState === "error" ? "tap to retry" : "loading...", { exact: true }).waitFor();
      assert.equal(await water.getByText("0.25", { exact: true }).count(), 0);
      await water.click();
      const modal = page.getByRole("dialog", { name: "Edit water", exact: true });
      assert.equal(await button(modal, "Save water").isDisabled(), true);
      await page.evaluate(() => { window.__waterFailure = false; });
      await button(modal, "Retry water log").click();
      await modal.getByRole("progressbar", { name: "Loading water log...", exact: true }).waitFor({ state: "detached" });
      await button(modal, "Cancel").click();
      await water.getByText("0.35", { exact: true }).waitFor();
      if (waterState === "loading") await page.evaluate(() => window.__releaseWaterRead());
    }
    await tab(page, "Food");
    await page.getByTestId("meal-snacks").getByText("Legacy beverage", { exact: true }).waitFor();
    await button(page, "Edit Legacy beverage in Drinks").first().click();
    assert.equal(await field(page, "Drink amount (ml)").inputValue(), "");
    assert.equal(await button(page, "Save changes").isDisabled(), true);
  }
});

test("catalog import and editor preserve explicit volume without logging hydration until Log", async t => {
  const page = await open(t);
  await tab(page, "Food");
  const product = { code: "3017620422003", product_name: "Fixture drink", brands: "Fixture", quantity: "500 ml", categories_tags: ["en:beverages"], nutriments: {
    "energy-kcal_100g": 20, carbohydrates_100g: 4, proteins_100g: 1, fat_100g: 0, calcium_100g: 0.12, sodium_100g: 0 } };
  let requests = 0;
  await page.route("**/api/v2/product/**", route => { requests++; return route.fulfill({ contentType: "application/json", body: JSON.stringify({ status: 1, product: projectedProduct(route, product) }) }); });
  await button(page, "Scan food barcode").click();
  await field(page, "Product barcode").fill(product.code); await button(page, "Look up barcode").click();
  await heading(page, "Review imported food");
  assert.equal(await field(page, "Serving weight (g)").count(), 0);
  for (const [name, value] of [["Calories (kcal)", "20"], ["Carbs (g)", "4"], ["Protein (g)", "1"], ["Fat (g)", "0"]])
    assert.equal(await field(page, name).inputValue(), value);
  await button(page, "Save food").click();
  await page.getByText("Saved to your foods", { exact: true }).waitFor();
  assert.equal(await stored(page, foodKey), null); assert.equal(await stored(page, waterKey), null);
  assert.equal(await field(page, "Drink amount (ml)").inputValue(), "");
  await field(page, "Drink amount (ml)").fill("275");
  await button(page, "Edit food").click(); await field(page, "Food name").fill("Edited fixture drink");
  await button(page, "Save food changes").click();
  assert.equal(await field(page, "Drink amount (ml)").inputValue(), "275");
  assert.equal(await stored(page, foodKey), null); assert.equal(await stored(page, waterKey), null);
  await button(page, "Edit food").click(); await button(page, "Cancel").click();
  assert.equal(await field(page, "Drink amount (ml)").inputValue(), "275");
  await log(page); await total(page, "0.275");
  const imported = (await entries(page))[0];
  assert.equal(imported.calories, 55); assert.equal(imported.details.calcium, 330); assert.equal(imported.details.sodium, 0);
  assert.equal(imported.details.fiber, null); assert.equal(imported.grams, undefined);
  assert.equal(await stored(page, waterKey), null);
  assert.equal(requests, 1);
});

test("drink failure and duplicate taps keep hydration unchanged until one durable retry", async t => {
  const page = await open(t); await addCola(page);
  await field(page, "Drink amount (ml)").fill("250");
  await failNextFoodWrite(page);
  await button(page, "Log drink to Drinks").click();
  await page.getByRole("alert").filter({ hasText: "Couldn't log" }).waitFor();
  assert.equal(await field(page, "Drink amount (ml)").inputValue(), "250");
  assert.equal(await stored(page, foodKey), null); assert.equal(await stored(page, waterKey), null);
  await page.evaluate(key => {
    const set = Storage.prototype.setItem;
    window.__drinkWrites = 0;
    Storage.prototype.setItem = function(k, value) {
      if (!k.endsWith(key)) return set.call(this, k, value);
      window.__drinkWrites++;
      return new Promise(resolve => { window.__releaseDrinkWrite = () => { Storage.prototype.setItem = set; set.call(this, k, value); resolve(); }; });
    };
  }, foodKey);
  await button(page, "Log drink to Drinks").evaluate(element => { element.click(); element.click(); element.click(); });
  assert.equal(await page.evaluate(() => window.__drinkWrites), 1);
  assert.equal(await stored(page, foodKey), null);
  await page.evaluate(() => window.__releaseDrinkWrite());
  await heading(page, "Daily food log");
  assert.equal((await entries(page)).length, 1);
  await total(page, "0.25");
  assert.equal(await stored(page, waterKey), null);
  await tab(page, "Food"); await edit(page);
  await field(page, "Drink amount (ml)").fill("400");
  await failNextFoodWrite(page);
  await button(page, "Save changes").click();
  await page.getByRole("alert").filter({ hasText: "Couldn't save your changes" }).waitFor();
  assert.equal(await field(page, "Drink amount (ml)").inputValue(), "400");
  assert.equal((await entries(page))[0].drinkMl, 250);
  await saveEdit(page); await total(page, "0.4");
  await tab(page, "Food"); await failNextFoodWrite(page);
  await button(page, "Remove Soft drink, cola from Drinks").click();
  await button(page, "Confirm remove Soft drink, cola from Drinks").click();
  await page.getByRole("alert").filter({ hasText: "Couldn't save your food log" }).waitFor();
  assert.equal((await entries(page)).length, 1);
  await total(page, "0.4");
  await tab(page, "Food");
  if (await button(page, "Remove Soft drink, cola from Drinks").count()) {
    await button(page, "Remove Soft drink, cola from Drinks").click();
  }
  await button(page, "Confirm remove Soft drink, cola from Drinks").click();
  await page.getByTestId("meal-drinks").getByText("No food has been logged yet", { exact: true }).waitFor();
  await total(page, "0");
  assert.equal(await stored(page, waterKey), null);
});


test("legacy custom beverages stay Snacks until an explicit ml and label edit succeeds", async t => {
  const custom = [{ customId: "legacy-label", name: "Legacy custom drink", category: "Custom food", per100g: { calories: 100, carbs: 10, protein: 2, fat: 1 }, portions: [{ label: "1 serving", grams: 100 }], beverage: { kind: "unknown-volume" } }];
  const legacy = { id: "legacy", customId: "legacy-label", name: custom[0].name, grams: 300, calories: 300, carbs: 30, protein: 6, fat: 3, meal: "snacks" };
  const page = await open(t, { custom, food: { version: 1, days: { [date]: [legacy] } } });
  await tab(page, "Food"); await button(page, "Edit Legacy custom drink in Snacks").click();
  assert.equal(await field(page, "Amount (g)").count(), 0);
  await field(page, "Drink amount (ml)").fill("300");
  assert.equal(await button(page, "Save changes").isDisabled(), true);
  assert.equal((await entries(page))[0].meal, "snacks");
  await button(page, "Cancel edit").click();
  assert.equal((await entries(page))[0].meal, "snacks");
  await button(page, "Edit Legacy custom drink in Snacks").click();
  await field(page, "Drink amount (ml)").fill("300");
  for (const [name, value] of [["Calories (kcal)", "40"], ["Carbs (g)", "10"], ["Protein (g)", "0"], ["Fat (g)", "0"]]) await field(page, name).fill(value);
  await saveEdit(page);
  const entry = (await entries(page))[0];
  assert.equal(entry.meal, "drinks"); assert.equal(entry.measurement, "volume"); assert.equal(entry.grams, undefined);
  assert.equal(entry.calories, 120); assert.equal(entry.protein, 0); assert.equal(entry.details.fiber, null);
  await total(page, "0.3");
});

test("custom nutrition modes keep separate label values and volume packaging alone requires a drink choice", async t => {
  const page = await open(t); await tab(page, "Food"); await button(page, "Create food/meal").click();
  await field(page, "Food name").fill("Fresh label drink");
  await field(page, "Calories (kcal)").fill("80");
  await button(page, "Drink").click();
  assert.equal(await field(page, "Serving weight (g)").count(), 0);
  assert.equal(await field(page, "Calories (kcal)").inputValue(), "");
  await field(page, "Calories (kcal)").fill("40");
  await field(page, "Search foods").fill("banana");
  await button(page, "Create food/meal").click();
  assert.equal(await field(page, "Calories (kcal)").inputValue(), "40");
  await button(page, "Solid food").click(); assert.equal(await field(page, "Calories (kcal)").inputValue(), "80");
  await field(page, "Search foods").fill("banana");
  await button(page, "Create food/meal").click();
  assert.equal(await field(page, "Calories (kcal)").inputValue(), "80");
  await button(page, "Drink").click(); assert.equal(await field(page, "Calories (kcal)").inputValue(), "40");
  for (const [name, value] of [["Carbs (g)", "10"], ["Protein (g)", "0"], ["Fat (g)", "0"]]) await field(page, name).fill(value);
  await button(page, "Save food").click();
  await field(page, "Drink amount (ml)").fill("250");
  assert.equal(await stored(page, foodKey), null);
  await log(page);
  assert.equal((await entries(page))[0].calories, 100); assert.equal((await entries(page))[0].grams, undefined);
});


test("legacy milk volume edits preserve source details at the same amount, scale them, and survive reload", async t => {
  const data = JSON.parse(await readFile(new URL("../assets/food/usda-fndds.json", import.meta.url), "utf8"));
  const milk = data.foods.find(food => food.fdcId === 2705385); assert.ok(milk);
  const legacy = { id: "legacy-milk", fdcId: milk.fdcId, name: milk.name, grams: 244, drinkMl: 240, meal: "drinks",
    ...Object.fromEntries(Object.entries(milk.per100g).map(([key, value]) => [key, value * 2.44])) };
  const page = await open(t, { food: { version: 1, days: { [date]: [legacy] } } });
  async function dailyCalcium(expected) {
    await tab(page, "Food"); await button(page, "View macros for the day").click();
    await page.getByTestId("daily-nutrient-calcium").getByTestId("nutrient-value").getByText(expected, { exact: true }).waitFor();
    await button(page, "Back to food log").click();
  }
  await dailyCalcium("300.12");
  for (const [ml, factor, calcium] of [[240, 2.44, "300.12"], [480, 4.88, "600.24"]]) {
    await button(page, `Edit ${milk.name} in Drinks`).click();
    assert.equal(await field(page, "Amount (g)").count(), 0);
    await field(page, "Drink amount (ml)").fill(String(ml));
    await page.getByTestId("food-nutrition-detail").getByText(`${Math.round(legacy.calories * ml / 240)} kcal`, { exact: true }).waitFor();
    await saveEdit(page);
    const saved = (await entries(page))[0];
    assert.equal(saved.measurement, "volume"); assert.equal(saved.grams, undefined);
    assert.equal(saved.drinkMl, ml); assert.equal(saved.details.calcium, milk.details.calcium * factor);
    for (const key of ["fiber", "iron", "caffeine"]) assert.equal(saved.details[key], 0);
    await dailyCalcium(calcium);
    await page.reload(); await heading(page, "Daily food log");
    await dailyCalcium(calcium);
  }
  assert.equal(await stored(page, waterKey), null);
});
