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
  page.getByRole("button", { name: label, exact: true });
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
        const firstBlock = page.getByTestId(tab === "Home" ? "home-calories" : `${pose}-${tab === "Settings" ? "kine-row" : "search-box"}`);
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
          assert.ok(calorieBox.y + calorieBox.height <= rowBox.y, "calorie bar sits above macros and Kine");
          const caloriePanelBox = await page.getByTestId("home-calories").boundingBox();
          assert.ok(Math.abs(caloriePanelBox.width - rowBox.width) <= 1, "calorie widget spans both columns");
          assert.ok(Math.abs(macrosBox.width - kineColumnBox.width) <= 1, "macros and Kine split the row evenly");
          assert.ok(macrosBox.x + macrosBox.width <= kineColumnBox.x, "Home Kine is to the right of macros");
          assert.ok(Math.abs(mascotBox.width - kineColumnBox.width) <= 1, "Kine fills his half of the row");
          const workoutBox = await page.getByTestId("home-workout").boundingBox();
          const activityBox = await page.getByTestId("home-activity-row").boundingBox();
          const stepsBox = await page.getByTestId("home-steps").boundingBox();
          const waterBox = await page.getByTestId("home-water").boundingBox();
          for (const [before, after, name] of [[caloriePanelBox, rowBox, "calories to macros"], [rowBox, workoutBox, "macros to workout"], [workoutBox, activityBox, "workout to activity"]]) {
            assert.ok(Math.abs(after.y - before.y - before.height - 12) <= 1, `${name} has a 12px gap`);
          }
          assert.ok(Math.abs(macrosBox.y - rowBox.y) <= 1 && Math.abs(macrosBox.height - rowBox.height) <= 1, "macro panel fills the row without extra outer space");
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
          assert.ok(Math.abs(splitBox.y - firstBox.y - firstBox.height - 12) <= 1, `${tab} search-to-actions gap is 12px`);
          assert.ok(Math.abs(logBox.y - searchActionsBox.y - searchActionsBox.height - 12) <= 1, `${tab} actions-to-log gap is 12px`);
          const actions = tab === "Food" ? ["Create Foods", "View macros for the day"] : ["Create Exercise", "Create Workouts"];
          for (const label of actions) {
            const action = button(page, label);
            assert.ok(await action.isDisabled());
            const box = await action.boundingBox();
            const text = await action.getByText(label, { exact: true }).boundingBox();
            assert.ok(Math.abs(text.x + text.width / 2 - box.x - box.width / 2) <= 1, `${label} centers horizontally`);
            assert.ok(Math.abs(text.y + text.height / 2 - box.y - box.height / 2) <= 1, `${label} centers vertically`);
            assert.ok(box.x + box.width <= mascotBox.x, `${label} sits to Kine's left`);
          }
          if (tab === "Exercise") {
            await heading(page, "Completed exercises");
            for (const label of ["Sets", "Reps", "Weight"]) assert.ok(await page.getByText(label, { exact: true }).count() >= 1);
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

test("35 calendar dates center today and share selection across daily tabs excluding Settings", async (t) => {
  const page = await open(t, { version: 1, kind: "complete", answers: adult }, { viewport: { width: 320, height: 844 }, locale: "en-US", timezoneId: "Asia/Jerusalem", reducedMotion: "reduce" });
  await heading(page, "Calories");
  await button(page, "Expand calendar").click();
  const dateButtons = page.locator('button[aria-pressed]');
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

test("unset and maximum calorie goals keep a readable bar above macros and Kine", async (t) => {
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
    assert.ok(calorieBox.y + calorieBox.height <= rowBox.y);
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
