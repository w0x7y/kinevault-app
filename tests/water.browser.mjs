import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";

const baseURL = process.env.KINE_PREVIEW_URL || "http://localhost:8081";
const storageKey = "kinevault-track.water-log.v1";
const answers = { name: "Water fixture", goal: "maintain", activity: "moderate", age: "30", height: "180", weight: "80",
  sex: "male", estimateEnabled: true, eligible: true, customCalories: "" };
const button = (page, name) => page.getByRole("button", { name, exact: true });
const dialog = page => page.getByRole("dialog", { name: "Edit water", exact: true });
const field = page => dialog(page).getByRole("textbox", { name: "Manual water (ml)", exact: true });
const stored = page => page.evaluate(key => localStorage.getItem(key), storageKey);

async function open(t, { water = null, readFailure = false, delayedRead = false } = {}) {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  // This fresh context never shares the user's preview storage.
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Asia/Jerusalem" });
  await context.addInitScript(({ answers, storageKey, water, readFailure, delayedRead }) => {
    if (!sessionStorage.getItem("water-fixture-seeded")) {
      localStorage.setItem("kinevault-track.profile.v1", JSON.stringify({ version: 1, kind: "complete", answers }));
      if (water !== null) localStorage.setItem(storageKey, water);
      sessionStorage.setItem("water-fixture-seeded", "true");
    }
    window.__waterReadFailure = readFailure;
    let delayRead = delayedRead;
    const getItem = Storage.prototype.getItem;
    Storage.prototype.getItem = function(key) {
      if (key === storageKey && window.__waterReadFailure) throw new Error("Fixture read failure");
      if (key === storageKey && delayRead) {
        delayRead = false;
        return new Promise(resolve => { window.__releaseWaterRead = () => resolve(getItem.call(this, key)); });
      }
      return getItem.call(this, key);
    };
  }, { answers, storageKey, water, readFailure, delayedRead });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  await page.clock.install({ time: new Date("2026-10-01T12:00:00+03:00") });
  await page.goto(baseURL);
  await page.getByTestId("home-water").waitFor();
  return page;
}
async function enter(page) {
  await page.getByTestId("home-water").click();
  await field(page).waitFor();
}
async function save(page) {
  await button(dialog(page), "Save water").click();
  await dialog(page).waitFor({ state: "detached" });
}

test("water adjustment controls edit the draft in 250 ml steps without writing before save", async t => {
  const initial = JSON.stringify({ version: 1, days: { "2026-10-01": 500 } });
  const page = await open(t, { water: initial });
  await enter(page);
  const plus = button(dialog(page), "+250 ml");
  const minus = button(dialog(page), "-250 ml");
  assert.equal(await field(page).inputValue(), "500");
  await plus.click();
  assert.equal(await field(page).inputValue(), "750");
  // A burst before React renders must use each preceding draft update.
  await plus.evaluate(element => { element.click(); element.click(); });
  assert.equal(await field(page).inputValue(), "1250");
  await minus.click();
  assert.equal(await field(page).inputValue(), "1000");
  await field(page).fill("600");
  await plus.click();
  assert.equal(await field(page).inputValue(), "850");
  await minus.click();
  assert.equal(await field(page).inputValue(), "600");
  for (const value of ["", "100", "0"]) {
    await field(page).fill(value);
    await minus.click();
    assert.equal(await field(page).inputValue(), "0");
  }
  await field(page).fill("9900");
  await plus.click();
  assert.equal(await field(page).inputValue(), "10150");
  await field(page).fill(String(Number.MAX_SAFE_INTEGER - 100));
  await plus.click();
  assert.equal(await field(page).inputValue(), String(Number.MAX_SAFE_INTEGER));
  await plus.click();
  assert.equal(await field(page).inputValue(), String(Number.MAX_SAFE_INTEGER));
  await minus.click();
  assert.equal(await field(page).inputValue(), String(Number.MAX_SAFE_INTEGER - 250));
  for (const value of ["bad", "1.5", "-5", "Infinity", "9".repeat(400)]) {
    await field(page).fill(value);
    await button(dialog(page), "Save water").click();
    await dialog(page).getByRole("alert").waitFor();
    await plus.click();
    assert.equal(await field(page).inputValue(), "250");
    assert.equal(await dialog(page).getByRole("alert").count(), 0);
    await field(page).fill(value);
    await minus.click();
    assert.equal(await field(page).inputValue(), "0");
  }
  assert.equal(await stored(page), initial);
  await button(dialog(page), "Cancel").click();
  assert.equal(await stored(page), initial);
  await enter(page);
  assert.equal(await field(page).inputValue(), "500");
  await plus.click();
  await plus.click();
  await minus.click();
  await save(page);
  assert.equal(JSON.parse(await stored(page)).days["2026-10-01"], 750);
});

