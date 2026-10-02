import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { chromium } from "playwright";

const baseURL = process.env.KINE_PREVIEW_URL || "http://localhost:8081";
const data = JSON.parse(await readFile(new URL("../assets/food/usda-fndds.json", import.meta.url), "utf8"));
const cola = data.foods.find(food => food.fdcId === 2710541);
const dietCola = data.foods.find(food => food.fdcId === 2710542);
assert.ok(cola && dietCola);
const notice = "Generic drinks use approximate nutrition. Use Scan for your exact product.";
const answers = { name: "Alex", goal: "maintain", activity: "moderate", age: "30", height: "180", weight: "80",
  sex: "male", estimateEnabled: true, eligible: true, customCalories: "" };
// Manual saved-label fixture uses bundled USDA values, not invented brand nutrition.
const saved = { customId: "drink-fixture-pepsi", name: "Pepsi Zero Sugar", brand: "Pepsi", category: "Custom food",
  per100g: dietCola.per100g, details: dietCola.details, portions: [{ label: "1 serving", grams: 100 }] };
const button = (page, name) => page.getByRole("button", { name: name === "Log food" || name === "Log meal" ? new RegExp(`^${name} to `) : name, exact: true });
const field = (page, name) => page.getByRole("textbox", { name, exact: true });

async function open(t, foods = []) {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(({ answers, foods }) => {
    if (!sessionStorage.getItem("drinks-fixture-seeded")) {
      localStorage.clear();
      localStorage.setItem("kinevault-track.profile.v1", JSON.stringify({ version: 1, kind: "complete", answers }));
      localStorage.setItem("kinevault-track.custom-foods.v1", JSON.stringify({ version: 1, foods, meals: [] }));
      sessionStorage.setItem("drinks-fixture-seeded", "true");
    }
  }, { answers, foods });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.setDefaultNavigationTimeout(30000);
  await page.goto(baseURL);
  await page.getByRole("tab", { name: "Food", exact: true }).click();
  await page.getByRole("heading", { name: "Daily food log", exact: true }).waitFor();
  return page;
}

async function search(page, query) {
  await field(page, "Search foods").fill(query);
  const results = page.getByTestId("food-catalog-results");
  await results.getByTestId("food-result").first().waitFor();
  return results;
}

test("drink search labels generic cola and pepper aliases, keeps Monster exact, and logs volume USDA nutrition", async t => {
  const page = await open(t);
  let results = await search(page, "Pepsi");
  assert.equal(await results.getByTestId("food-result").count(), 4);
  assert.equal(await results.getByText(notice, { exact: true }).count(), 1);
  await button(page, "View nutrition for Soft drink, cola").waitFor();
  assert.equal(await results.getByText("Generic", { exact: true }).count(), 4);
  for (const row of await results.getByTestId("food-result").allTextContents()) assert.match(row, /kcal per 100 ml/);

  for (const query of ["Pepsi zero", "Coca-Cola sugar-free"]) {
    results = await search(page, query);
    assert.equal(await results.getByTestId("food-result").count(), 2);
    assert.equal(await results.getByText(notice, { exact: true }).count(), 1);
    for (const text of await results.getByTestId("food-result").allTextContents())
      assert.match(text, /diet/i);
    assert.equal(await button(page, "View nutrition for Soft drink, cola").count(), 0);
  }

  results = await search(page, "drpeper");
  assert.equal(await results.getByTestId("food-result").count(), 4);
  assert.equal(await results.getByText(notice, { exact: true }).count(), 1);
  await button(page, "View nutrition for Soft drink, pepper type").waitFor();

  results = await search(page, "Monster");
  assert.equal(await results.getByTestId("food-result").count(), 3);
  assert.equal(await results.getByTestId("generic-drink-match").count(), 0);
  results = await search(page, "Monster zero");
  assert.equal(await results.getByTestId("food-result").count(), 1);
  assert.equal(await results.getByTestId("generic-drink-match").count(), 0);
  await button(page, "View nutrition for Energy drink, sugar free (Monster)").waitFor();

  await search(page, "Pepsi");
  await button(page, "View nutrition for Soft drink, cola").click();
  await field(page, "Drink amount (ml)").fill("150");
  assert.equal(await field(page, "Amount (g)").count(), 0);
  assert.equal(await page.getByText("Serving sizes", { exact: true }).count(), 0);
  const detail = page.getByTestId("food-nutrition-detail");
  await detail.getByText("Nutrition for 150 ml", { exact: true }).waitFor();
  assert.equal(await detail.getByText(`${Math.round(cola.per100g.calories * (31 / 29.5735295625) * 1.5)} kcal`, { exact: true }).count(), 1);
  await button(page, "Log drink to Drinks").click();
  await page.getByRole("heading", { name: "Daily food log", exact: true }).waitFor();
  const entries = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem("kinevault-track.food-log.v1")).days).flat());
  assert.equal(entries.length, 1);
  assert.equal(entries[0].fdcId, cola.fdcId);
  assert.equal(entries[0].name, cola.name);
  assert.equal(entries[0].grams, undefined);
  assert.equal(entries[0].drinkMl, 150);
  assert.equal(entries[0].measurement, "volume");
  assert.equal(entries[0].meal, "drinks");
  for (const key of ["calories", "carbs", "protein", "fat"])
    assert.equal(entries[0][key], cola.per100g[key] * (31 / 29.5735295625) * 1.5);
  await page.reload();
  await page.getByText("Soft drink, cola", { exact: true }).waitFor();
});

