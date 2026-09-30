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
      ({ key, seed }) => localStorage.setItem(key, JSON.stringify(seed)),
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

test("switching to a manual target keeps age visible and enforces 16+", async (t) => {
  const page = await open(t, {
    version: 1,
    kind: "draft",
    step: "body",
    answers: { ...adult, age: "0" },
  });
  await heading(page, "A little about you");
  await page
    .getByRole("radio", { name: "Skip the estimate", exact: true })
    .click();
  await button(page, "Continue").click();
  await page
    .getByText("Enter age between 16 and 100 years in whole years.", {
      exact: true,
    })
    .waitFor();
  await page
    .getByRole("textbox", { name: "Age (years)", exact: true })
    .fill("16");
  await continueTo(page, "How active are you?");
  const saved = await record(page);
  assert.equal(saved.answers.age, "16");
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
  await page
    .getByRole("textbox", { name: "Age (years)", exact: true })
    .fill("30");
  await button(page, "Let's go").click();
  await heading(page, "What should I call you?");
  await page
    .getByRole("textbox", { name: "Your name (optional)", exact: true })
    .fill("Alex");
  await continueTo(page, "What's your goal?");
  await page.getByRole("radio", { name: "Lose weight", exact: true }).click();
  await continueTo(page, "A little about you");
  await page
    .getByRole("radio", { name: "Use the standard estimate", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Age (years)", exact: true })
    .fill("30");
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
  await heading(page, "Today");
  await page.reload();
  await heading(page, "Today");
  await page.getByRole("tab", { name: /Settings/ }).click();
  await heading(page, "Settings");
  const original = await record(page);
  await page.getByRole("link", { name: /Edit profile/ }).click();
  await heading(page, "What should I call you?");
  await page
    .getByRole("textbox", { name: "Your name (optional)", exact: true })
    .fill("Canceled edit");
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
  const age = page.getByRole("textbox", { name: "Age (years)", exact: true });
  await age.fill("15");
  for (const label of ["Set up later", "Let's go"]) {
    await button(page, label).click();
    await page
      .getByText("Enter age between 16 and 100 years in whole years.", {
        exact: true,
      })
      .waitFor();
    assert.equal(await button(page, "Let's go").count(), 1);
  }
  await age.fill("16");
  await button(page, "Let's go").click();
  await heading(page, "What should I call you?");
  await continueTo(page, "What's your goal?");
  await page.getByRole("radio", { name: "Lose weight", exact: true }).click();
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
  await heading(page, "Today");
  const saved = await record(page);
  assert.equal(saved.kind, "complete");
  assert.equal(saved.answers.age, "16");
  assert.equal(saved.answers.estimateEnabled, false);
  assert.equal(saved.answers.customCalories, "");
});

test("each page has a distinct loaded Kine pose and fits phone and desktop widths", async (t) => {
  const page = await open(t);
  const failures = [];
  page.on("pageerror", (error) => failures.push(error.message));
  const screenshotDir = process.env.KINE_SCREENSHOT_DIR;
  if (screenshotDir) await mkdir(screenshotDir, { recursive: true });
  const steps = [
    ["welcome", "Hi, I'm Kine."],
    ["name", "What should I call you?"],
    ["goal", "What's your goal?"],
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
    sources.add(source);
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
  await heading(page, "Today");
  await inspect("today", 390);
  for (const [pose, title] of [
    ["food", "Food"],
    ["exercise", "Exercise"],
    ["settings", "Settings"],
  ]) {
    await page.getByRole("tab", { name: new RegExp(title) }).click();
    await heading(page, title);
    await inspect(pose, 390);
    await inspect(pose, 320);
  }
  assert.equal(sources.size, 11);
  assert.deepEqual(failures, []);
});

test("reduced motion keeps Kine still, including when the preference changes", async (t) => {
  const page = await open(
    t,
    { version: 1, kind: "complete", answers: adult },
    { reducedMotion: "reduce" },
  );
  await heading(page, "Today");
  const stillFrames = await page
    .getByTestId("kine-today")
    .evaluate(async (element) => {
      const values = [];
      for (let frame = 0; frame < 12; frame++) {
        await new Promise(requestAnimationFrame);
        values.push(getComputedStyle(element).transform);
      }
      return values;
    });
  assert.equal(new Set(stillFrames).size, 1);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.getByRole("tab", { name: /Food/ }).click();
  await heading(page, "Food");
  const movingFrames = await page
    .getByTestId("kine-food")
    .evaluate(async (element) => {
      const values = [];
      for (let frame = 0; frame < 12; frame++) {
        await new Promise(requestAnimationFrame);
        values.push(getComputedStyle(element).transform);
      }
      return values;
    });
  assert.ok(
    new Set(movingFrames).size > 1,
    "Kine should greet when motion is enabled",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  const box = page.getByTestId("kine-food");
  await page.waitForFunction(() => {
    const element = document.querySelector('[data-testid="kine-food"]');
    return (
      element &&
      [
        "none",
        "matrix(1, 0, 0, 1, 0, 0)",
        "translateY(0px) rotate(0deg) scale(1)",
      ].includes(getComputedStyle(element).transform)
    );
  });
  assert.ok(await box.isVisible());
});