test("the entire water widget opens direct entry, cancel/invalid values never write, and totals persist per selected date", async t => {
  const page = await open(t);
  const water = page.getByTestId("home-water");
  assert.equal(await water.getAttribute("role"), "button");
  assert.match(await water.getAttribute("aria-label"), /^Add water/);
  await water.getByRole("heading", { name: "Water", exact: true }).waitFor();
  // Use the edge of the widget so the whole tile's hit target is checked.
  await water.click({ position: { x: 5, y: 5 } });
  await dialog(page).getByText("For 2026-10-01", { exact: true }).waitFor();
  await field(page).fill("250");
  await button(dialog(page), "Cancel").click();
  assert.equal(await stored(page), null);
  await enter(page);
  assert.equal(await field(page).inputValue(), "0");
  for (const amount of ["", "-5", "1.5", String(Number.MAX_SAFE_INTEGER + 1)]) {
    await field(page).fill(amount);
    await button(dialog(page), "Save water").click();
    await dialog(page).getByRole("alert").waitFor();
    assert.equal(await stored(page), null);
  }
  await field(page).fill("");
  await button(dialog(page), "+250 ml").click();
  assert.equal(await field(page).inputValue(), "250");
  await save(page);
  assert.match(await water.innerText(), /0\.25/);
  await enter(page);
  await button(dialog(page), "+250 ml").click();
  await button(dialog(page), "+250 ml").click();
  await save(page);
  assert.deepEqual(JSON.parse(await stored(page)), { version: 1, days: { "2026-10-01": 750 } });
  assert.match(await water.innerText(), /0\.75/);
  await page.reload();
  await water.waitFor();
  assert.match(await water.innerText(), /0\.75/);
  await button(page, "Expand calendar").click();
  await button(page, "Select previous day").click();
  await button(page, "Collapse calendar").click();
  await enter(page);
  await dialog(page).getByText("For 2026-09-30", { exact: true }).waitFor();
  await field(page).fill("300");
  await save(page);
  assert.deepEqual(JSON.parse(await stored(page)).days, { "2026-10-01": 750, "2026-09-30": 300 });
  assert.match(await water.innerText(), /0\.3/);
  await button(page, "Expand calendar").click();
  await button(page, "Select today").click();
  await button(page, "Collapse calendar").click();
  assert.match(await water.innerText(), /0\.75/);
  assert.equal(await page.evaluate(() => localStorage.getItem("kinevault-track.food-log.v1")), null);
});

test("failed water save preserves the amount and previous total for one successful retry", async t => {
  const page = await open(t, { water: JSON.stringify({ version: 1, days: { "2026-10-01": 250 } }) });
  await enter(page);
  await field(page).fill("500");
  await page.evaluate(key => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(nextKey, value) {
      if (nextKey === key) { Storage.prototype.setItem = setItem; throw new Error("Fixture write failure"); }
      return setItem.call(this, nextKey, value);
    };
  }, storageKey);
  await button(dialog(page), "Save water").click();
  await dialog(page).getByRole("alert").filter({ hasText: "Couldn't save" }).waitFor();
  assert.equal(await field(page).inputValue(), "500");
  assert.equal(JSON.parse(await stored(page)).days["2026-10-01"], 250);
  await save(page);
  assert.equal(JSON.parse(await stored(page)).days["2026-10-01"], 500);
  assert.match(await page.getByTestId("home-water").innerText(), /0\.5/);
});

