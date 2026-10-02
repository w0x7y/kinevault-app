import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const baseURL = process.env.KINE_PREVIEW_URL || "http://localhost:8081";
const key = "kinevault-track.profile.v1";
const adult = {
  name: "Alex",
  goal: "maintain",
  activity: "moderate",
  age: "30",
  height: "180",
  weight: "80",
  sex: "male",
  estimateEnabled: true,
  eligible: true,
  customCalories: "",
};

test("custom food and meal edits and deletes persist, retry safely and preserve logged nutrition", async (t) => {
  const page = await open(t, { version: 1, kind: "complete", answers: adult }, { viewport: { width: 320, height: 844 } });
  await page.evaluate(() => {
    const food = { customId: "editable-oats", name: "Saved oats", category: "Custom food", per100g: { calories: 400, carbs: 60, protein: 20, fat: 8 }, portions: [{ label: "1 serving", grams: 100 }] };
    const meal = { customId: "editable-bowl", name: "Saved bowl", category: "Custom meal", per100g: { calories: 400, carbs: 60, protein: 60, fat: 8 }, portions: [{ label: "1 meal", grams: 50 }], ingredients: [{ id: "ingredient-1", food, grams: 50 }], overrides: { protein: 30 } };
    const today = new Date();
    const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    localStorage.setItem("kinevault-track.custom-foods.v1", JSON.stringify({ version: 1, foods: [food], meals: [meal] }));
    localStorage.setItem("kinevault-track.food-log.v1", JSON.stringify({ version: 1, days: { [date]: [
      { id: "logged-food", customId: food.customId, name: food.name, grams: 50, meal: "breakfast", calories: 200, carbs: 30, protein: 10, fat: 4 },
      { id: "logged-meal", customId: meal.customId, name: meal.name, grams: 50, meal: "lunch", calories: 200, carbs: 30, protein: 30, fat: 4 },
    ] } }));
  });
  await page.reload();
  await page.getByRole("tab", { name: "Food" }).click();
  const readCatalog = () => page.evaluate(() => JSON.parse(localStorage.getItem("kinevault-track.custom-foods.v1")));
  const readLog = () => page.evaluate(() => localStorage.getItem("kinevault-track.food-log.v1"));
  const originalLog = await readLog();
  const failCatalogWrite = () => page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "kinevault-track.custom-foods.v1") {
        Storage.prototype.setItem = original;
        throw new Error("Simulated catalog change failure");
      }
      return original.call(this, key, value);
    };
  });
  const search = page.getByRole("textbox", { name: "Search foods", exact: true });
  await search.fill("Saved oats");
  await button(page, "View nutrition for Saved oats, custom food").click();
  await button(page, "Edit food").click({ timeout: 3000 });
  await heading(page, "Edit custom food");
  assert.equal(await page.getByRole("textbox", { name: "Calories (kcal)", exact: true }).inputValue(), "400");
  await page.getByRole("textbox", { name: "Food name", exact: true }).fill("Discarded name");
  await button(page, "Cancel").click();
  assert.equal((await readCatalog()).foods[0].name, "Saved oats");
  await button(page, "Edit food").click();
  for (const [label, value] of [["Food name", "Revised oats"], ["Serving weight (g)", "200"], ["Calories (kcal)", "500"]])
    await page.getByRole("textbox", { name: label, exact: true }).fill(value);
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  }
  await page.setViewportSize({ width: 320, height: 844 });
  await failCatalogWrite();
  await button(page, "Save food changes").click();
  await page.getByRole("alert").filter({ hasText: "Couldn't update your food" }).waitFor();
  assert.equal((await readCatalog()).foods[0].name, "Saved oats");
  assert.equal(await page.getByRole("textbox", { name: "Food name", exact: true }).inputValue(), "Revised oats");
  await button(page, "Expand calendar").click();
  await button(page, "Select previous day").click();
  await button(page, "Collapse calendar").click();
  await heading(page, "Edit custom food");
  assert.equal(await page.getByRole("textbox", { name: "Food name", exact: true }).inputValue(), "Revised oats");
  assert.ok(await page.getByRole("alert").filter({ hasText: "Couldn't update your food" }).isVisible());
  await button(page, "Expand calendar").click();
  await button(page, "Select today").click();
  await button(page, "Collapse calendar").click();
  await button(page, "Save food changes").click();
  await heading(page, "Revised oats");
  await page.getByTestId("food-nutrition-detail").getByText("500 kcal", { exact: true }).waitFor();
  assert.equal((await readCatalog()).foods.length, 1);
  assert.equal((await readCatalog()).foods[0].customId, "editable-oats");
  assert.equal(await page.getByRole("dialog", { name: "Food created" }).count(), 0);
  await button(page, "Back to food results").click();
  await search.fill("Revised oats");
  await button(page, "View nutrition for Revised oats, custom food").click();
  await button(page, "Delete food").click();
  const foodDelete = page.getByRole("dialog", { name: "Delete custom food?" });
  await foodDelete.waitFor();
  await foodDelete.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal((await readCatalog()).foods.length, 1);
  await button(page, "Delete food").click();
  await failCatalogWrite();
  await foodDelete.getByRole("button", { name: "Delete food", exact: true }).click();
  await foodDelete.getByRole("alert").waitFor();
  assert.equal((await readCatalog()).foods.length, 1);
  await foodDelete.getByRole("button", { name: "Delete food", exact: true }).click();
  await foodDelete.waitFor({ state: "hidden" });
  assert.equal((await readCatalog()).foods.length, 0);
  assert.equal(await button(page, "View nutrition for Revised oats, custom food").count(), 0);
  assert.equal((await readCatalog()).meals[0].ingredients[0].food.name, "Saved oats");
  assert.equal(await readLog(), originalLog);
  await page.evaluate(() => localStorage.setItem("kinevault-track.appearance", "dark"));
  await page.reload();
  await search.fill("Saved bowl");
  await button(page, "View nutrition for Saved bowl, custom meal").click();
  await button(page, "Edit meal").click();
  await heading(page, "Edit custom meal");
  assert.equal(await page.getByRole("textbox", { name: "Protein (g)", exact: true }).inputValue(), "30");
  await page.getByRole("textbox", { name: "Amount for Saved oats (g)", exact: true }).fill("100");
  assert.equal(await page.getByRole("textbox", { name: "Calories (kcal)", exact: true }).inputValue(), "400");
  assert.equal(await page.getByRole("textbox", { name: "Protein (g)", exact: true }).inputValue(), "30");
  await button(page, "Use calculated nutrition").click();
  assert.equal(await page.getByRole("textbox", { name: "Protein (g)", exact: true }).inputValue(), "20");
  await page.getByRole("textbox", { name: "Search ingredients", exact: true }).fill("banana raw");
  await button(page, "Add Banana, raw to meal").click();
  await page.getByRole("textbox", { name: "Meal name", exact: true }).fill("Revised bowl");
  await page.getByRole("textbox", { name: "Protein (g)", exact: true }).fill("40");
  await page.getByRole("textbox", { name: "Fat (g)", exact: true }).fill("0");
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  }
  await page.setViewportSize({ width: 320, height: 844 });
  const screenshotDir = process.env.KINE_SCREENSHOT_DIR;
  if (screenshotDir) await page.getByTestId("create-meal-form").screenshot({ path: join(screenshotDir, "edit-meal-dark.png") });
  await failCatalogWrite();
  await button(page, "Save meal changes").click();
  await page.getByRole("alert").filter({ hasText: "Couldn't update your meal" }).waitFor();
  assert.equal((await readCatalog()).meals[0].ingredients.length, 1);
  await button(page, "Save meal changes").click();
  await heading(page, "Revised bowl");
  const updatedMeal = (await readCatalog()).meals[0];
  assert.equal(updatedMeal.customId, "editable-bowl");
  assert.equal(updatedMeal.ingredients.length, 2);
  assert.equal(new Set(updatedMeal.ingredients.map(ingredient => ingredient.id)).size, 2);
  assert.equal(updatedMeal.overrides.protein, 40);
  assert.equal(updatedMeal.overrides.fat, 0);
  assert.equal(await readLog(), originalLog);
  await page.reload();
  await search.fill("Revised bowl");
  await button(page, "View nutrition for Revised bowl, custom meal").click();
  await button(page, "Delete meal").click();
  const mealDelete = page.getByRole("dialog", { name: "Delete custom meal?" });
  await mealDelete.waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  if (screenshotDir) await page.screenshot({ path: join(screenshotDir, "delete-meal-dark.png") });
  await page.keyboard.press("Escape");
  assert.equal((await readCatalog()).meals.length, 1);
  await button(page, "Delete meal").click();
  await mealDelete.getByRole("button", { name: "Delete meal", exact: true }).click();
  await mealDelete.waitFor({ state: "hidden" });
  assert.equal((await readCatalog()).meals.length, 0);
  assert.equal(await readLog(), originalLog);
  await page.reload();
  await search.fill("banana raw");
  await button(page, "View nutrition for Banana, raw").click();
  assert.equal(await button(page, "Edit food").count(), 0);
  assert.equal(await button(page, "Delete food").count(), 0);
  await button(page, "Back to food results").click();
  await button(page, "Clear search").click();
  await button(page, "Edit Saved bowl in Lunch").click();
  await page.getByRole("textbox", { name: "Amount (g)", exact: true }).fill("25");
  await button(page, "Save changes").click();
  const log = JSON.parse(await readLog());
  const entries = Object.values(log.days).flat();
  assert.equal(entries.find(entry => entry.id === "logged-food").calories, 200);
  assert.equal(entries.find(entry => entry.id === "logged-meal").calories, 100);
  assert.equal(entries.find(entry => entry.id === "logged-meal").protein, 15);
});

