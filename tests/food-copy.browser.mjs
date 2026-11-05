import { installAccountFixture } from "./helpers/account-fixture.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { failNextWrite, launchBrowser } from "./helpers/browser.mjs";

const baseURL = process.env.KINE_PREVIEW_URL || "http://localhost:8081";
const foodKey = "kinevault-track.food-log.v1";
const today = "2026-10-01";
const answers = {
  name: "Copy fixture",
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
const banana = {
  id: "source-banana",
  name: "Banana, raw",
  fdcId: 2709224,
  meal: "breakfast",
  grams: 50,
  calories: 48.5,
  carbs: 11.35,
  protein: 0.37,
  fat: 0.14,
};
const cola = {
  id: "source-cola",
  name: "Soft drink, cola",
  fdcId: 2710541,
  meal: "drinks",
  measurement: "volume",
  drinkMl: 250,
  calories: 105,
  carbs: 26.5,
  protein: 0,
  fat: 0,
};
const oats = { ...banana, id: "older-oats", name: "Oats", meal: "lunch", grams: 80, calories: 200 };
// Today is October 1, so the day before is in September's history partition.
const history = { version: 1, days: { "2026-09-25": [oats], "2026-09-30": [banana, cola] } };

const button = (page, name) => page.getByRole("button", { name, exact: true });
const heading = (page, name) => page.getByRole("heading", { name, exact: true }).waitFor();
const stored = (page) =>
  page.evaluate((key) => JSON.parse(window.accountFixture.getItem(key)), foodKey);
const seed = (page, document) =>
  page.evaluate(
    ({ key, document }) => window.accountFixture.setItem(key, JSON.stringify(document)),
    { key: foodKey, document },
  );

async function open(t) {
  const browser = await launchBrowser();
  t.after(() => browser.close());
  const context = await browser.newContext({
    viewport: { width: 320, height: 844 },
    timezoneId: "Asia/Jerusalem",
  });
  await context.addInitScript((answers) => {
    if (sessionStorage.getItem("copy-fixture-seeded")) return;
    localStorage.setItem(
      "kinevault-track.profile.v1",
      JSON.stringify({ version: 1, kind: "complete", answers }),
    );
    sessionStorage.setItem("copy-fixture-seeded", "true");
  }, answers);
  await installAccountFixture(context);
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.setDefaultNavigationTimeout(30000);
  await page.clock.install({ time: new Date("2026-10-01T12:00:00+03:00") });
  await page.goto(baseURL);
  await page.getByTestId("home-water").waitFor();
  return page;
}
async function foodTab(page) {
  await page.getByRole("tab", { name: "Food", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/food");
  await heading(page, "Daily food log");
}

test("a meal and a whole day copy from last month's partition in one save each", async (t) => {
  const page = await open(t);
  await seed(page, history);
  // A missing September fragment makes the source unavailable, with a retry.
  await page.evaluate(() => {
    const fragment = Object.keys(localStorage).find((key) =>
      key.includes("food-log.v1.partition.v2.2026-09."),
    );
    localStorage.removeItem(fragment);
  });
  await page.reload();
  await foodTab(page);
  await heading(page, "Couldn't load your food log");
  assert.equal(await button(page, "Copy food from another day").count(), 0);
  await seed(page, history);
  await button(page, "Retry food log").click();

  await button(page, "Copy food from another day").click();
  await heading(page, "Copy food");
  const copy = page.getByTestId("food-copy");
  await copy.getByText("Adds copies to Thu, Oct 1.", { exact: false }).waitFor();
  await copy.getByText("2 entries · 154 kcal", { exact: true }).waitFor();
  await copy.getByText("Wed, Sep 30", { exact: false }).waitFor();
  assert.equal(await button(page, "Next day with food").isDisabled(), true);
  await button(page, "Previous day with food").click();
  await copy.getByText("1 entry · 200 kcal", { exact: true }).first().waitFor();
  assert.equal(await button(page, "Previous day with food").isDisabled(), true);
  await button(page, "Next day with food").click();
  await copy.getByText("2 entries · 154 kcal", { exact: true }).waitFor();
  const meals = page.getByTestId("food-copy-meals");
  await meals.getByText("Breakfast", { exact: true }).waitFor();
  await meals.getByText("Drinks", { exact: true }).waitFor();
  assert.equal(await meals.getByText("Lunch", { exact: true }).count(), 0);

  // A failed save writes nothing and keeps the page for a retry.
  await failNextWrite(page, foodKey);
  await button(page, "Copy Breakfast to Thu, Oct 1").click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Couldn't copy Breakfast. Nothing was saved. Try again." })
    .waitFor();
  assert.equal((await stored(page)).days[today], undefined);
  await button(page, "Copy Breakfast to Thu, Oct 1").click();
  await heading(page, "Daily food log");
  await page.getByTestId("meal-breakfast").getByText("Banana, raw", { exact: true }).waitFor();
  let copied = (await stored(page)).days[today];
  assert.equal(copied.length, 1);
  assert.notEqual(copied[0].id, banana.id);
  assert.deepEqual({ ...copied[0], id: banana.id }, banana);

  await button(page, "Copy food from another day").click();
  await button(page, "Copy whole day, 2 entries · 154 kcal, to Thu, Oct 1").click();
  await heading(page, "Daily food log");
  await page.getByTestId("meal-drinks").getByText("250 ml · 105 kcal", { exact: true }).waitFor();
  copied = (await stored(page)).days[today];
  assert.deepEqual(
    copied.map(({ meal, grams, drinkMl }) => [meal, grams, drinkMl]),
    [
      ["breakfast", 50, undefined],
      ["breakfast", 50, undefined],
      ["drinks", undefined, 250],
    ],
  );
  assert.equal(new Set(copied.map((entry) => entry.id)).size, 3);
  assert.deepEqual((await stored(page)).days["2026-09-30"], [banana, cola]);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);

  // A copied drink counts toward water like any other.
  await page.getByRole("tab", { name: "Home", exact: true }).click();
  await page.getByTestId("home-water").getByText("0.25", { exact: true }).waitFor();
});

test("a day without food says so and the arrows only offer days with food", async (t) => {
  const page = await open(t);
  await seed(page, { version: 1, days: { "2026-09-25": [oats] } });
  await page.reload();
  await foodTab(page);
  await button(page, "Copy food from another day").click();
  const copy = page.getByTestId("food-copy");
  await copy.getByText("No food logged", { exact: false }).waitFor();
  await copy
    .getByText("Nothing to copy from Wed, Sep 30. The arrows go to days with food.", {
      exact: true,
    })
    .waitFor();
  assert.equal(await button(page, "Copy whole day, 1 entry · 200 kcal, to Thu, Oct 1").count(), 0);
  await button(page, "Previous day with food").click();
  await copy.getByText("Fri, Sep 25", { exact: false }).waitFor();
  await button(page, "Copy Lunch to Thu, Oct 1").waitFor();
  await button(page, "Back to food log").click();
  await heading(page, "Daily food log");

  await seed(page, { version: 1, days: {} });
  await page.reload();
  await foodTab(page);
  await button(page, "Copy food from another day").click();
  await page.getByText("No other day has food to copy yet.", { exact: true }).waitFor();
  assert.equal(await button(page, "Previous day with food").isDisabled(), true);
  assert.equal(await button(page, "Next day with food").isDisabled(), true);
});