test("water read errors and corruption keep Home available and never replace saved data before recovery", async t => {
  for (const readFailure of [true, false]) {
    const initial = readFailure ? JSON.stringify({ version: 1, days: { "2026-10-01": 500 } }) : "corrupt";
    const page = await open(t, { water: initial, readFailure });
    await page.getByTestId("home-water").getByText("tap to retry", { exact: true }).waitFor();
    await page.getByTestId("home-nutrition-row").waitFor();
    await enter(page);
    await dialog(page).getByRole("alert").filter({ hasText: "Couldn't load" }).waitFor();
    assert.equal(await button(dialog(page), "Save water").isDisabled(), true);
    assert.equal(await field(page).inputValue(), "");
    await field(page).fill("250");
    await page.evaluate(({ key, readFailure }) => {
      window.__waterReadFailure = false;
      if (!readFailure) {
        if (localStorage.getItem(key) !== "corrupt") throw new Error("Corrupt log was overwritten");
        localStorage.setItem(key, JSON.stringify({ version: 1, days: { "2026-10-01": 500 } }));
      }
    }, { key: storageKey, readFailure });
    assert.equal(JSON.parse(await stored(page)).days["2026-10-01"], 500);
    await button(dialog(page), "Retry water log").click();
    await button(dialog(page), "Save water").waitFor({ state: "visible" });
    await page.waitForFunction(() => document.querySelector('[data-testid="water-entry"] [aria-label="Save water"]').getAttribute("aria-disabled") !== "true");
    assert.equal(await field(page).inputValue(), "250");
    await save(page);
    assert.equal(JSON.parse(await stored(page)).days["2026-10-01"], 250);
  }
});

test("a selected-day change closes the old draft and preloads the manual total for the new date", async t => {
  const initial = JSON.stringify({ version: 1, days: { "2026-10-01": 1000, "2026-09-30": 300 } });
  const page = await open(t, { water: initial });
  await button(page, "Expand calendar").click();
  // The calendar can cover the tile while expanded; dispatch the tile's existing click action.
  await page.getByTestId("home-water").evaluate(element => element.click());
  await field(page).fill("500");
  // Exercise an external day change while the modal is open, such as a midnight/calendar event.
  await page.locator('[aria-label="Select previous day"]').evaluate(element => element.click());
  await dialog(page).waitFor({ state: "detached" });
  assert.equal(await stored(page), initial);
  await button(page, "Collapse calendar").click();
  await enter(page);
  assert.equal(await field(page).inputValue(), "300");
  await dialog(page).getByText("For 2026-09-30", { exact: true }).waitFor();
  await button(dialog(page), "Cancel").click();
  assert.equal(await stored(page), initial);
});

test("a pending water read can be retried without inventing a zero total or losing the entered amount", async t => {
  const page = await open(t, { water: JSON.stringify({ version: 1, days: { "2026-10-01": 500 } }), delayedRead: true });
  await page.getByTestId("home-water").getByText("loading...", { exact: true }).waitFor();
  await page.getByTestId("home-nutrition-row").waitFor();
  await enter(page);
  const loading = dialog(page).getByRole("progressbar", { name: "Loading water log...", exact: true });
  await loading.waitFor();
  await loading.locator("img").evaluate(image => image.decode());
  assert.equal(await loading.getAttribute("aria-busy"), "true");
  assert.equal(await loading.innerText(), "");
  assert.equal(await button(dialog(page), "Save water").isDisabled(), true);
  await field(page).fill("250");
  await button(dialog(page), "Retry water log").click();
  await loading.waitFor({ state: "detached" });
  assert.equal(await field(page).inputValue(), "250");
  await save(page);
  assert.equal(JSON.parse(await stored(page)).days["2026-10-01"], 250);
  await page.evaluate(() => window.__releaseWaterRead());
  assert.match(await page.getByTestId("home-water").innerText(), /0\.25/);
});