test("deleting the last item on a saved meal results page returns to the remaining items", async (t) => {
  const page = await open(t, { version: 1, kind: "complete", answers: adult });
  await page.evaluate(() => {
    const food = { fdcId: 1, name: "Oats", category: "Grains", per100g: { calories: 100, carbs: 10, protein: 5, fat: 2 }, portions: [] };
    const meals = Array.from({ length: 21 }, (_, index) => ({ customId: `meal-${index + 1}`, name: `Saved meal ${index + 1}`, category: "Custom meal", per100g: food.per100g, portions: [{ label: "1 meal", grams: 100 }], ingredients: [{ id: "oats", food, grams: 100 }], overrides: {} }));
    localStorage.setItem("kinevault-track.custom-foods.v1", JSON.stringify({ version: 1, foods: [], meals }));
  });
  await page.reload();
  await page.getByRole("tab", { name: "Food" }).click();
  await page.getByRole("textbox", { name: "Search foods", exact: true }).fill("Saved meal");
  await button(page, "Next food results").click();
  await button(page, "View nutrition for Saved meal 21, custom meal").click();
  await button(page, "Delete meal").click();
  await page.getByRole("dialog", { name: "Delete custom meal?" }).getByRole("button", { name: "Delete meal", exact: true }).click();
  await button(page, "View nutrition for Saved meal 1, custom meal").waitFor();
  assert.equal(await page.getByTestId("food-result").count(), 20);
  assert.equal(await button(page, "Next food results").count(), 0);
  await page.reload();
  await page.getByRole("textbox", { name: "Search foods", exact: true }).fill("Saved meal");
  assert.equal(await button(page, "View nutrition for Saved meal 21, custom meal").count(), 0);
  await button(page, "View nutrition for Saved meal 1, custom meal").waitFor();
});

test("meal creation calculates ingredients, preserves drafts across food/meal switches, retries and logs overridden macros", async (t) => {
  const page = await open(t, { version: 1, kind: "complete", answers: adult }, { viewport: { width: 320, height: 844 } });
  await page.evaluate(() => localStorage.setItem("kinevault-track.custom-foods.v1", JSON.stringify({ version: 1, foods: [
    { customId: "test-oats", name: "Test oats", category: "Custom food", per100g: { calories: 400, carbs: 60, protein: 20, fat: 8 }, portions: [{ label: "1 serving", grams: 100 }] },
    { customId: "test-yogurt", name: "Test yogurt", category: "Custom food", per100g: { calories: 100, carbs: 5, protein: 10, fat: 4 }, portions: [{ label: "1 serving", grams: 100 }] },
  ] })));
  await page.reload();
  await page.getByRole("tab", { name: "Food" }).click();
  assert.equal(await button(page, "Food").count(), 0);
  assert.equal(await button(page, "Meal").count(), 0);
  await button(page, "Create food/meal").click();
  await heading(page, "Create food");
  await button(page, "Meal").click();
  assert.equal(await button(page, "Meal").getAttribute("aria-pressed"), "true");
  await heading(page, "Create meal");
  await button(page, "Save meal").click();
  await page.getByRole("alert").filter({ hasText: "Add at least one food" }).waitFor();
  await page.getByRole("textbox", { name: "Meal name", exact: true }).fill("Breakfast bowl");
  await button(page, "Food").click();
  await heading(page, "Create food");
  await page.getByRole("textbox", { name: "Food name", exact: true }).fill("Unfinished food");
  await button(page, "Meal").click();
  assert.equal(await page.getByRole("textbox", { name: "Meal name", exact: true }).inputValue(), "Breakfast bowl");
  for (const name of ["Test oats", "Test yogurt"]) {
    await page.getByRole("textbox", { name: "Search ingredients", exact: true }).fill(name);
    await button(page, `Add ${name} to meal, custom food`).click();
  }
  await page.getByRole("textbox", { name: "Amount for Test oats (g)", exact: true }).fill("50");
  await page.getByRole("textbox", { name: "Amount for Test yogurt (g)", exact: true }).fill("200");
  for (const [label, value] of [["Calories (kcal)", "400"], ["Carbs (g)", "40"], ["Protein (g)", "30"], ["Fat (g)", "12"]])
    assert.equal(await page.getByRole("textbox", { name: label, exact: true }).inputValue(), value);
  await page.getByRole("textbox", { name: "Protein (g)", exact: true }).fill("35");
  await page.getByRole("textbox", { name: "Amount for Test oats (g)", exact: true }).fill("75");
  assert.equal(await page.getByRole("textbox", { name: "Protein (g)", exact: true }).inputValue(), "35");
  assert.equal(await page.getByRole("textbox", { name: "Carbs (g)", exact: true }).inputValue(), "55");
  await button(page, "Use calculated nutrition").click();
  assert.equal(await page.getByRole("textbox", { name: "Fat (g)", exact: true }).inputValue(), "14");
  await page.getByRole("textbox", { name: "Amount for Test oats (g)", exact: true }).fill("50");
  await page.getByRole("textbox", { name: "Protein (g)", exact: true }).fill("35");
  await page.getByRole("textbox", { name: "Fat (g)", exact: true }).fill("0");
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "kinevault-track.custom-foods.v1") {
        Storage.prototype.setItem = original;
        throw new Error("Simulated meal save failure");
      }
      return original.call(this, key, value);
    };
  });
  await button(page, "Save meal").click();
  await page.getByRole("alert").filter({ hasText: "Couldn't save your meal" }).waitFor();
  assert.equal(await page.getByRole("textbox", { name: "Protein (g)", exact: true }).inputValue(), "35");
  assert.equal(await page.getByRole("textbox", { name: "Amount for Test yogurt (g)", exact: true }).inputValue(), "200");
  await button(page, "Save meal").click();
  await page.getByText("Saved to your meals", { exact: true }).waitFor();
  assert.equal(await page.getByRole("dialog").count(), 0);
  assert.equal(await button(page, "Food").count(), 0);
  assert.equal(await button(page, "Meal").count(), 0);
  await heading(page, "Breakfast bowl");
  assert.equal(await page.getByRole("textbox", { name: "Amount (g)", exact: true }).inputValue(), "250");
  await page.getByRole("textbox", { name: "Amount (g)", exact: true }).fill("125");
  await button(page, "Dinner").click();
  await button(page, "Log meal").click();
  await page.getByTestId("food-nutrition-detail").waitFor({ state: "hidden" });
  const document = await page.evaluate(() => JSON.parse(localStorage.getItem("kinevault-track.food-log.v1")));
  const entries = Object.values(document.days).flat();
  assert.equal(entries.length, 1);
  assert.equal(entries[0].calories, 200);
  assert.equal(entries[0].protein, 17.5);
  assert.equal(entries[0].fat, 0);
  assert.equal(entries[0].meal, "dinner");
  await page.reload();
  await page.getByRole("textbox", { name: "Search foods", exact: true }).fill("Breakfast bowl");
  const mealResult = button(page, "View nutrition for Breakfast bowl, custom meal");
  await mealResult.waitFor();
  assert.equal(await mealResult.getByTestId("custom-food-icon").count(), 1);
  await mealResult.click();
  await heading(page, "Ingredients");
  assert.equal(await button(page, "Food").count(), 0);
  assert.equal(await button(page, "Meal").count(), 0);
  await page.getByRole("textbox", { name: "Search foods", exact: true }).fill("Test oats");
  await button(page, "View nutrition for Test oats, custom food").waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
});

test("meal ingredient validation, removal, calendar changes and logged edits work in both themes", async (t) => {
  const page = await open(t, { version: 1, kind: "complete", answers: adult });
  await page.getByRole("tab", { name: "Food" }).click();
  for (const theme of ["light", "dark"]) {
    await page.evaluate(theme => localStorage.setItem("kinevault-track.appearance", theme), theme);
    await page.reload();
    await button(page, "Create food/meal").click();
    await button(page, "Meal").click();
    await page.getByRole("textbox", { name: "Meal name", exact: true }).fill("Portable snack");
    const addBanana = async () => {
      await page.getByRole("textbox", { name: "Search ingredients", exact: true }).fill("banana raw");
      await button(page, "Add Banana, raw to meal").click();
    };
    await addBanana();
    const ingredient = page.getByRole("textbox", { name: "Amount for Banana, raw (g)", exact: true });
    await ingredient.fill("0");
    await button(page, "Save meal").click();
    await page.getByRole("alert").filter({ hasText: "Enter a weight greater than 0" }).waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem("kinevault-track.custom-foods.v1")), null);
    await ingredient.fill("150");
    assert.equal(await page.getByRole("textbox", { name: "Calories (kcal)", exact: true }).inputValue(), "145.5");
    await button(page, "Remove Banana, raw from meal").click();
    await page.getByText("No foods added yet. Search below to add your first ingredient.", { exact: true }).waitFor();
    await addBanana();
    await ingredient.fill("150");
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    }
    const screenshotDir = process.env.KINE_SCREENSHOT_DIR;
    if (screenshotDir) {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByTestId("create-meal-form").screenshot({ path: join(screenshotDir, `meal-builder-${theme}.png`) });
    }
  }
  await button(page, "Expand calendar").click();
  await page.locator('button[aria-pressed]').filter({ hasText: /^\d/ }).first().click();
  await button(page, "Collapse calendar").click();
  assert.equal(await page.getByRole("textbox", { name: "Meal name", exact: true }).inputValue(), "Portable snack");
  assert.equal(await page.getByRole("textbox", { name: "Amount for Banana, raw (g)", exact: true }).inputValue(), "150");
  await button(page, "Save meal").click();
  await page.getByText("Saved to your meals", { exact: true }).waitFor();
  assert.equal(await page.getByRole("dialog").count(), 0);
  assert.equal(await button(page, "Food").count(), 0);
  assert.equal(await button(page, "Meal").count(), 0);
  await button(page, "Log meal").click();
  await button(page, "Edit Portable snack in Breakfast").click();
  await heading(page, "Edit logged meal");
  await page.getByRole("textbox", { name: "Amount (g)", exact: true }).fill("75");
  await button(page, "Lunch").click();
  await button(page, "Save changes").click();
  await heading(page, "Daily food log");
  const document = await page.evaluate(() => JSON.parse(localStorage.getItem("kinevault-track.food-log.v1")));
  const entries = Object.values(document.days).flat();
  assert.equal(entries.length, 1);
  assert.equal(entries[0].grams, 75);
  assert.equal(entries[0].calories, 72.75);
  assert.equal(entries[0].meal, "lunch");
});

