import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";

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
async function open(t, seed) {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
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

test("switching to a manual target clears invalid hidden estimate inputs", async (t) => {
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
  await continueTo(page, "How active are you?");
  const saved = await record(page);
  assert.equal(saved.answers.age, "");
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