test("duplicate save taps stay blocked and a pending save targets its original date after a day change", async t => {
  const page = await open(t);
  await button(page, "Expand calendar").click();
  await page.getByTestId("home-water").evaluate(element => element.click());
  await field(page).fill("500");
  await page.evaluate(key => {
    const setItem = Storage.prototype.setItem;
    window.__waterWriteCalls = 0;
    Storage.prototype.setItem = function(nextKey, value) {
      if (nextKey !== key) return setItem.call(this, nextKey, value);
      window.__waterWriteCalls++;
      return new Promise(resolve => {
        window.__releaseWaterWrite = () => {
          Storage.prototype.setItem = setItem;
          setItem.call(this, nextKey, value);
          resolve();
        };
      });
    };
  }, storageKey);
  // Dispatch a burst in one browser task, before React can rerender disabled controls.
  await button(dialog(page), "Save water").evaluate(element => { element.click(); element.click(); element.click(); });
  assert.equal(await button(dialog(page), "Save water").isDisabled(), true);
  assert.equal(await button(dialog(page), "+250 ml").isDisabled(), true);
  assert.equal(await button(dialog(page), "-250 ml").isDisabled(), true);
  assert.equal(await field(page).inputValue(), "500");
  assert.equal(await page.evaluate(() => window.__waterWriteCalls), 1);
  assert.equal(await stored(page), null);
  await page.locator('[aria-label="Select previous day"]').evaluate(element => element.click());
  await dialog(page).waitFor({ state: "detached" });
  await button(page, "Collapse calendar").click();
  await enter(page);
  await dialog(page).getByText("For 2026-09-30", { exact: true }).waitFor();
  assert.equal(await field(page).inputValue(), "0");
  assert.equal(await button(dialog(page), "Save water").isDisabled(), true);
  await page.evaluate(() => window.__releaseWaterWrite());
  await page.waitForFunction(() => document.querySelector('[data-testid="water-entry"] [aria-label="Save water"]').getAttribute("aria-disabled") !== "true");
  // The old form's save completion must not dismiss the newly opened form.
  await dialog(page).getByText("For 2026-09-30", { exact: true }).waitFor();
  assert.deepEqual(JSON.parse(await stored(page)).days, { "2026-10-01": 500 });
  await button(dialog(page), "Cancel").click();
});

test("reopening water preloads the manual total and a lower value replaces it, including zero", async t => {
  const page = await open(t, { water: JSON.stringify({ version: 1, days: { "2026-10-01": 1000, "2026-09-30": 300 } }) });
  await enter(page);
  assert.equal(await field(page).inputValue(), "1000");
  await field(page).fill("750");
  await save(page);
  assert.deepEqual(JSON.parse(await stored(page)).days, { "2026-10-01": 750, "2026-09-30": 300 });
  await enter(page);
  assert.equal(await field(page).inputValue(), "750");
  await field(page).fill("0");
  await save(page);
  assert.deepEqual(JSON.parse(await stored(page)).days, { "2026-10-01": 0, "2026-09-30": 300 });
  await page.reload();
  await enter(page);
  assert.equal(await field(page).inputValue(), "0");
});


test("loaded legacy manual totals remain intact on reopening and unchanged save", async t => {
  const initial = JSON.stringify({ version: 1, days: { "2026-10-01": 12500 } });
  const page = await open(t, { water: initial });
  await enter(page);
  assert.equal(await field(page).inputValue(), "12500");
  await button(dialog(page), "Cancel").click();
  assert.equal(await stored(page), initial);
  await enter(page);
  await save(page);
  assert.equal(await stored(page), initial);
});

test("an untouched loading draft preloads the durable manual total only once after recovery", async t => {
  const initial = JSON.stringify({ version: 1, days: { "2026-10-01": 1000 } });
  const page = await open(t, { water: initial, delayedRead: true });
  await enter(page);
  assert.equal(await field(page).inputValue(), "");
  assert.equal(await button(dialog(page), "Save water").isDisabled(), true);
  await button(dialog(page), "Retry water log").click();
  await page.waitForFunction(() => document.querySelector('[data-testid="water-entry"] input').value === "1000");
  await field(page).fill("750");
  await page.evaluate(() => window.__releaseWaterRead());
  assert.equal(await field(page).inputValue(), "750");
  assert.equal(await stored(page), initial);
  await save(page);
  assert.equal(JSON.parse(await stored(page)).days["2026-10-01"], 750);
});