test("custom food creation validates, retries a failed save, logs and remains searchable after reload", async (t) => {
  const page = await open(t, { version: 1, kind: "complete", answers: adult });
  await page.getByRole("tab", { name: "Food" }).click();
  await button(page, "Create food/meal").click({ timeout: 3000 });
  await heading(page, "Create food");
  await button(page, "Save food").click();
  assert.ok(await page.getByRole("alert").count() >= 5);
  assert.equal(await page.getByRole("dialog", { name: "Food created" }).count(), 0);
  for (const [label, value] of [["Food name", "My oat bowl"], ["Serving weight (g)", "250"],
    ["Calories (kcal)", "300"], ["Carbs (g)", "40"], ["Protein (g)", "12,5"], ["Fat (g)", "10"]]) {
    await page.getByRole("textbox", { name: label, exact: true }).fill(value);
  }
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "kinevault-track.custom-foods.v1") {
        Storage.prototype.setItem = original;
        throw new Error("Simulated failure");
      }
      return original.call(this, key, value);
    };
  });
  await button(page, "Save food").click();
  await page.getByRole("alert").filter({ hasText: "Couldn't save your custom food" }).waitFor();
  assert.equal(await page.getByRole("dialog", { name: "Food created" }).count(), 0);
  assert.equal(await page.getByRole("textbox", { name: "Food name", exact: true }).inputValue(), "My oat bowl");
  await button(page, "Save food").click();
  await page.getByText("Saved to your foods", { exact: true }).waitFor();
  assert.equal(await page.getByRole("dialog").count(), 0);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("kinevault-track.custom-foods.v1")).foods.length), 1);
  assert.equal(await page.evaluate(() => localStorage.getItem("kinevault-track.food-log.v1")), null);
  await heading(page, "My oat bowl");
  assert.equal(await page.getByRole("textbox", { name: "Amount (g)", exact: true }).inputValue(), "250");
  await page.getByRole("textbox", { name: "Amount (g)", exact: true }).fill("125");
  await button(page, "Lunch").click();
  await button(page, "Log food").click();
  await page.getByTestId("food-nutrition-detail").waitFor({ state: "hidden" });
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("kinevault-track.food-log.v1")));
  const entry = Object.values(stored.days).flat().find(food => food.name === "My oat bowl");
  assert.equal(entry.calories, 150);
  assert.equal(entry.protein, 6.25);
  assert.equal(entry.meal, "lunch");
  assert.equal(entry.fdcId, undefined);
  assert.ok(entry.customId);
  await page.reload();
  await page.getByRole("textbox", { name: "Search foods", exact: true }).fill("oat bowl");
  await button(page, "View nutrition for My oat bowl, custom food").waitFor();
  const customResult = button(page, "View nutrition for My oat bowl, custom food");
  assert.equal(await customResult.getByTestId("custom-food-icon").count(), 1);
  assert.equal(await customResult.getByTestId("custom-food-icon").getAttribute("aria-hidden"), "true");
  await page.getByRole("textbox", { name: "Search foods", exact: true }).fill("banana");
  await page.getByTestId("food-result").first().waitFor();
  assert.equal(await page.getByTestId("custom-food-icon").count(), 0);
  await page.getByRole("textbox", { name: "Search foods", exact: true }).fill("oat bowl");
  await button(page, "View nutrition for My oat bowl, custom food").click();
  await heading(page, "My oat bowl");
  assert.equal(await page.getByRole("textbox", { name: "Amount (g)", exact: true }).inputValue(), "250");
});

test("canceling custom food preserves the catalog and corrupt storage recovers through retry", async (t) => {
  const page = await open(t, { version: 1, kind: "complete", answers: adult }, { viewport: { width: 320, height: 844 } });
  await page.getByRole("tab", { name: "Food" }).click();
  await button(page, "Create food/meal").click({ timeout: 3000 });
  await page.getByRole("textbox", { name: "Food name", exact: true }).fill("Canceled bowl");
  await button(page, "Cancel").click();
  assert.equal(await page.evaluate(() => localStorage.getItem("kinevault-track.custom-foods.v1")), null);
  await page.evaluate(() => localStorage.setItem("kinevault-track.custom-foods.v1", "corrupt"));
  await page.reload();
  await heading(page, "Couldn't load your custom foods");
  assert.equal(await button(page, "Create food/meal").isDisabled(), true);
  await page.getByRole("textbox", { name: "Search foods", exact: true }).fill("banana");
  await page.getByTestId("food-result").first().waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem("kinevault-track.custom-foods.v1")), "corrupt");
  await page.evaluate(() => localStorage.removeItem("kinevault-track.custom-foods.v1"));
  await button(page, "Retry custom foods").click();
  await button(page, "Create food/meal").click();
  await heading(page, "Create food");
  assert.equal(await page.getByRole("textbox", { name: "Food name", exact: true }).inputValue(), "");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
});

