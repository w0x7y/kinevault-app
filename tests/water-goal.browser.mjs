import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";

const baseURL = process.env.KINE_PREVIEW_URL || "http://localhost:8081";
const goalKey = "kinevault-track.water-goal.v1";
const waterKey = "kinevault-track.water-log.v1";
const foodKey = "kinevault-track.food-log.v1";
const answers = { name: "Goal fixture", goal: "maintain", activity: "moderate", age: "30", height: "180", weight: "80",
  sex: "male", estimateEnabled: true, eligible: true, customCalories: "" };
const button = (page, name) => page.getByRole("button", { name, exact: true });
const tab = (page, name) => page.getByRole("tab", { name, exact: true }).click();
const input = page => page.getByRole("textbox", { name: "Daily water goal (ml)", exact: true });
const stored = (page, key = goalKey) => page.evaluate(key => localStorage.getItem(key), key);
const encode = dailyMl => JSON.stringify({ version: 1, dailyMl });

async function open(t, { goal = null, water = null, food = null, goalError = false, goalState = "ready", waterState = "ready", appearance = "light" } = {}) {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 320, height: 844 }, timezoneId: "Asia/Jerusalem" });
  await context.addInitScript(({ answers, goalKey, waterKey, foodKey, goal, water, food, goalError, goalState, waterState, appearance }) => {
    if (!sessionStorage.getItem("goal-fixture-seeded")) {
      localStorage.setItem("kinevault-track.profile.v1", JSON.stringify({ version: 1, kind: "complete", answers }));
      localStorage.setItem("kinevault-track.appearance", appearance);
      if (goal !== null) localStorage.setItem(goalKey, goal);
      if (water !== null) localStorage.setItem(waterKey, JSON.stringify(water));
      if (food !== null) localStorage.setItem(foodKey, JSON.stringify(food));
      sessionStorage.setItem("goal-fixture-seeded", "true");
    }
    const get = Storage.prototype.getItem;
    window.__goalError = goalError;
    window.__goalWaterError = waterState === "error";
    let delayedWater = waterState === "loading";
    let delayedGoal = goalState === "loading";
    Storage.prototype.getItem = function(key) {
      if (key === goalKey && delayedGoal) {
        delayedGoal = false;
        return new Promise(resolve => { window.__releaseGoalRead = () => resolve(get.call(this, key)); });
      }
      if (key === goalKey && window.__goalError) throw new Error("Goal fixture read failure");
      if (key === waterKey && window.__goalWaterError) throw new Error("Water fixture read failure");
      if (key === waterKey && delayedWater) {
        delayedWater = false;
        return new Promise(resolve => { window.__releaseGoalWater = () => resolve(get.call(this, key)); });
      }
      return get.call(this, key);
    };
  }, { answers, goalKey, waterKey, foodKey, goal, water, food, goalError, goalState, waterState, appearance });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  await page.clock.install({ time: new Date("2026-10-01T12:00:00+03:00") });
  await page.goto(baseURL);
  await page.getByTestId("home-water").waitFor();
  return page;
}
async function progress(page, percent, consumedMl = percent * 20, goalMl = 2000) {
  const cup = page.getByTestId("water-goal-cup");
  await page.getByTestId("water-goal-progress").getByText(`${percent}% of goal`, { exact: true }).waitFor();
  const name = `Add water. ${consumedMl.toLocaleString()} ml consumed of a ${goalMl.toLocaleString()} ml daily goal. ${percent}% of goal.`;
  await button(page, name).waitFor();
  assert.equal(await button(page, name).getAttribute("data-testid"), "home-water");
  assert.ok((await button(page, name).ariaSnapshot()).includes(`button "${name}"`));
  assert.equal(await cup.getAttribute("aria-valuenow"), String(percent));
  assert.equal(await page.getByTestId("water-cup-fill").evaluate(element => element.style.height), `${percent}%`);
}

