import assert from "node:assert/strict";
import test from "node:test";
import { launchBrowser } from "./helpers/browser.mjs";
import { installAccountFixture } from "./helpers/account-fixture.mjs";

const baseURL = process.env.KINE_PREVIEW_URL || "http://localhost:8081";
const profileKey = "kinevault-track.profile.v1";
const today = "2026-10-04";
const answers = {
  name: "Units fixture",
  age: "30",
  height: "180",
  weight: "80",
  goal: "maintain",
  activity: "moderate",
  sex: "male",
  estimateEnabled: true,
  eligible: true,
  customCalories: "2000",
  customCarbs: "",
  customProtein: "",
  customFat: "",
};
const exercise = (id, name, tracking) => ({
  id,
  name,
  muscleGroup: "",
  equipment: "",
  notes: "",
  tracking,
});
// Saved metric figures that read as round imperial ones: 135 lb, 3.1 mi, 5 oz and 16 fl oz.
const session = {
  id: "session",
  date: today,
  name: "Legs",
  status: "completed",
  startedAt: null,
  durationSeconds: 1800,
  exercises: [
    {
      id: "squat-row",
      exercise: exercise("squat", "Squat", "single"),
      sets: [{ id: "squat-set", kind: "single", reps: "5", weightKg: "61.235" }],
    },
    {
      id: "run-row",
      exercise: exercise("run", "Run", "cardio"),
      sets: [{ id: "run-set", kind: "cardio", seconds: "1500", distanceMeters: "4990" }],
    },
  ],
};
const foods = [
  {
    id: "banana",
    fdcId: 1,
    name: "Banana, raw",
    meal: "breakfast",
    grams: 141.75,
    calories: 126,
    carbs: 32,
    protein: 1.5,
    fat: 0.5,
  },
  {
    id: "cola",
    name: "Soft drink, cola",
    fdcId: 2710541,
    meal: "drinks",
    measurement: "volume",
    drinkMl: 473,
    calories: 200,
    carbs: 50,
    protein: 0,
    fat: 0,
  },
];

const button = (page, name) => page.getByRole("button", { name, exact: true });
async function tab(page, name, path) {
  await page.getByRole("tab", { name, exact: true }).click();
  await page.waitForURL((url) => url.pathname === path);
}