test("changing calendar day preserves a custom food draft and logs it to the new day", async (t) => {
  const page = await open(t, { version: 1, kind: "complete", answers: adult });
  await page.getByRole("tab", { name: "Food" }).click();
  await button(page, "Create food/meal").click();
  for (const [label, value] of [["Food name", "שיבולת שועל"], ["Serving weight (g)", "250"],
    ["Calories (kcal)", "300"], ["Carbs (g)", "40"], ["Protein (g)", "12.5"], ["Fat (g)", "10"]]) {
    await page.getByRole("textbox", { name: label, exact: true }).fill(value);
  }
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "kinevault-track.custom-foods.v1") {
        Storage.prototype.setItem = original;
        throw new Error("Simulated failure before changing the day");
      }
      return original.call(this, key, value);
    };
  });
  await button(page, "Save food").click();
  await page.getByRole("alert").filter({hasText: "Couldn't save your custom food"}).waitFor();
  await button(page, "Expand calendar").click();
  const date = page.locator('button[aria-pressed]').filter({hasText: /^\d+$/}).first();
  const dateName = await date.getAttribute("aria-label");
  await date.click();
  await button(page, "Collapse calendar").click();
  await heading(page, "Create food");
  assert.equal(await page.getByRole("textbox", { name: "Food name", exact: true }).inputValue(), "שיבולת שועל");
  assert.equal(await page.getByRole("textbox", { name: "Calories (kcal)", exact: true }).inputValue(), "300");
  assert.ok(await page.getByRole("alert").filter({hasText: "Couldn't save your custom food"}).isVisible());
  await button(page, "Save food").click();
  await page.getByText("Saved to your foods", { exact: true }).waitFor();
  assert.equal(await page.getByRole("dialog").count(), 0);
  await heading(page, "שיבולת שועל");
  await button(page, "Log food").click();
  await page.getByTestId("food-nutrition-detail").waitFor({ state: "hidden" });
  const document = await page.evaluate(() => JSON.parse(localStorage.getItem("kinevault-track.food-log.v1")));
  const [[savedDate, entries]] = Object.entries(document.days);
  assert.ok(dateName.startsWith(new Date(`${savedDate}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })));
  assert.equal(entries[0].name, "שיבולת שועל");
  await page.getByRole("textbox", { name: "Search foods", exact: true }).fill("שיבולת שועל");
  await button(page, "View nutrition for שיבולת שועל, custom food").waitFor();
});
async function open(t, seed, options = {}) {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    ...options,
  });
  if (seed)
    await context.addInitScript(
      ({ key, seed }) => {
        if (!sessionStorage.getItem("kinevault-test-seeded")) {
          localStorage.setItem(key, JSON.stringify(seed));
          sessionStorage.setItem("kinevault-test-seeded", "true");
        }
      },
      { key, seed },
    );
  const page = await context.newPage();
  await page.goto(baseURL);
  return page;
}
const heading = (page, title) =>
  page
    .getByRole("heading", { name: title, exact: true })
    .waitFor({ timeout: 10000 });
const button = (page, label) =>
  page.getByRole("button", { name: label === "Log food" || label === "Log meal" ? new RegExp(`^${label} to `) : label, exact: true });
const record = (page) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key)), key);
async function continueTo(page, title) {
  await button(page, "Continue").click();
  await heading(page, title);
}
async function failNextSave(page) {
  await page.evaluate((key) => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (nextKey, value) {
      if (nextKey === key) {
        Storage.prototype.setItem = original;
        throw new Error("Simulated storage failure");
      }
      return original.call(this, nextKey, value);
    };
  }, key);
}

test("number fields reject letters and invalid pasted values while allowing decimal edits", async (t) => {
  const page = await open(t, {
    version: 1,
    kind: "draft",
    step: "body",
    answers: adult,
  });
  await heading(page, "A little about you");
  for (const [label, original, decimal] of [
    ["Height (cm)", "180", "175.5"],
    ["Weight (kg)", "80", "70,5"],
  ]) {
    const field = page.getByRole("textbox", { name: label, exact: true });
    for (const invalid of ["abc", "1e3", "-20", "70kg", "70..5", "70,.5"]) {
      await field.fill(invalid);
      assert.equal(await field.inputValue(), original);
    }
    await field.fill("");
    await field.fill(decimal.slice(0, -1));
    assert.equal(await field.inputValue(), decimal.slice(0, -1));
    await field.fill(decimal);
    assert.equal(await field.inputValue(), decimal);
  }
  await continueTo(page, "How active are you?");
  await continueTo(page, "Your daily starting point");
  const calories = page.getByRole("textbox", {
    name: "Adjust target (optional, kcal)", exact: true,
  });
  await calories.fill("2400");
  for (const invalid of ["abc", "1e3", "-2000", "240.5"]) {
    await calories.fill(invalid);
    assert.equal(await calories.inputValue(), "2400");
  }
  await calories.fill("");
  assert.equal(await calories.inputValue(), "");
});

test("manual mode keeps body metrics optional after age confirmation", async (t) => {
  const page = await open(t, { version: 1, kind: "draft", step: "body", answers: adult });
  await heading(page, "A little about you");
  await page.getByRole("radio", { name: "Skip the estimate", exact: true }).click();
  assert.equal(await page.getByRole("textbox", { name: "Age (years)", exact: true }).count(), 0);
  await continueTo(page, "How active are you?");
  const saved = await record(page);
  assert.equal(saved.answers.age, "30");
  assert.equal(saved.answers.sex, null);
  assert.equal(saved.answers.estimateEnabled, false);
});

test("a failed review-edit save preserves the return destination for retry", async (t) => {
  const page = await open(t, {
    version: 1,
    kind: "draft",
    step: "review",
    answers: adult,
  });
  await heading(page, "Ready when you are.");
  await button(page, "Edit goal").click();
  await heading(page, "What's your goal?");
  await page.getByRole("radio", { name: "Gain weight", exact: true }).click();
  await failNextSave(page);
  await button(page, "Back to review").click();
  await page.getByRole("alert").waitFor();
  assert.equal(await button(page, "Back to review").count(), 1);
  await button(page, "Back to review").click();
  await heading(page, "Ready when you are.");
  assert.equal((await record(page)).step, "review");
  assert.equal((await record(page)).answers.goal, "gain");
});

test("Kine estimates calories, resumes drafts, and saves an editable custom target", async (t) => {
  const page = await open(t);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await heading(page, "Hi, I'm Kine.");
  assert.equal(await page.getByRole("textbox").count(), 0);
  await button(page, "Let's go").click();
  await heading(page, "What's your goal?");
  await page.getByRole("radio", { name: "Lose weight", exact: true }).click();
  await continueTo(page, "Let's check your age");
  await page.getByRole("textbox", { name: "Age (years)", exact: true }).fill("30");
  await continueTo(page, "What should I call you?");
  await page.getByRole("textbox", { name: "Your name (optional)", exact: true }).fill("Alex");
  await continueTo(page, "A little about you");
  await page
    .getByRole("radio", { name: "Use the standard estimate", exact: true })
    .click();
  await page.getByRole("radio", { name: "Male", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Height (cm)", exact: true })
    .fill("180");
  await page
    .getByRole("textbox", { name: "Weight (kg)", exact: true })
    .fill("80");
  await continueTo(page, "How active are you?");
  await page.reload();
  await heading(page, "How active are you?");
  assert.equal((await record(page)).answers.name, "Alex");
  await page
    .getByRole("radio", { name: "Moderately active", exact: true })
    .click();
  await continueTo(page, "Your daily starting point");
  assert.ok((await page.locator("body").innerText()).includes("2,510"));
  await page
    .getByRole("textbox", {
      name: "Adjust target (optional, kcal)",
      exact: true,
    })
    .fill("2400");
  await continueTo(page, "Ready when you are.");
  await button(page, "Finish setup").click();
  await heading(page, "Calories");
  await page.reload();
  await heading(page, "Calories");
  await page.getByRole("tab", { name: /Settings/ }).click();
  await heading(page, "Settings");
  const original = await record(page);
  await page.getByRole("link", { name: /Edit profile/ }).click();
  await heading(page, "What's your goal?");
  await page.getByRole("radio", { name: "Gain weight", exact: true }).click();
  await button(page, "Cancel").click();
  await heading(page, "Settings");
  assert.deepEqual(await record(page), original);
  assert.equal(original.answers.customCalories, "2400");
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  assert.deepEqual(errors, []);
});

test("age gate covers skip and setup; a 16-year-old can finish without an adult estimate", async (t) => {
  const page = await open(t);
  await heading(page, "Hi, I'm Kine.");
  assert.equal(await page.getByRole("textbox").count(), 0);
  await button(page, "Let's go").click();
  await heading(page, "What's your goal?");
  await page.getByRole("radio", { name: "Lose weight", exact: true }).click();
  await continueTo(page, "Let's check your age");
  const age = page.getByRole("textbox", { name: "Age (years)", exact: true });
  await age.fill("15");
  for (const label of ["Set up later", "Continue"]) {
    await button(page, label).click();
    await page.getByText("Enter age between 16 and 100 years in whole years.", { exact: true }).waitFor();
    assert.equal(await button(page, "Continue").count(), 1);
  }
  await age.fill("16");
  await continueTo(page, "What should I call you?");
  await continueTo(page, "A little about you");
  assert.equal(
    await page
      .getByRole("radio", { name: "Use the standard estimate", exact: true })
      .count(),
    0,
  );
  await continueTo(page, "How active are you?");
  await continueTo(page, "Your daily starting point");
  assert.equal(await button(page, "How was this calculated?").count(), 0);
  await continueTo(page, "Ready when you are.");
  await button(page, "Finish setup").click();
  await heading(page, "Calories");
  const saved = await record(page);
  assert.equal(saved.kind, "complete");
  assert.equal(saved.answers.age, "16");
  assert.equal(saved.answers.estimateEnabled, false);
  assert.equal(saved.answers.customCalories, "");
});

test("onboarding poses load and onboarding fits phone and desktop widths", async (t) => {
  const page = await open(t);
  const failures = [];
  page.on("pageerror", (error) => failures.push(error.message));
  const screenshotDir = process.env.KINE_SCREENSHOT_DIR;
  if (screenshotDir) await mkdir(screenshotDir, { recursive: true });
  const steps = [
    ["welcome", "Hi, I'm Kine."],
    ["goal", "What's your goal?"],
    ["age", "Let's check your age"],
    ["name", "What should I call you?"],
    ["body", "A little about you"],
    ["activity", "How active are you?"],
    ["calories", "Your daily starting point"],
    ["review", "Ready when you are."],
  ];
  const sources = new Set();
  async function inspect(pose, width) {
    await page.setViewportSize({ width, height: 844 });
    const kine = page.getByTestId(`kine-${pose}`);
    await kine.waitFor();
    await kine.locator("img").evaluate(async (img) => {
      await img.decode();
    });
    await kine.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    await page.waitForFunction((pose) => {
      const element = document.querySelector(`[data-testid="kine-${pose}"]`);
      return (
        element &&
        ["none", "matrix(1, 0, 0, 1, 0, 0)"].includes(
          getComputedStyle(element).transform,
        )
      );
    }, pose);
    const source = await kine.locator("img").getAttribute("src");
    assert.match(source, /\.webp(?:\?|$)/, `${pose} should load the optimized 2D asset`);
    assert.equal(await kine.locator("img").getAttribute("loading"), "eager");
    sources.add(source);
    if (pose !== "settings") {
      const contentBox = await page.getByTestId("onboarding-content").boundingBox();
      const outerWidth = Math.min(width, pose === "welcome" ? 480 : 560);
      assert.ok(Math.abs(contentBox.x - ((width - outerWidth) / 2 + 12)) <= 1, `${pose} uses 12px screen margins`);
      assert.ok(Math.abs(contentBox.width - (outerWidth - 24)) <= 1, `${pose} content stays evenly inset`);
    }
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      `${pose} overflows at ${width}px`,
    );
    if (screenshotDir) {
      await page.evaluate(() => {
        for (const element of document.querySelectorAll("div"))
          if (element.scrollTop) element.scrollTop = 0;
      });
      await page.screenshot({
        path: join(screenshotDir, `${pose}-${width}.png`),
      });
    }
  }
  for (const [step, title] of steps) {
    await page.evaluate(
      ({ key, step, adult }) =>
        localStorage.setItem(
          key,
          JSON.stringify({ version: 1, kind: "draft", step, answers: adult }),
        ),
      { key, step, adult },
    );
    await page.goto(baseURL);
    await heading(page, title);
    await inspect(step, 390);
    if (["welcome", "body"].includes(step)) {
      await inspect(step, 320);
      await inspect(step, 1280);
    }
  }
  await page.evaluate(
    ({ key, adult }) =>
      localStorage.setItem(
        key,
        JSON.stringify({ version: 1, kind: "complete", answers: adult }),
      ),
    { key, adult },
  );
  await page.goto(baseURL);
  await heading(page, "Calories");
  await page.getByRole("tab", { name: /Settings/ }).click();
  await heading(page, "Settings");
  await inspect("settings", 390);
  await inspect("settings", 320);
  assert.equal(sources.size, 8);
  assert.deepEqual(failures, []);
});

test("Kine loads the visible pose first and warms the next pose without fetching the full collection", async (t) => {
  const page = await open(t, undefined, { reducedMotion: "reduce" });
  await heading(page, "Hi, I'm Kine.");
  const image = page.getByTestId("kine-welcome").locator("img");
  await image.evaluate((img) => img.decode());
  await page.waitForFunction(() =>
    performance.getEntriesByType("resource").some(({ name }) => /kine-goal[^/]*\.webp/.test(name)),
  );
  const assets = await page.evaluate(() =>
    performance.getEntriesByType("resource")
      .filter(({ name }) => /kine-[^/]+\.webp/.test(name))
      .map(({ name, encodedBodySize }) => ({ name, encodedBodySize })),
  );
  assert.equal(assets.length, 2, "Only the visible and upcoming poses should be requested");
  assert.ok(assets.every(({ encodedBodySize }) => encodedBodySize > 0 && encodedBodySize <= 50000));
  assert.equal(await image.getAttribute("fetchpriority"), "high");
});

test("reduced motion keeps Kine still, including when the preference changes", async (t) => {
  const page = await open(t, { version: 1, kind: "draft", step: "goal", answers: adult }, { reducedMotion: "reduce" });
  await heading(page, "What's your goal?");
  const frames = (locator) => locator.evaluate(async (element) => {
    const values = [];
    for (let frame = 0; frame < 12; frame++) {
      await new Promise(requestAnimationFrame);
      values.push(getComputedStyle(element).transform);
    }
    return values;
  });
  assert.equal(new Set(await frames(page.getByTestId("kine-goal"))).size, 1);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await continueTo(page, "Let's check your age");
  assert.ok(new Set(await frames(page.getByTestId("kine-age"))).size > 1);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForFunction(() => {
    const element = document.querySelector('[data-testid="kine-age"]');
    return element && ["none", "matrix(1, 0, 0, 1, 0, 0)", "translateY(0px) rotate(0deg) scale(1)"].includes(getComputedStyle(element).transform);
  });
  assert.ok(await page.getByTestId("kine-age").isVisible());
});

test("a malformed saved custom target can return to the estimate", async (t) => {
  const page = await open(t, {
    version: 1,
    kind: "draft",
    step: "calories",
    answers: { ...adult, customCalories: "2 400" },
  });
  await heading(page, "Your daily starting point");
  await button(page, "Use the estimate").click();
  assert.equal(await page.getByRole("textbox", { name: "Adjust target (optional, kcal)", exact: true }).inputValue(), "");
  await page.getByText("Estimated target", { exact: true }).waitFor();
  assert.ok((await page.locator("body").innerText()).includes("2,760"));
});

test("daily screens fit narrow phones and desktop in both themes", async (t) => {
  const page = await open(t, { version: 1, kind: "complete", answers: adult }, { reducedMotion: "reduce" });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  const screenshotDir = process.env.KINE_SCREENSHOT_DIR;
  if (screenshotDir) await mkdir(screenshotDir, { recursive: true });
  await heading(page, "Calories");
  for (const appearance of ["light", "dark"]) {
    await page.evaluate((appearance) => localStorage.setItem("kinevault-track.appearance", appearance), appearance);
    await page.reload();
    await heading(page, "Calories");
    assert.equal(await page.evaluate(() => document.documentElement.style.colorScheme), appearance);
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      let homeKineWidth;
      for (const [tab, title] of [["Home", "Calories"], ["Food", "Daily food log"], ["Exercise", "Workout of the day"], ["Settings", "Settings"]]) {
        await page.getByRole("tab", { name: new RegExp(tab) }).click();
        await heading(page, title);
        await page.evaluate(() => document.fonts.ready);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${tab} overflows at ${width}px`);
        const font = await page.getByRole("heading", { name: title, exact: true }).evaluate((el) => getComputedStyle(el).fontFamily);
        assert.match(font, /Comfortaa/);
        if (tab !== "Settings") assert.equal(await page.getByRole("heading", { name: tab, exact: true }).count(), 0);
        const pose = tab === "Home" ? "today" : tab.toLowerCase();
        const mascot = page.getByTestId(`kine-${pose}`);
        await mascot.locator("img").evaluate((img) => img.decode());
        assert.ok(await mascot.isVisible(), `${tab} must keep Kine`);
        const mascotBox = await mascot.boundingBox();
        assert.ok(mascotBox.width >= 64 && mascotBox.x + mascotBox.width <= width, `${tab} Kine fits beside its content`);
        if (tab === "Home") homeKineWidth = mascotBox.width;
        else {
          const contentBox = await page.getByTestId(`${pose}-kine-content`).boundingBox();
          const kineColumnBox = await page.getByTestId(`${pose}-kine-column`).boundingBox();
          assert.ok(Math.abs(contentBox.width - kineColumnBox.width) <= 1, `${tab} uses equal columns`);
          assert.ok(Math.abs(mascotBox.width - homeKineWidth) <= 1, `${tab} Kine matches Home size at ${width}px`);
          assert.ok(Math.abs(mascotBox.width - kineColumnBox.width) <= 1, `${tab} Kine fills its half`);
          assert.ok(contentBox.x + contentBox.width <= kineColumnBox.x, `${tab} content sits to Kine's left`);
        }
        const firstBlock = page.getByTestId(tab === "Home" ? "home-nutrition-row" : `${pose}-kine-row`);
        const firstBox = await firstBlock.boundingBox();
        const screenWidth = Math.min(width, 768);
        assert.ok(Math.abs(firstBox.x - ((width - screenWidth) / 2 + 12)) <= 1, `${tab} uses 12px screen margins`);
        assert.ok(Math.abs(firstBox.width - (screenWidth - 24)) <= 1, `${tab} content stays evenly inset`);
        const bodyText = await page.locator("body").innerText();
        for (const removed of ["Coming soon", "No food logged for this meal.", "Your workout summary will appear here", "Your exercises, weights, sets, and reps will appear here.", "Total lifted is weight × reps", "No steps recorded", "No water logged", "kcal goal", "kcal eaten", "remaining"]) {
          assert.equal(bodyText.includes(removed), false, `${tab} still shows removed caption: ${removed}`);
        }
        if (tab === "Home") {
          assert.equal(await page.getByRole("progressbar").count(), 4);
          assert.equal(await page.getByRole("heading", { name: "Today", exact: true }).count(), 0);
          for (const bar of await page.getByRole("progressbar").all()) assert.equal(await bar.getAttribute("aria-valuenow"), "0");
          const cards = await page.getByText("0 / 345 g", { exact: true }).evaluate((el) => {
            const box = el.getBoundingClientRect();
            return { left: box.left, right: box.right, width: innerWidth };
          });
          assert.ok(cards.left >= 0 && cards.right <= cards.width);
          assert.equal(bodyText.includes("Daily nutrition"), false);
          const calories = page.getByRole("progressbar", { name: /^0 kilocalories consumed, calorie goal/ });
          const calorieBox = await calories.boundingBox();
          const rowBox = await page.getByTestId("home-nutrition-row").boundingBox();
          const macrosBox = await page.getByTestId("home-macros").boundingBox();
          const kineColumnBox = await page.getByTestId("home-kine-column").boundingBox();
          assert.ok(rowBox.y + rowBox.height <= calorieBox.y, "calorie bar sits below macros and Kine");
          const caloriePanelBox = await page.getByTestId("home-calories").boundingBox();
          assert.ok(Math.abs(caloriePanelBox.width - rowBox.width) <= 1, "calorie widget spans both columns");
          assert.ok(Math.abs(macrosBox.width - kineColumnBox.width) <= 1, "macros and Kine split the row evenly");
          assert.ok(macrosBox.x + macrosBox.width <= kineColumnBox.x, "Home Kine is to the right of macros");
          assert.ok(Math.abs(mascotBox.width - kineColumnBox.width) <= 1, "Kine fills his half of the row");
          const workoutBox = await page.getByTestId("home-workout").boundingBox();
          const activityBox = await page.getByTestId("home-activity-row").boundingBox();
          const stepsBox = await page.getByTestId("home-steps").boundingBox();
          const waterBox = await page.getByTestId("home-water").boundingBox();
          for (const [before, after, name] of [[rowBox, caloriePanelBox, "macros to calories"], [caloriePanelBox, workoutBox, "calories to workout"], [workoutBox, activityBox, "workout to activity"]]) {
            assert.ok(Math.abs(after.y - before.y - before.height - 12) <= 1, `${name} has a 12px gap`);
          }
          assert.ok(Math.abs(macrosBox.y - rowBox.y) <= 1 && Math.abs(macrosBox.height - rowBox.height) <= 1, "macro panel fills the row without extra outer space");
          const macroRowsBox = await page.getByTestId("home-macro-rows").boundingBox();
          assert.ok(Math.abs(macroRowsBox.y + macroRowsBox.height / 2 - macrosBox.y - macrosBox.height / 2) <= 1, "macro rows center vertically in their panel");
          assert.ok(Math.abs(kineColumnBox.x - macrosBox.x - macrosBox.width - 12) <= 1, "macro/Kine gap is 12px");
          assert.ok(Math.abs(waterBox.x - stepsBox.x - stepsBox.width - 12) <= 1, "step/water gap is 12px");
          assert.equal(await page.locator("svg circle").count(), 0, "the calorie ring is removed");
          for (const [label, target] of [["Carbs", "345"], ["Protein", "173"], ["Fat", "77"]]) {
            const value = page.getByText(`0 / ${target} g`, { exact: true });
            const valueBox = await value.boundingBox();
            const macroBarBox = await page.getByRole("progressbar", { name: new RegExp(`^${label},`) }).boundingBox();
            assert.ok(valueBox.y + valueBox.height <= macroBarBox.y, `${label} current/goal sits above its bar`);
            const labelBox = await page.getByText(label, { exact: true }).boundingBox();
            assert.ok(Math.abs(labelBox.y + labelBox.height / 2 - valueBox.y - valueBox.height / 2) <= 1, `${label} count shares the label's line`);
            assert.ok(labelBox.x + labelBox.width <= valueBox.x, `${label} count follows its label`);
            assert.ok(await value.evaluate((el) => el.getBoundingClientRect().right <= el.parentElement.getBoundingClientRect().right + 1), `${label} count stays readable`);
          }
          await heading(page, "Steps");
          await heading(page, "Water");
        } else if (tab !== "Settings") {
          const splitBox = await page.getByTestId(`${pose}-kine-row`).boundingBox();
          const searchActionsBox = await page.getByTestId(`${pose}-search-actions`).boundingBox();
          const logBox = await page.getByTestId(tab === "Food" ? "daily-food-log" : "exercise-workout").boundingBox();
          const searchBox = await page.getByTestId(`${pose}-search-box`).boundingBox();
          assert.ok(Math.abs(searchBox.y - splitBox.y - splitBox.height - 12) <= 1, `${tab} actions-to-search gap is 12px`);
          assert.ok(Math.abs(logBox.y - searchActionsBox.y - searchActionsBox.height - 12) <= 1, `${tab} actions-to-log gap is 12px`);
          const actions = tab === "Food" ? ["Create food/meal", "View macros for the day"] : ["Create Exercise", "Create Workouts"];
          for (const label of actions) {
            const action = button(page, label);
            assert.equal(await action.isDisabled(), tab === "Exercise");
            const box = await action.boundingBox();
            const text = await action.getByText(label, { exact: true }).boundingBox();
            assert.ok(Math.abs(text.x + text.width / 2 - box.x - box.width / 2) <= 1, `${label} centers horizontally`);
            assert.ok(Math.abs(text.y + text.height / 2 - box.y - box.height / 2) <= 1, `${label} centers vertically`);
            assert.ok(box.x + box.width <= mascotBox.x, `${label} sits to Kine's left`);
          }
          if (tab === "Exercise") {
            await heading(page, "Completed exercises");
            for (const label of ["Sets", "Reps", "Weight"]) assert.ok(await page.getByText(label, { exact: true }).count() >= 1);
          } else {
            const foodLog = page.getByTestId("daily-food-log");
            assert.equal(await foodLog.getByText("No food has been logged yet", { exact: true }).count(), 5);
            for (const [key, label] of [["breakfast", "Breakfast"], ["lunch", "Lunch"], ["dinner", "Dinner"], ["snacks", "Snacks"], ["drinks", "Drinks"]]) {
              const section = foodLog.getByTestId(`meal-${key}`);
              assert.equal(await section.count(), 1);
              await section.getByRole("heading", { name: label, exact: true }).waitFor();
              assert.equal(await button(section, `Add food to ${label}`).count(), 0);
            }
          }
          const search = page.getByRole("textbox", { name: tab === "Food" ? "Search foods" : "Search exercises", exact: true });
          await search.fill("test");
          await button(page, "Clear search").click();
          assert.equal(await search.inputValue(), "");
        } else {
          const profileBox = await page.getByRole("heading", { name: "Your profile", exact: true }).locator("..").boundingBox();
          assert.ok(Math.abs(profileBox.y - firstBox.y - firstBox.height - 12) <= 1, "Settings intro-to-profile gap is 12px");
        }
        if (screenshotDir) await page.screenshot({ path: join(screenshotDir, `${tab.toLowerCase()}-${appearance}-${width}.png`) });
      }
    }
    await page.getByRole("tab", { name: /Home/ }).click();
  }
  assert.deepEqual(errors, []);
});