async function compactLayout(page, { unavailable = false, longAmount = false } = {}) {
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const row = await page.getByTestId("home-activity-row").boundingBox();
    const water = await page.getByTestId("home-water").boundingBox();
    const steps = await page.getByTestId("home-steps").boundingBox();
    const cup = await page.getByTestId(unavailable ? "water-cup-unavailable" : "water-goal-cup").boundingBox();
    const title = await page.getByTestId("home-water").getByText("Water", { exact: true }).boundingBox();
    const amount = await page.getByTestId("home-water-amount").boundingBox();
    const percent = await page.getByTestId("water-goal-progress").boundingBox();
    assert.equal(water.y, steps.y);
    assert.equal(water.height, steps.height);
    assert.equal(water.width, steps.width);
    assert.ok(water.x > steps.x);
    assert.ok(cup.width >= 44 && cup.width <= 54 && cup.height >= 56 && cup.height <= 64);
    assert.ok(cup.x >= title.x + title.width && cup.x >= amount.x + amount.width,
      `cup must be to the right of Water and its amount at ${width}px`);
    assert.ok(Math.abs(cup.y + cup.height / 2 - amount.y - amount.height / 2) <= 20,
      `cup must be beside the amount at ${width}px: ${JSON.stringify({ cup, amount })}`);
    assert.ok(cup.x + cup.width <= water.x + water.width && cup.y >= water.y);
    assert.ok(cup.y + cup.height <= percent.y && amount.y + amount.height <= percent.y);
    assert.ok(water.height <= (longAmount || unavailable ? 260 : 210),
      `water tile should remain compact at ${width}px; received ${water.height}px`);
    assert.ok(row.x + row.width <= width);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const overflowingText = await page.getByTestId("home-water").evaluate(tile => {
      const bounds = tile.getBoundingClientRect();
      const walker = document.createTreeWalker(tile, NodeFilter.SHOW_TEXT);
      const failures = [];
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (!node.textContent.trim()) continue;
        const textBounds = node.parentElement.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) {
          if (rect.left < bounds.left || rect.right > bounds.right || rect.top < bounds.top || rect.bottom > bounds.bottom
            || rect.left < textBounds.left - 1 || rect.right > textBounds.right + 1
            || rect.top < textBounds.top - 1 || rect.bottom > textBounds.bottom + 1) {
            failures.push(node.textContent);
          }
        }
      }
      return failures;
    });
    assert.deepEqual(overflowingText, [], `all water labels must fit at ${width}px`);
    const captions = page.getByTestId("home-water").getByText("Includes Drinks", { exact: true });
    await captions.waitFor();
    const includes = await captions.boundingBox();
    assert.ok(includes.y >= cup.y + cup.height && includes.y >= amount.y + amount.height);
    assert.ok(percent.x <= amount.x && percent.width > amount.width,
      "supporting captions should use the tile width below the cup");
  }
}

test("required default water goal validates, saves with feedback, edits and persists", async t => {
  const page = await open(t);
  await progress(page, 0, 0, 1500);
  await compactLayout(page);
  await tab(page, "Settings");
  await input(page).waitFor();
  assert.equal(await input(page).inputValue(), "1500");
  assert.equal(await button(page, "Remove water goal").count(), 0);
  assert.equal(await page.getByText(/^Optional\./).count(), 0);
  const status = page.getByTestId("water-goal-saved");
  assert.equal(await status.count(), 0);
  await button(page, "Save water goal").click();
  await status.waitFor();
  assert.equal(await status.innerText(), "Water goal saved.");
  assert.equal(await status.getAttribute("aria-live"), "polite");
  assert.equal(await stored(page), encode(1500));
  for (const value of ["", "0", "1.5", "10001", "2e3"]) {
    await input(page).fill(value);
    assert.equal(await status.count(), 0);
    await button(page, "Save water goal").click();
    await page.getByTestId("water-goal-settings").getByRole("alert").waitFor();
    assert.equal(await status.count(), 0);
    assert.equal(await stored(page), encode(1500));
  }
  await input(page).fill("2000"); await button(page, "Save water goal").click();
  await status.waitFor();
  await page.getByText("Current goal: 2,000 ml per day.", { exact: true }).waitFor();
  assert.equal(await stored(page), encode(2000));
  await tab(page, "Home"); await progress(page, 0);
  await page.reload(); await progress(page, 0);
  await tab(page, "Settings"); assert.equal(await input(page).inputValue(), "2000");
  assert.equal(await status.count(), 0);
  await input(page).fill("1000"); await button(page, "Save water goal").click();
  await status.waitFor();
  await page.getByText("Current goal: 1,000 ml per day.", { exact: true }).waitFor();
  assert.equal(await stored(page), encode(1000));
  assert.equal(await stored(page, waterKey), null); assert.equal(await stored(page, foodKey), null);
});

test("legacy empty goal uses the default cup without removing custom saved goals", async t => {
  const page = await open(t, { goal: encode(null) });
  await progress(page, 0, 0, 1500);
  await tab(page, "Settings"); await input(page).waitFor();
  assert.equal(await input(page).inputValue(), "1500");
  await button(page, "Save water goal").click();
  await page.getByTestId("water-goal-saved").waitFor();
  assert.equal(await stored(page), encode(1500));
  await page.reload(); await tab(page, "Home"); await progress(page, 0, 0, 1500);
});