test("food and meal ingredient rows label generic Pepsi matches without labeling the saved exact product", async t => {
  const page = await open(t, [saved]);
  const results = await search(page, "Pepsi zero");
  const exact = results.getByTestId("food-result").first();
  assert.match(await exact.innerText(), /Pepsi Zero Sugar/);
  assert.equal(await exact.getByTestId("generic-drink-match").count(), 0);
  assert.equal(await results.getByText(notice, { exact: true }).count(), 1);
  assert.equal(await results.getByRole("button", { name: "Find a branded product online", exact: true }).count(), 0);

  await button(page, "Create food/meal").click();
  await page.getByTestId("food-creation-switch").getByRole("button", { name: "Meal", exact: true }).click();
  await field(page, "Search ingredients").fill("Pepsi");
  const meal = page.getByTestId("create-meal-form");
  await meal.getByTestId("food-result").first().waitFor();
  assert.match(await meal.getByTestId("food-result").first().innerText(), /Pepsi Zero Sugar/);
  assert.equal(await meal.getByTestId("food-result").first().getByTestId("generic-drink-match").count(), 0);
  const generic = meal.getByRole("button", { name: "Add Soft drink, cola to meal", exact: true });
  assert.equal(await generic.getByText("Generic", { exact: true }).count(), 1);
  assert.match(await generic.innerText(), new RegExp(`${Math.round(cola.per100g.calories)} kcal per 100 g`));
  assert.equal(await meal.getByText(notice, { exact: true }).count(), 1);
  await generic.click();
  await field(page, "Amount for Soft drink, cola (g)").fill("150");
  assert.equal(await field(page, "Calories (kcal)").inputValue(), String(cola.per100g.calories * 1.5));
  assert.equal(await page.evaluate(() => localStorage.getItem("kinevault-track.food-log.v1")), null);
});

test("ingredient pages fill with eligible foods and explain matching volume-only drinks", async t => {
  const nutrition = { calories: 40, carbs: 10, protein: 0, fat: 0 };
  const drinks = Array.from({ length: 25 }, (_, i) => ({ customId: `paging-drink-${i}`,
    name: `Pagingfixture sip ${String(i).padStart(2, "0")}`, category: "Custom food", portions: [],
    beverage: { kind: "known-volume", source: "label", per100ml: nutrition } }));
  const solids = Array.from({ length: 25 }, (_, i) => ({ customId: `paging-solid-${i}`,
    name: `Pagingfixture nourishing solid ${String(i).padStart(2, "0")}`, category: "Custom food",
    per100g: nutrition, portions: [{ label: "1 serving", grams: 100 }] }));
  const page = await open(t, [...drinks, ...solids]);
  const logging = await search(page, "Pagingfixture");
  await logging.getByText("50 matching foods and meals.", { exact: true }).waitFor();
  assert.equal(await logging.getByTestId("food-result").count(), 20);
  assert.ok((await logging.getByTestId("food-result").allTextContents()).every(text => text.includes("sip")));

  await button(page, "Create food/meal").click();
  await page.getByTestId("food-creation-switch").getByRole("button", { name: "Meal", exact: true }).click();
  const meal = page.getByTestId("create-meal-form");
  const guidance = "Drinks with label nutrition per ml need a reliable gram weight conversion to use as ingredients.";
  await field(page, "Search ingredients").fill("Pagingfixture");
  await meal.getByText("25 foods. Nutrition per 100 g. Tap a food to add it.", { exact: true }).waitFor();
  assert.equal(await meal.getByTestId("food-result").count(), 20);
  const first = await meal.getByTestId("food-result").allTextContents();
  assert.ok(first.every(text => text.includes("nourishing solid") && text.includes("40 kcal per 100 g")));
  assert.equal(await button(page, "Previous ingredient results").isDisabled(), true);
  assert.equal(await button(page, "Next ingredient results").isEnabled(), true);
  await meal.getByText(guidance, { exact: true }).waitFor();
  await button(page, "Next ingredient results").click();
  await button(page, "Add Pagingfixture nourishing solid 20 to meal, custom food").waitFor();
  const second = await meal.getByTestId("food-result").allTextContents();
  assert.equal(second.length, 5);
  assert.equal(new Set([...first, ...second]).size, 25);
  assert.equal(await button(page, "Previous ingredient results").isEnabled(), true);
  assert.equal(await button(page, "Next ingredient results").isDisabled(), true);
  await button(page, "Previous ingredient results").click();
  await button(page, "Add Pagingfixture nourishing solid 00 to meal, custom food").waitFor();
  assert.deepEqual(await meal.getByTestId("food-result").allTextContents(), first);

  await field(page, "Search ingredients").fill("Pagingfixture sip");
  await meal.getByText("No matching foods with gram nutrition.", { exact: true }).waitFor();
  await meal.getByText(guidance, { exact: true }).waitFor();
  assert.equal(await meal.getByTestId("food-result").count(), 0);
  assert.equal(await button(page, "Next ingredient results").count(), 0);
  assert.equal(await button(page, "Previous ingredient results").count(), 0);
  assert.equal(await meal.getByText("No foods found. Try a different name.", { exact: true }).count(), 0);
  await field(page, "Search ingredients").fill("Pagingfixture");
  await button(page, "Add Pagingfixture nourishing solid 00 to meal, custom food").click();
  assert.equal(await field(page, "Calories (kcal)").inputValue(), "40");
  assert.equal(await page.evaluate(() => localStorage.getItem("kinevault-track.food-log.v1")), null);
});