test("food catalog searches offline, scales portions, pages results, and recovers from empty searches", async (t) => {
  const page = await open(t, { version: 1, kind: "complete", answers: adult }, { viewport: { width: 320, height: 844 } });
  await heading(page, "Calories");
  await page.getByRole("tab", { name: /Food/ }).click();
  await heading(page, "Daily food log");
  const search = page.getByRole("textbox", { name: "Search foods", exact: true });
  await page.context().setOffline(true);
  await search.fill("bananas");
  const results = page.getByTestId("food-catalog-results");
  await results.getByText("Banana, raw", { exact: true }).waitFor();
  await button(page, "View nutrition for Banana, raw").click();
  const detail = page.getByTestId("food-nutrition-detail");
  await detail.getByText("97 kcal", { exact: true }).waitFor();
  await button(page, "1 banana, 126 g").click();
  await detail.getByText("122 kcal", { exact: true }).waitFor();
  const grams = page.getByRole("textbox", { name: "Amount (g)", exact: true });
  assert.equal(await grams.inputValue(), "126");
  await grams.fill("50");
  await detail.getByText("49 kcal", { exact: true }).waitFor();
  await detail.getByText("11.4 g", { exact: true }).waitFor();
  await grams.fill("");
  await detail.getByRole("alert").waitFor();
  assert.equal(await detail.getByText("49 kcal", { exact: true }).count(), 0);
  await grams.fill("12,5");
  await detail.getByText("12 kcal", { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await button(page, "Back to food results").click();
  await results.getByText("Banana, raw", { exact: true }).waitFor();
  await search.fill("zzzzunmatchedfood");
  await page.getByText("No foods or meals found. Try a simpler name or a different preparation.", { exact: true }).waitFor();
  await search.fill("chicken");
  await button(page, "Next food results").waitFor();
  const firstPage = await page.getByTestId("food-result").allTextContents();
  assert.equal(firstPage.length, 20);
  await button(page, "Next food results").click();
  assert.ok(await page.getByTestId("food-result").first().evaluate(el => {
    const box = el.getBoundingClientRect();
    return box.top >= 0 && box.bottom <= innerHeight;
  }), "the next page starts with its first food visible");
  const secondPage = await page.getByTestId("food-result").allTextContents();
  assert.equal(secondPage.length, 20);
  assert.ok(secondPage.every(text => !firstPage.includes(text)));
  await button(page, "Previous food results").click();
  assert.deepEqual(await page.getByTestId("food-result").allTextContents(), firstPage);
  await search.fill("banana raw");
  assert.equal(await button(page, "Next food results").count(), 0);
  await results.getByText("Banana, raw", { exact: true }).waitFor();
  await button(page, "Clear search").click();
  await heading(page, "Daily food log");
  await page.context().setOffline(false);
  await page.getByRole("tab", { name: /Home/ }).click();
  assert.equal(await page.getByRole("progressbar", { name: /^0 kilocalories consumed/ }).count(), 1);
});

test("food logging saves to the selected date and meal, retries failures, updates Home, and survives reload", async (t) => {
  const page = await open(t, { version: 1, kind: "complete", answers: adult }, { viewport: { width: 320, height: 844 } });
  const foodKey = "kinevault-track.food-log.v1";
  const savedFoods = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), foodKey);
  const failFoodWrite = () => page.evaluate(key => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (nextKey, value) {
      if (nextKey === key) {
        Storage.prototype.setItem = original;
        throw new Error("Simulated food save failure");
      }
      return original.call(this, nextKey, value);
    };
  }, foodKey);
  await heading(page, "Calories");
  await page.getByRole("tab", { name: /Food/ }).click();
  await heading(page, "Daily food log");
  await button(page, "Expand calendar").click();
  const pastDay = page.locator('button[aria-pressed]').nth(3);
  const pastLabel = await pastDay.getAttribute("aria-label");
  await pastDay.click();
  await button(page, "Collapse calendar").click();
  const search = page.getByRole("textbox", { name: "Search foods", exact: true });
  await search.fill("banana raw");
  await button(page, "View nutrition for Banana, raw").click();
  await button(page, "1 banana, 126 g").click();
  const lunchChoice = button(page, "Lunch");
  assert.equal(await lunchChoice.count(), 1);
  await lunchChoice.focus();
  await lunchChoice.press("Space");
  assert.equal(await lunchChoice.getAttribute("aria-pressed"), "true");
  assert.equal(await button(page, "Breakfast").getAttribute("aria-pressed"), "false");
  const amount = page.getByRole("textbox", { name: "Amount (g)", exact: true });
  await amount.fill("");
  assert.ok(await button(page, "Log food").isDisabled());
  await amount.fill("126");
  await failFoodWrite();
  await button(page, "Log food").click();
  await page.getByRole("alert").filter({ hasText: "Couldn't log this food" }).waitFor();
  assert.equal(await amount.inputValue(), "126");
  assert.equal(await savedFoods(), null);
  await button(page, "Log food").click();
  await heading(page, "Daily food log");
  const lunch = page.getByTestId("meal-lunch");
  await lunch.getByText("Banana, raw", { exact: true }).waitFor();
  await lunch.getByText("126 g · 122 kcal", { exact: true }).waitFor();
  assert.equal(await page.getByTestId("daily-food-log").getByText("No food has been logged yet", { exact: true }).count(), 4);
  for (const key of ["breakfast", "dinner", "snacks", "drinks"])
    assert.equal(await page.getByTestId(`meal-${key}`).getByText("No food has been logged yet", { exact: true }).count(), 1);
  assert.equal(await search.inputValue(), "");
  const saved = await savedFoods();
  const [date] = Object.keys(saved.days);
  assert.equal(saved.days[date].length, 1);
  assert.equal(saved.days[date][0].meal, "lunch");
  assert.equal(saved.days[date][0].calories, 122.22);
  await page.getByRole("tab", { name: /Home/ }).click();
  await page.getByText("122 / 2,760 kcal", { exact: true }).waitFor();
  await page.getByText("28.6 / 345 g", { exact: true }).waitFor();
  await page.reload();
  await heading(page, "Calories");
  await page.getByText("0 / 2,760 kcal", { exact: true }).waitFor();
  await button(page, "Expand calendar").click();
  await button(page, pastLabel).click();
  await button(page, "Collapse calendar").click();
  await page.getByText("122 / 2,760 kcal", { exact: true }).waitFor();
  await page.getByRole("tab", { name: /Food/ }).click();
  await heading(page, "Daily food log");
  await failFoodWrite();
  await button(page, "Remove Banana, raw from Lunch").click();
  await page.getByRole("alert").filter({ hasText: "Couldn't save your food log" }).waitFor();
  assert.equal((await savedFoods()).days[date].length, 1);
  await button(page, "Remove Banana, raw from Lunch").click();
  await page.getByTestId("meal-lunch").getByText("No food has been logged yet", { exact: true }).waitFor();
  await page.getByRole("tab", { name: /Home/ }).click();
  await page.getByText("0 / 2,760 kcal", { exact: true }).waitFor();
  assert.equal((await savedFoods()).days[date]?.length ?? 0, 0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
});