test("Imperial reads every tab in pounds, miles, ounces and fluid ounces, and types pounds back exactly", async (t) => {
  const browser = await launchBrowser();
  t.after(() => browser.close());
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    timezoneId: "Asia/Jerusalem",
  });
  await context.addInitScript(
    ({ answers, session, foods, today }) => {
      if (sessionStorage.getItem("units-fixture")) return;
      localStorage.setItem(
        "kinevault-track.profile.v1",
        JSON.stringify({
          version: 1,
          kind: "complete",
          answers,
          weightEntries: [{ date: "2026-10-01", kg: 81.65 }],
          bodyMeasurements: [{ date: "2026-10-01", cm: { waist: 81.3 } }],
        }),
      );
      localStorage.setItem(
        "kinevault-track.food-log.v1",
        JSON.stringify({ version: 1, days: { [today]: foods } }),
      );
      localStorage.setItem(
        "kinevault-track.water-log.v1",
        JSON.stringify({ version: 1, days: { [today]: 237 } }),
      );
      localStorage.setItem(
        "kinevault-track.exercise.v1",
        JSON.stringify({
          version: 1,
          exercises: [],
          workouts: [],
          sessions: [session],
          developmentExamplesSeeded: true,
        }),
      );
      sessionStorage.setItem("units-fixture", "1");
    },
    { answers, session, foods, today },
  );
  await installAccountFixture(context);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(30000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, []));
  await page.clock.install({ time: new Date("2026-10-04T12:00:00+03:00") });
  await page.goto(baseURL);
  // Metric until the setting changes.
  await page.getByTestId("home-workout").getByText("306 kg", { exact: true }).waitFor();

  await tab(page, "Settings", "/settings");
  await page.getByText("English · Metric (kg, cm, km, ml) · Version 1.0.0").waitFor();
  const imperial = page.getByRole("radio", { name: "Imperial", exact: true });
  await imperial.click();
  await page.getByText("English · Imperial (lb, in, mi, fl oz) · Version 1.0.0").waitFor();
  assert.equal(await imperial.getAttribute("aria-checked"), "true");
  assert.equal(
    await page.evaluate(() => localStorage.getItem("kinevault-track.units")),
    "imperial",
  );
  await page.getByText("Current goal: 51 fl oz per day.", { exact: true }).waitFor();

  // Home: water in fluid ounces (Manual water plus the cola) and the workout in pounds.
  await tab(page, "Home", "/");
  await page.getByTestId("home-water").getByText("Goal: 51 fl oz", { exact: true }).waitFor();
  assert.equal(await page.getByTestId("home-water-amount").innerText(), "24");
  await page.getByTestId("home-water").getByText("fl oz", { exact: true }).waitFor();
  await page.getByTestId("home-workout").getByText("675 lb", { exact: true }).waitFor();

  // Food: a weighed entry in ounces and a drink in fluid ounces.
  await tab(page, "Food", "/food");
  await page.getByText("5 oz · 126 kcal", { exact: true }).waitFor();
  await page.getByText("16 fl oz · 200 kcal", { exact: true }).waitFor();

  // Exercise: the day's title and the Workout card.
  await tab(page, "Exercise", "/exercise");
  await page.getByText("675 lb · 3.1 mi · 30 min", { exact: true }).waitFor();
  const card = page.getByTestId("exercise-workout");
  await card.getByText("135 lb", { exact: true }).waitFor();
  await card.getByText("3.1 mi", { exact: false }).first().waitFor();

  // Personal journal: body weight in pounds and the waist in inches.
  await button(page, "Profile menu").click();
  await page.getByRole("menuitem", { name: "Profile", exact: true }).click();
  const journal = page.getByTestId("profile-weight-journal");
  await journal.waitFor();
  assert.match(await page.getByTestId("weight-entry-2026-10-01").innerText(), /180\s*lb/);
  assert.match(await page.getByTestId("measurement-entry-2026-10-01").innerText(), /Waist\s32\sin/);

  // Typed pounds save as kilograms and show back exactly as typed.
  await button(page, "Log weight").click();
  await page
    .getByRole("textbox", { name: "Measurement date (YYYY-MM-DD)", exact: true })
    .fill(today);
  const weight = page.getByRole("textbox", { name: "Body weight (lb)", exact: true });
  await weight.fill("175.5");
  await button(page, "Save weight").click();
  await page.getByTestId(`weight-entry-${today}`).waitFor();
  assert.match(await page.getByTestId(`weight-entry-${today}`).innerText(), /175\.5\s*lb/);
  const saved = await page.evaluate(
    (key) => JSON.parse(window.accountFixture.getItem(key)).weightEntries,
    profileKey,
  );
  assert.deepEqual(saved.at(-1), { date: today, kg: 79.61 });
  await button(page, `Edit weight ${today}`).click();
  assert.equal(await weight.inputValue(), "175.5");
  // More decimals than a pound field takes ask for one.
  await weight.fill("175.55");
  await button(page, "Save weight").click();
  await page
    .getByText("Enter a weight in lb with up to one decimal place.", { exact: true })
    .waitFor();
});

test("Imperial setup takes height in feet and inches and weight in pounds, and saves metric", async (t) => {
  const browser = await launchBrowser();
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 320, height: 844 } });
  await context.addInitScript(
    ({ answers, profileKey }) => {
      if (sessionStorage.getItem("units-setup")) return;
      localStorage.setItem(
        profileKey,
        JSON.stringify({ version: 1, kind: "draft", step: "body", answers }),
      );
      localStorage.setItem("kinevault-track.units", "imperial");
      sessionStorage.setItem("units-setup", "1");
    },
    { answers, profileKey },
  );
  await installAccountFixture(context, { signedIn: false });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(30000);
  await page.goto(baseURL);
  await page.getByRole("heading", { name: "A little about you", exact: true }).waitFor();
  const feet = page.getByRole("textbox", { name: "Height, feet", exact: true });
  const inches = page.getByRole("textbox", { name: "Height, inches", exact: true });
  const weight = page.getByRole("textbox", { name: "Weight (lb)", exact: true });
  // 180 cm and 80 kg, saved in Metric, read rounded.
  assert.equal(await feet.inputValue(), "5");
  assert.equal(await inches.inputValue(), "10.9");
  assert.equal(await weight.inputValue(), "176.4");
  await feet.fill("6");
  await inches.fill("1");
  await weight.fill("190.5");
  // Under the limits, the message names them in feet and inches.
  await feet.fill("3");
  await button(page, "Continue").click();
  await page
    .getByText("Enter height between 3 ft 3.4 in and 8 ft 2.4 in.", { exact: true })
    .waitFor();
  await feet.fill("6");
  await button(page, "Continue").click();
  await page.getByRole("heading", { name: "How active are you?", exact: true }).waitFor();
  const draft = await page.evaluate(
    (key) => JSON.parse(window.accountFixture.getItem(key)),
    profileKey,
  );
  assert.equal(draft.answers.height, "185.4");
  assert.equal(draft.answers.weight, "86.41");
  await button(page, "Back").click();
  await page.getByRole("heading", { name: "A little about you", exact: true }).waitFor();
  assert.deepEqual(
    [await feet.inputValue(), await inches.inputValue(), await weight.inputValue()],
    ["6", "1", "190.5"],
  );
});