test("deleting the last logging page clamps result labels and pager actions", async t => {
  const foods = Array.from({ length: 41 }, (_, i) => ({ ...saved, customId: `shrink-${i}`,
    name: `Shrinkfixture food ${String(i).padStart(2, "0")}`, brand: undefined }));
  const page = await open(t, foods);
  const results = await search(page, "Shrinkfixture");
  await button(page, "Next food results").click();
  await results.getByText("Showing 21 to 40 of 41", { exact: true }).waitFor();
  await button(page, "Next food results").click();
  await results.getByText("Showing 41 to 41 of 41", { exact: true }).waitFor();
  await button(page, "View nutrition for Shrinkfixture food 40, custom food").click();
  await button(page, "Delete food").click();
  await page.getByRole("dialog", { name: "Delete custom food?" }).getByRole("button", { name: "Delete food", exact: true }).click();
  await results.getByText("Showing 21 to 40 of 40", { exact: true }).waitFor();
  assert.equal(await results.getByTestId("food-result").count(), 20);
  assert.equal(await button(page, "Previous food results").isEnabled(), true);
  assert.equal(await button(page, "Next food results").isDisabled(), true);
  await button(page, "Previous food results").click();
  await results.getByText("Showing 1 to 20 of 40", { exact: true }).waitFor();
  assert.equal(await button(page, "Previous food results").isDisabled(), true);
  await button(page, "Next food results").click();
  await results.getByText("Showing 21 to 40 of 40", { exact: true }).waitFor();
  assert.equal(await button(page, "View nutrition for Shrinkfixture food 40, custom food").count(), 0);
});


test("source concentrates and cooking ingredients keep gram Snacks controls and no hydration", async t => {
  const page = await open(t);
  const ids = [2705402, 2710572, 2710631, 2709191, 2707568, 2707571];
  for (const id of ids) {
    const food = data.foods.find(food => food.fdcId === id); assert.ok(food);
    await search(page, food.name);
    await button(page, `View nutrition for ${food.name}`).click();
    t.diagnostic(`Checking gram controls for ${id}: ${food.name}`);
    await field(page, "Amount (g)").fill("100");
    assert.equal(await field(page, "Drink amount (ml)").count(), 0, food.name);
    await button(page, "Snacks").click();
    await button(page, "Log food to Snacks").click();
    await page.getByRole("heading", { name: "Daily food log", exact: true }).waitFor();
  }
  const entries = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem("kinevault-track.food-log.v1")).days).flat());
  assert.equal(entries.length, ids.length);
  for (const entry of entries) {
    const food = data.foods.find(food => food.fdcId === entry.fdcId); assert.ok(food);
    assert.equal(entry.meal, "snacks"); assert.equal(entry.grams, 100); assert.equal(entry.drinkMl, undefined);
    for (const key of ["calories", "carbs", "protein", "fat"]) assert.equal(entry[key], food.per100g[key]);
  }
  await page.getByRole("tab", { name: "Home", exact: true }).click();
  await page.getByTestId("home-water").getByText("0", { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem("kinevault-track.water-log.v1")), null);
});