test("a corrupt food log offers recovery without showing an invented empty day", async (t) => {
  const page = await open(t, { version: 1, kind: "complete", answers: adult });
  await heading(page, "Calories");
  await page.evaluate(() => localStorage.setItem("kinevault-track.food-log.v1", "corrupt"));
  await page.reload();
  await heading(page, "Couldn't load your food log");
  assert.equal(await page.getByRole("progressbar").count(), 0);
  await page.evaluate(() => localStorage.setItem("kinevault-track.food-log.v1", JSON.stringify({ version: 1, days: {} })));
  await button(page, "Retry food log").click();
  await heading(page, "Calories");
  await page.getByText("0 / 2,760 kcal", { exact: true }).waitFor();
});

test("logged food edits retain the draft on failure, move meals, update totals, and survive reload", async (t) => {
  const page = await open(t, { version: 1, kind: "complete", answers: adult }, { viewport: { width: 320, height: 844 } });
  await heading(page, "Calories");
  await page.getByRole("tab", { name: /Food/ }).click();
  await page.getByRole("textbox", { name: "Search foods", exact: true }).fill("banana raw");
  await button(page, "View nutrition for Banana, raw").click();
  await button(page, "Log food").click();
  await heading(page, "Daily food log");
  const snapshot = () => page.evaluate(() => JSON.parse(localStorage.getItem("kinevault-track.food-log.v1")));
  const before = await snapshot();
  const [date] = Object.keys(before.days);
  assert.equal(await button(page, "Edit Banana, raw in Breakfast").count(), 1);
  await button(page, "Edit Banana, raw in Breakfast").click();
  await heading(page, "Edit logged food");
  const amount = page.getByRole("textbox", { name: "Amount (g)", exact: true });
  assert.equal(await amount.inputValue(), "100");
  assert.equal(await button(page, "Breakfast").getAttribute("aria-pressed"), "true");
  await amount.fill("200");
  await button(page, "Cancel edit").click();
  assert.deepEqual(await snapshot(), before);
  await button(page, "Edit Banana, raw in Breakfast").click();
  await amount.fill("");
  assert.ok(await button(page, "Save changes").isDisabled());
  await amount.fill("200");
  await button(page, "Dinner").click();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "kinevault-track.food-log.v1") {
        Storage.prototype.setItem = original;
        throw new Error("Simulated food edit failure");
      }
      return original.call(this, key, value);
    };
  });
  await button(page, "Save changes").click();
  await page.getByRole("alert").filter({ hasText: "Couldn't save your changes" }).waitFor();
  assert.equal(await amount.inputValue(), "200");
  assert.equal(await button(page, "Dinner").getAttribute("aria-pressed"), "true");
  assert.deepEqual(await snapshot(), before);
  await button(page, "Save changes").click();
  await heading(page, "Daily food log");
  await page.getByTestId("meal-dinner").getByText("200 g · 194 kcal", { exact: true }).waitFor();
  const after = await snapshot();
  assert.equal(after.days[date].length, 1);
  assert.equal(after.days[date][0].id, before.days[date][0].id);
  assert.equal(after.days[date][0].meal, "dinner");
  assert.equal(after.days[date][0].calories, 194);
  assert.equal(after.days[date][0].details.potassium, 652);
  await button(page, "View macros for the day").click();
  await page.getByTestId("daily-macro-view").getByText("194 / 2,760 kcal", { exact: true }).waitFor();
  await page.getByTestId("daily-nutrient-protein").getByText("1.48", { exact: true }).waitFor();
  await page.getByTestId("daily-nutrient-potassium").getByText("652", { exact: true }).waitFor();
  await page.getByRole("tab", { name: /Home/ }).click();
  await page.getByTestId("home-calories").getByText("194 / 2,760 kcal", { exact: true }).waitFor();
  await page.reload();
  await heading(page, "Calories");
  await page.getByTestId("home-calories").getByText("194 / 2,760 kcal", { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
});