test("cup follows selected-day water and Drinks totals, caps fill and preserves above-goal amounts", async t => {
  const drink = { id: "goal-drink", fdcId: 2709224, name: "Fixture drink", measurement: "volume", drinkMl: 500,
    meal: "drinks", calories: 100, carbs: 25, protein: 0, fat: 0 };
  const page = await open(t, { goal: encode(2000), water: { version: 1, days: { "2026-10-01": 500, "2026-09-30": 2500 } },
    food: { version: 1, days: { "2026-10-01": [drink] } } });
  await progress(page, 50);
  await page.getByTestId("home-water").getByText("1", { exact: true }).waitFor();
  await button(page, "Expand calendar").click(); await button(page, "Select previous day").click(); await button(page, "Collapse calendar").click();
  await progress(page, 100, 2500);
  await page.getByTestId("home-water").getByText("2.5", { exact: true }).waitFor();
  for (const appearance of ["light", "dark"]) {
    await page.evaluate(appearance => localStorage.setItem("kinevault-track.appearance", appearance), appearance);
    await page.reload(); await progress(page, 50);
    await compactLayout(page);
    const long = await open(t, { appearance, goal: encode(10000), water: { version: 1, days: { "2026-10-01": 999999 } } });
    await progress(long, 100, 999999, 10000);
    await long.getByTestId("home-water").getByText("Goal: 10,000 ml", { exact: true }).waitFor();
    await compactLayout(long, { longAmount: true });
  }
  await button(page, "Expand calendar").click(); await button(page, "Select today").click(); await button(page, "Collapse calendar").click();
  await progress(page, 50);
  await page.getByTestId("home-water").click();
  const dialog = page.getByRole("dialog", { name: "Edit water", exact: true });
  await dialog.getByRole("textbox", { name: "Manual water (ml)", exact: true }).fill("1500");
  await button(dialog, "Save water").click(); await dialog.waitFor({ state: "detached" });
  await progress(page, 100); await page.getByTestId("home-water").getByText("2", { exact: true }).waitFor();
});

test("goal save failure preserves the draft and saved goal, and duplicate pending saves write once", async t => {
  const page = await open(t, { goal: encode(1500) });
  await tab(page, "Settings");
  const status = page.getByTestId("water-goal-saved");
  await button(page, "Save water goal").click(); await status.waitFor();
  await page.evaluate(key => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function(k, value) {
      if (k === key) { Storage.prototype.setItem = set; throw new Error("Goal fixture write failure"); }
      return set.call(this, k, value);
    };
  }, goalKey);
  await button(page, "Save water goal").click();
  await page.getByRole("alert").filter({ hasText: "Couldn't save your water goal" }).waitFor();
  assert.equal(await input(page).inputValue(), "1500"); assert.equal(await stored(page), encode(1500));
  assert.equal(await status.count(), 0);
  await input(page).fill("2000");
  await page.evaluate(key => {
    const set = Storage.prototype.setItem; window.__goalWrites = 0;
    Storage.prototype.setItem = function(k, value) {
      if (k !== key) return set.call(this, k, value);
      window.__goalWrites++;
      return new Promise(resolve => { window.__releaseGoal = () => { Storage.prototype.setItem = set; set.call(this, k, value); resolve(); }; });
    };
  }, goalKey);
  await button(page, "Save water goal").evaluate(element => { element.click(); element.click(); element.click(); });
  assert.equal(await page.evaluate(() => window.__goalWrites), 1);
  assert.equal(await button(page, "Saving water goal...").isDisabled(), true);
  assert.equal(await input(page).isEditable(), false);
  assert.equal(await status.count(), 0);
  assert.equal(await stored(page), encode(1500));
  await page.evaluate(() => window.__releaseGoal());
  await page.getByText("Current goal: 2,000 ml per day.", { exact: true }).waitFor();
  assert.equal(await stored(page), encode(2000));
  await status.waitFor();
});