test("daily macro view uses consistent category colors, reflects edits, and follows the selected day", async (t) => {
  const page = await open(t, { version: 1, kind: "complete", answers: adult }, { viewport: { width: 390, height: 844 } });
  await heading(page, "Calories");
  await page.getByRole("tab", { name: /Food/ }).click();
  assert.equal(await button(page, "View macros for the day").isDisabled(), false);
  await button(page, "View macros for the day").click();
  await heading(page, "Daily macros");
  await page.getByTestId("daily-macro-view").getByText("No food has been logged yet", { exact: true }).waitFor();
  await button(page, "Back to food log").click();
  await page.getByRole("textbox", { name: "Search foods", exact: true }).fill("banana raw");
  await button(page, "View nutrition for Banana, raw").click();
  await button(page, "Log food").click();
  await heading(page, "Daily food log");
  await button(page, "View macros for the day").click();
  const view = page.getByTestId("daily-macro-view");
  await view.getByText("97 / 2,760 kcal", { exact: true }).waitFor();
  await view.getByTestId("daily-nutrient-protein").getByText("0.74", { exact: true }).waitFor();
  const color = locator => locator.evaluate(el => getComputedStyle(el).backgroundColor);
  for (const theme of ["light", "dark"]) {
    await page.evaluate(theme => localStorage.setItem("kinevault-track.appearance", theme), theme);
    await page.reload();
    await page.getByRole("tab", { name: /Home/ }).click();
    await heading(page, "Calories");
    const colors = [];
    let filledWidth = 0;
    for (const category of ["carbs", "protein", "fat"]) {
      const segment = page.getByTestId(`home-calorie-${category}`);
      const categoryColor = await color(segment);
      colors.push(categoryColor);
      assert.equal(await color(page.getByTestId(`home-macro-${category}-fill`)), categoryColor);
      assert.equal(await page.getByTestId("home-macros").getByTestId(`macro-${category}-label`).evaluate(el => getComputedStyle(el).color), categoryColor);
      const box = await segment.boundingBox();
      assert.ok(box.width > 0, `${category} contributes to the calorie bar`);
      filledWidth += box.width;
    }
    assert.equal(new Set(colors).size, 3);
    const totalWidth = (await page.getByTestId("home-calorie-track").boundingBox()).width;
    assert.ok(Math.abs(filledWidth / totalWidth - 97 / 2760) < 0.001);
    await page.getByRole("tab", { name: /Food/ }).click();
    await button(page, "View macros for the day").click();
    await heading(page, "Daily macros");
    for (const [index, category] of ["carbs", "protein", "fat"].entries())
      assert.equal(await color(page.getByTestId(`day-calorie-${category}`)), colors[index]);
    assert.equal(
      await page.getByTestId("daily-nutrient-carbs").getByTestId("nutrient-label").evaluate(el => getComputedStyle(el).color),
      colors[0],
    );
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  }
  await button(page, "Expand calendar").click();
  await page.locator('button[aria-pressed]').filter({ hasText: /^\d+$/ }).nth(3).click();
  await button(page, "Collapse calendar").click();
  await heading(page, "Daily food log");
  await button(page, "View macros for the day").click();
  await page.getByTestId("daily-macro-view").getByText("0 / 2,760 kcal", { exact: true }).waitFor();
});

test("daily nutrition lists the requested units in order and supports old entries without inventing missing values", async (t) => {
  const page = await open(t, { version: 1, kind: "complete", answers: adult }, { viewport: { width: 320, height: 844 } });
  await heading(page, "Calories");
  await page.getByRole("tab", { name: /Food/ }).click();
  await button(page, "View macros for the day").click();
  const view = page.getByTestId("daily-macro-view");
  assert.equal(await view.getByText("Calories (kcal)", { exact: true }).count(), 1);
  const labels = view.getByTestId("nutrient-label");
  const expectedLabels = ["Calories (kcal)", "Carbs (g)", "Protein (g)", "Fat (g)", "Saturated fat (g)", "Trans fat (g)",
    "Fiber (g)", "Total sugars (g)", "Sodium (mg)", "Cholesterol (mg)", "Potassium (mg)",
    "Calcium (mg)", "Iron (mg)", "Vitamins D (mcg)", "Caffeine (mg)", "Alcohol (g)"];
  assert.deepEqual(await labels.allTextContents(), expectedLabels);
  assert.ok((await view.getByTestId("nutrient-value").allTextContents()).every(value => value === "0"));
  const calorieCard = await view.getByTestId("day-calories").boundingBox();
  const details = await view.getByTestId("daily-nutrient-details").boundingBox();
  assert.ok(calorieCard.y + calorieCard.height <= details.y);
  const labelX = key => view.getByTestId(`daily-nutrient-${key}`).getByTestId("nutrient-label").evaluate(el => {
    const range = document.createRange();
    range.selectNodeContents(el);
    return range.getBoundingClientRect().x;
  });
  assert.ok(await labelX("saturatedFat") > await labelX("fat"));
  assert.ok(await labelX("transFat") > await labelX("fat"));
  await button(page, "Back to food log").click();
  await page.getByRole("textbox", { name: "Search foods", exact: true }).fill("banana raw");
  await button(page, "View nutrition for Banana, raw").click();
  await page.getByRole("textbox", { name: "Amount (g)", exact: true }).fill("200");
  await button(page, "Log food").click();
  await button(page, "View macros for the day").click();
  for (const [key, value] of [["calories", "194"], ["carbs", "45.4"], ["protein", "1.48"], ["fat", "0.56"],
    ["saturatedFat", "0.22"], ["transFat", "Not available"], ["fiber", "3.4"], ["totalSugars", "31.6"],
    ["sodium", "0"], ["cholesterol", "0"], ["potassium", "652"], ["calcium", "10"],
    ["iron", "0"], ["vitaminD", "0"], ["caffeine", "0"], ["alcohol", "0"]])
    await view.getByTestId(`daily-nutrient-${key}`).getByText(value, { exact: true }).waitFor();
  const foodKey = "kinevault-track.food-log.v1";
  await page.evaluate(key => {
    const record = JSON.parse(localStorage.getItem(key));
    for (const entries of Object.values(record.days)) for (const entry of entries) delete entry.details;
    localStorage.setItem(key, JSON.stringify(record));
  }, foodKey);
  await page.reload();
  await heading(page, "Daily food log");
  await button(page, "View macros for the day").click();
  await view.getByTestId("daily-nutrient-potassium").getByText("652", { exact: true }).waitFor();
  for (const theme of ["light", "dark"]) {
    await page.evaluate(theme => localStorage.setItem("kinevault-track.appearance", theme), theme);
    await page.reload();
    await heading(page, "Daily food log");
    await button(page, "View macros for the day").click();
    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.equal(await labels.count(), 16);
    }
  }
});

test("35 calendar dates center today and share selection across daily tabs excluding Settings", async (t) => {
  const page = await open(t, { version: 1, kind: "complete", answers: adult }, { viewport: { width: 320, height: 844 }, locale: "en-US", timezoneId: "Asia/Jerusalem", reducedMotion: "reduce" });
  await heading(page, "Calories");
  await button(page, "Expand calendar").click();
  const dateButtons = page.locator('button[aria-pressed]').filter({ hasText: /^\d/ });
  assert.equal(await dateButtons.count(), 35);
  const todayIndex = await dateButtons.evaluateAll((buttons) => buttons.findIndex((button) => button.getAttribute("aria-label").endsWith(", today")));
  assert.ok(todayIndex >= 14 && todayIndex < 21, "today must be in the middle week");
  for (const date of await dateButtons.all()) {
    const box = await date.boundingBox();
    assert.ok(box.width >= 44 && box.height >= 44);
  }
  const target = dateButtons.nth(3);
  const selectedName = await target.getAttribute("aria-label");
  await target.click();
  assert.equal(await target.getAttribute("aria-pressed"), "true");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  for (const tab of ["Food", "Exercise"]) {
    await page.getByRole("tab", { name: new RegExp(tab) }).click();
    assert.equal(await button(page, selectedName).getAttribute("aria-pressed"), "true");
  }
  await page.getByRole("tab", { name: /Settings/ }).click();
  await heading(page, "Settings");
  assert.equal(await button(page, "Expand calendar").count(), 0);
  assert.equal(await button(page, "Collapse calendar").count(), 0);
  assert.equal(await dateButtons.count(), 0);
  await page.getByRole("tab", { name: /Home/ }).click();
  await heading(page, "Calories");
  assert.equal(await button(page, selectedName).getAttribute("aria-pressed"), "true");
  await button(page, "Select today").click();
  assert.equal(await dateButtons.nth(todayIndex).getAttribute("aria-pressed"), "true");
  const screenshotDir = process.env.KINE_SCREENSHOT_DIR;
  if (screenshotDir) await page.screenshot({ path: join(screenshotDir, "calendar-320.png") });
  await button(page, "Collapse calendar").click();
  assert.equal(await dateButtons.count(), 0);
});

test("editable macro grams persist and update the home targets", async (t) => {
  const page = await open(t, { version: 1, kind: "draft", step: "calories", answers: { ...adult, customCalories: "2400" } });
  await heading(page, "Your daily starting point");
  const carbs = page.getByRole("textbox", { name: "Carbs target (g)", exact: true });
  const protein = page.getByRole("textbox", { name: "Protein target (g)", exact: true });
  const fat = page.getByRole("textbox", { name: "Fat target (g)", exact: true });
  assert.equal(await carbs.getAttribute("placeholder"), "300");
  assert.equal(await protein.getAttribute("placeholder"), "150");
  assert.equal(await fat.getAttribute("placeholder"), "67");
  await carbs.fill("200");
  await protein.fill("160");
  await fat.fill("70");
  await continueTo(page, "Ready when you are.");
  assert.equal(await page.getByRole("progressbar", { name: "Setup progress" }).getAttribute("aria-valuemax"), "7");
  assert.equal(await page.getByRole("progressbar", { name: "Setup progress" }).getAttribute("aria-valuenow"), "7");
  await button(page, "Finish setup").click();
  await heading(page, "Calories");
  await page.getByText("0 / 200 g", { exact: true }).waitFor();
  await page.getByText("0 / 160 g", { exact: true }).waitFor();
  await page.getByText("0 / 70 g", { exact: true }).waitFor();
  await page.reload();
  await heading(page, "Calories");
  const saved = await record(page);
  assert.equal(saved.answers.customCarbs, "200");
  assert.equal(saved.answers.customProtein, "160");
  assert.equal(saved.answers.customFat, "70");
  assert.equal(saved.answers.customCalories, "2400");
});

test("unset and maximum calorie goals keep a readable bar below macros and Kine", async (t) => {
  for (const customCalories of ["", "10000"]) {
    const answers = { ...adult, estimateEnabled: false, eligible: false, sex: null, customCalories };
    const page = await open(t, { version: 1, kind: "complete", answers }, { reducedMotion: "reduce", viewport: { width: 320, height: 844 } });
    await heading(page, "Calories");
    const calories = page.getByRole("progressbar", { name: /^0 kilocalories consumed, calorie goal/ });
    const count = page.getByText(customCalories ? "0 / 10,000 kcal" : "0 / — kcal", { exact: true });
    const calorieBox = await calories.boundingBox();
    const countBox = await count.boundingBox();
    assert.ok(countBox.x >= 0 && countBox.x + countBox.width <= 320);
    assert.ok(await count.evaluate((el) => el.scrollWidth <= el.clientWidth), "calorie count stays readable");
    const rowBox = await page.getByTestId("home-nutrition-row").boundingBox();
    assert.ok(rowBox.y + rowBox.height <= calorieBox.y);
    const macrosBox = await page.getByTestId("home-macros").boundingBox();
    const mascotBox = await page.getByTestId("kine-today").boundingBox();
    assert.ok(Math.abs(macrosBox.width - mascotBox.width) <= 1, "Kine uses half the row");
    for (const [label, target] of [["Carbs", "1,250"], ["Protein", "625"], ["Fat", "278"]]) {
      const macroCount = page.getByRole("progressbar", { name: new RegExp(`^${label},`) }).locator("..").getByText(`0 / ${customCalories ? target : "—"} g`, { exact: true });
      const valueBox = await macroCount.boundingBox();
      const labelBox = await page.getByText(label, { exact: true }).boundingBox();
      assert.ok(Math.abs(labelBox.y + labelBox.height / 2 - valueBox.y - valueBox.height / 2) <= 1, `${label} count stays inline at 320px`);
      assert.ok(valueBox.x >= macrosBox.x && valueBox.x + valueBox.width <= macrosBox.x + macrosBox.width, `${label} count stays in the macro panel`);
      assert.ok(await macroCount.evaluate((el) => el.getBoundingClientRect().right <= el.parentElement.getBoundingClientRect().right + 1), `${label} count stays readable`);
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const screenshotDir = process.env.KINE_SCREENSHOT_DIR;
    if (screenshotDir) await page.screenshot({ path: join(screenshotDir, `home-${customCalories || "unset"}-320.png`) });
    if (!customCalories) {
      await page.getByRole("link", { name: "Set calorie and macro goals in Settings", exact: true }).click();
      await heading(page, "Settings");
    }
  }
});

test("completed workout widgets render coherent totals and filter only exercise rows", async (t) => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.route("**/__test-workout", route => route.fulfill({
    contentType: "text/html",
    body: '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0"><div id="root"></div><script src="/tests/workout-fixture.bundle?platform=web&dev=true&hot=false&minify=false"></script></body></html>',
  }));
  await page.goto(`${baseURL}/__test-workout`);
  const home = page.getByTestId("home-workout");
  const exercise = page.getByTestId("exercise-workout");
  for (const widget of [home, exercise]) {
    await widget.getByRole("heading", { name: "Strength fixture", exact: true }).waitFor();
    for (const value of ["1,300 kg", "30 min", "7", "69"])
      assert.equal(await widget.getByText(value, { exact: true }).count(), 1);
  }
  await exercise.getByText("10 reps", { exact: true }).waitFor();
  for (const [name, sets, reps, weight] of [
    ["Squat", 2, 18, "40–60 kg"],
    ["Press", 1, 12, "30 kg"],
    ["Push-up", 2, 25, "Bodyweight"],
    ["Pull-up", 2, 14, "0–10 kg"],
  ]) {
    for (const label of [`${name}, ${sets} sets`, `${name}, ${reps} reps`, `${name}, weight ${weight}`])
      assert.equal(await exercise.getByLabel(label, { exact: true }).count(), 1);
  }
  assert.equal(await page.getByText("Planned row", { exact: true }).count(), 0);
  assert.equal(await home.getByText("Completed exercises", { exact: true }).count(), 0);
  const filter = page.getByRole("textbox", { name: "Filter completed exercises", exact: true });
  await filter.fill("  pReSs  ");
  await exercise.getByText("Press", { exact: true }).waitFor();
  for (const name of ["Squat", "Push-up", "Pull-up"])
    assert.equal(await exercise.getByText(name, { exact: true }).count(), 0);
  for (const value of ["1,300 kg", "30 min", "7", "69", "4", "10 reps"])
    assert.equal(await exercise.getByText(value, { exact: true }).count(), 1);
  await filter.fill("unmatched");
  assert.equal(await exercise.getByText("Press", { exact: true }).count(), 0);
  assert.equal(await exercise.getByText("1,300 kg", { exact: true }).count(), 1);
  await filter.fill("");
  await exercise.getByText("Squat", { exact: true }).waitFor();
});

test("Profile recovery retries a repaired record and retains it when reset fails", async (t) => {
  const corrupt = { version: 2, kind: "complete", answers: adult };
  const page = await open(t, corrupt);
  await heading(page, "Couldn't load your profile");
  await page.evaluate(({ key, adult }) => {
    localStorage.setItem(key, JSON.stringify({ version: 1, kind: "complete", answers: adult }));
  }, { key, adult });
  await button(page, "Try again").click();
  await heading(page, "Calories");
  await page.reload();
  await heading(page, "Calories");

  const resetPage = await open(t, corrupt);
  await heading(resetPage, "Couldn't load your profile");
  await button(resetPage, "Start fresh").click();
  await resetPage.evaluate(key => {
    const original = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function (nextKey) {
      if (nextKey === key) {
        Storage.prototype.removeItem = original;
        throw new Error("Simulated reset failure");
      }
      return original.call(this, nextKey);
    };
  }, key);
  await button(resetPage, "Reset saved profile").click();
  await resetPage.getByRole("alert").filter({ hasText: "Couldn't reset your profile" }).waitFor();
  assert.deepEqual(await record(resetPage), corrupt);
  await button(resetPage, "Reset saved profile").click();
  await heading(resetPage, "Hi, I'm Kine.");
  assert.equal(await record(resetPage), null);
});