test("loading and corrupt goals remain unknown until a successful load", async t => {
  for (const state of ["loading", "corrupt"]) {
    const page = await open(t, { goal: state === "corrupt" ? "broken" : encode(2000), goalState: state });
    await page.getByTestId("water-cup-unavailable").waitFor();
    assert.equal(await page.getByTestId("water-goal-cup").count(), 0);
    assert.equal(await page.getByTestId("water-cup-fill").count(), 0);
    await page.getByTestId("home-water").getByText(state === "loading" ? "Goal loading..." : "Goal unavailable", { exact: true }).waitFor();
    assert.equal(await page.getByTestId("water-goal-progress").innerText(), "Goal progress unavailable");
    const label = await page.getByTestId("home-water").getAttribute("aria-label");
    assert.ok(label.includes(`Daily goal ${state === "loading" ? "loading" : "unavailable"}`));
    await compactLayout(page, { unavailable: true });
    await tab(page, "Settings");
    assert.equal(await input(page).count(), 0);
    assert.equal(await page.getByTestId("water-goal-saved").count(), 0);
    if (state === "loading") {
      await page.getByText("Loading water goal...", { exact: true }).waitFor();
      await page.evaluate(() => window.__releaseGoalRead());
    } else {
      await page.getByRole("alert").filter({ hasText: "Couldn't load your water goal" }).waitFor();
      assert.equal(await stored(page), "broken");
      await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: goalKey, value: encode(2000) });
      await button(page, "Retry water goal").click();
    }
    await input(page).waitFor();
    assert.equal(await input(page).inputValue(), "2000");
    await tab(page, "Home"); await progress(page, 0);
  }
});

test("unreadable goal retries safely and unknown water totals never show an empty progress cup", async t => {
  const page = await open(t, { goal: encode(2000), goalError: true });
  await page.getByTestId("home-water").getByText("Goal unavailable", { exact: true }).waitFor();
  await tab(page, "Settings"); await page.getByRole("alert").filter({ hasText: "Couldn't load your water goal" }).waitFor();
  assert.equal(await input(page).count(), 0);
  await page.evaluate(() => { window.__goalError = false; });
  assert.equal(await stored(page), encode(2000));
  await button(page, "Retry water goal").click(); await input(page).waitFor();
  assert.equal(await input(page).inputValue(), "2000");
  for (const appearance of ["light", "dark"]) {
    for (const waterState of ["loading", "error"]) {
      const unknown = await open(t, { appearance, goal: encode(2000), water: { version: 1, days: { "2026-10-01": 1000 } }, waterState });
      await unknown.getByTestId("water-cup-unavailable").waitFor();
      assert.equal(await unknown.getByTestId("water-goal-cup").count(), 0);
      assert.equal(await unknown.getByTestId("water-cup-fill").count(), 0);
      assert.equal(await unknown.getByTestId("water-goal-progress").innerText(), "Goal progress unavailable");
      const name = `Add water. Water total ${waterState === "loading" ? "loading" : "unavailable"}. Daily goal: 2,000 ml. Progress unavailable.`;
      await button(unknown, name).waitFor();
      assert.equal(await button(unknown, name).getAttribute("data-testid"), "home-water");
      assert.match(await button(unknown, name).ariaSnapshot(), /Progress unavailable/);
      await compactLayout(unknown, { unavailable: true });
      await unknown.getByTestId("home-water").click();
      await unknown.evaluate(() => { window.__goalWaterError = false; });
      await button(unknown, "Retry water log").click();
      await button(unknown, "Cancel").click(); await progress(unknown, 50);
      if (waterState === "loading") await unknown.evaluate(() => window.__releaseGoalWater());
    }
  }
});


test("Food and daily macros remain usable while water and goal sources are unavailable", async t => {
  const entry = { id: "independent-food", fdcId: 1, name: "Independent breakfast", meal: "breakfast", grams: 100,
    calories: 240, carbs: 30, protein: 12, fat: 8 };
  for (const unavailable of ["loading", "error"]) {
    const page = await open(t, { waterState: unavailable, goalState: unavailable, goalError: unavailable === "error",
      food: { version: 1, days: { "2026-10-01": [entry] } } });
    await page.getByTestId("water-cup-unavailable").waitFor();
    assert.equal(await page.getByTestId("home-water-amount").textContent(), "—");
    await tab(page, "Food");
    await page.getByTestId("meal-breakfast").getByText(entry.name, { exact: true }).waitFor();
    await button(page, "View macros for the day").click();
    await page.getByTestId("daily-nutrient-calories").getByTestId("nutrient-value").getByText("240", { exact: true }).waitFor();
    await button(page, "Back to food log").click();
    await tab(page, "Exercise");
    await page.getByRole("textbox", { name: "Search exercises", exact: true }).waitFor();
    await tab(page, "Home");
    await page.getByTestId("water-cup-unavailable").waitFor();
    assert.equal(await page.getByTestId("water-goal-cup").count(), 0);
  }
});
