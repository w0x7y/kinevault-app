import assert from "node:assert/strict";
import test from "node:test";
import { launchBrowser } from "./helpers/browser.mjs";
import { installAccountFixture } from "./helpers/account-fixture.mjs";

const baseURL = process.env.KINE_PREVIEW_URL || "http://localhost:8081";
const profileKey = "kinevault-track.profile.v1";
const answers = {
  name: "Weight fixture",
  age: "30",
  height: "180",
  weight: "80",
  goal: "maintain",
  activity: "moderate",
  sex: "male",
  estimateEnabled: true,
  eligible: true,
  customCalories: "2200",
  customCarbs: "",
  customProtein: "125",
  customFat: "",
};
const button = (page, name) => page.getByRole("button", { name, exact: true });
const stored = async (page) =>
  JSON.parse(await page.evaluate((key) => window.accountFixture.getItem(key), profileKey));
async function open(t, previousDay = false) {
  const browser = await launchBrowser();
  t.after(() => browser.close());
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    timezoneId: "Asia/Jerusalem",
  });
  await context.addInitScript(
    ({ answers, profileKey }) => {
      if (!sessionStorage.getItem("weight-fixture")) {
        localStorage.setItem(profileKey, JSON.stringify({ version: 1, kind: "complete", answers }));
        sessionStorage.setItem("weight-fixture", "1");
      }
      const write = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (
          window.__weightWriteFailure &&
          window.accountFixture?.domainReady &&
          key.endsWith(profileKey)
        )
          throw new Error("weight write failure");
        return write.call(this, key, value);
      };
    },
    { answers, profileKey },
  );
  const account = await installAccountFixture(context);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  t.after(() => assert.deepEqual(errors, []));
  await page.clock.install({ time: new Date("2026-10-08T12:00:00+03:00") });
  await page.goto(baseURL);
  if (previousDay) {
    await button(page, "Expand calendar").click();
    await button(page, "Select previous day").click();
    await button(page, "Collapse calendar").click();
  }
  await button(page, "Profile menu").click();
  await page.getByRole("menuitem", { name: "Profile", exact: true }).click();
  await page.getByTestId("profile-weight-journal").waitFor();
  return { page, account };
}
async function log(page, date, weight) {
  await button(page, "Log weight").click();
  await page
    .getByRole("textbox", { name: "Measurement date (YYYY-MM-DD)", exact: true })
    .fill(date);
  await page.getByRole("textbox", { name: "Body weight (kg)", exact: true }).fill(weight);
  await button(page, "Save weight").click();
  await page.getByTestId(`weight-entry-${date}`).waitFor();
}

test("weight journal logs, edits, overwrites duplicate dates, reloads, and deletes with accessible calendar trend", async (t) => {
  const { page } = await open(t, true);
  const journal = page.getByTestId("profile-weight-journal");
  assert.match(await journal.innerText(), /No measurements yet/);
  await button(page, "Log weight").click();
  assert.equal(
    await page
      .getByRole("textbox", { name: "Measurement date (YYYY-MM-DD)", exact: true })
      .inputValue(),
    "2026-10-07",
  );
  await page
    .getByRole("textbox", { name: "Measurement date (YYYY-MM-DD)", exact: true })
    .fill("2026-10-08");
  await page.getByRole("textbox", { name: "Body weight (kg)", exact: true }).fill("79.5");
  await button(page, "Save weight").click();
  await page.getByTestId("weight-entry-2026-10-08").waitFor();
  await log(page, "2026-10-01", "82");
  await log(page, "2026-10-02", "81.5");
  const graph = page.getByRole("img", { name: /^Body weight trend/ });
  assert.equal(await graph.count(), 1);
  const chartLabel = await graph.getAttribute("aria-label");
  assert.match(chartLabel, /2026-10-01: 82 kg; 2026-10-02: 81.5 kg; 2026-10-08: 79.5 kg/);
  const points = await page
    .getByTestId("body-weight-trend")
    .locator("circle")
    .evaluateAll((nodes) => nodes.map((node) => Number(node.getAttribute("cx"))));
  assert.equal(points.length, 3);
  assert.ok(Math.abs((points[1] - points[0]) / (points[2] - points[0]) - 1 / 7) < 0.0001);
  await button(page, "Edit weight 2026-10-02").click();
  await page
    .getByRole("textbox", { name: "Measurement date (YYYY-MM-DD)", exact: true })
    .fill("2026-10-03");
  await page.getByRole("textbox", { name: "Body weight (kg)", exact: true }).fill("81");
  await button(page, "Save weight").click();
  await page.getByTestId("weight-entry-2026-10-03").waitFor();
  assert.equal(await page.getByTestId("weight-entry-2026-10-02").count(), 0);
  await log(page, "2026-10-03", "80.75");
  await page.waitForFunction(
    (key) =>
      JSON.parse(window.accountFixture.getItem(key)).weightEntries.some(
        (entry) => entry.kg === 80.75,
      ),
    profileKey,
  );
  assert.deepEqual((await stored(page)).weightEntries, [
    { date: "2026-10-01", kg: 82 },
    { date: "2026-10-03", kg: 80.75 },
    { date: "2026-10-08", kg: 79.5 },
  ]);
  assert.deepEqual((await stored(page)).answers, answers);
  await page.reload();
  await page.getByTestId("weight-entry-2026-10-03").waitFor();
  assert.match(await journal.innerText(), /80.75 kg/);
  await button(page, "Delete weight 2026-10-03").click();
  await button(page, "Delete measurement").click();
  await page.getByTestId("weight-entry-2026-10-03").waitFor({ state: "detached" });
  assert.equal((await stored(page)).weightEntries.length, 2);
  await page.reload();
  await page.getByTestId("weight-entry-2026-10-08").waitFor();
  assert.equal(await page.getByTestId("weight-entry-2026-10-03").count(), 0);
});

test("invalid dates and failed local saves keep drafts and saved weight history recoverable", async (t) => {
  const { page } = await open(t);
  await log(page, "2026-10-08", "80");
  await button(page, "Log weight").click();
  const date = page.getByRole("textbox", { name: "Measurement date (YYYY-MM-DD)", exact: true });
  const weight = page.getByRole("textbox", { name: "Body weight (kg)", exact: true });
  await date.fill("2026-02-29");
  await weight.fill("NaN");
  await button(page, "Save weight").click();
  await page.getByRole("alert").filter({ hasText: "Enter a valid date" }).waitFor();
  assert.equal((await stored(page)).weightEntries.length, 1);
  await date.fill("2026-10-01");
  await weight.fill("82");
  await page.evaluate(() => {
    window.__weightWriteFailure = true;
  });
  await button(page, "Save weight").click();
  await page.getByRole("alert").filter({ hasText: "Couldn't save your weight" }).waitFor();
  assert.equal(await date.inputValue(), "2026-10-01");
  assert.equal(await weight.inputValue(), "82");
  assert.deepEqual((await stored(page)).weightEntries, [{ date: "2026-10-08", kg: 80 }]);
  await page.evaluate(() => {
    window.__weightWriteFailure = false;
  });
  await button(page, "Save weight").click();
  await page.getByTestId("weight-entry-2026-10-01").waitFor();
  await button(page, "Delete weight 2026-10-01").click();
  await page.evaluate(() => {
    window.__weightWriteFailure = true;
  });
  await button(page, "Delete measurement").click();
  await page.getByRole("alert").filter({ hasText: "Couldn't delete your weight" }).waitFor();
  assert.equal((await stored(page)).weightEntries.length, 2);
  await page.evaluate(() => {
    window.__weightWriteFailure = false;
  });
  await button(page, "Delete measurement").click();
  await page.getByTestId("weight-entry-2026-10-01").waitFor({ state: "detached" });
  assert.deepEqual((await stored(page)).weightEntries, [{ date: "2026-10-08", kg: 80 }]);
});

test("body measurements log any subset, chart one measurement, edit, keep failed saves and delete", async (t) => {
  const { page } = await open(t, true);
  const journal = page.getByTestId("profile-measurement-journal");
  const field = (name) => page.getByRole("textbox", { name, exact: true });
  const row = (date) => page.getByTestId(`measurement-entry-${date}`);
  assert.match(await journal.innerText(), /No measurements yet/);
  await button(page, "Log measurements").click();
  await page.getByRole("dialog", { name: "Log measurements", exact: true }).waitFor();
  assert.equal(await field("Measurement date (YYYY-MM-DD)").inputValue(), "2026-10-07");
  await button(page, "Save measurements").click();
  await page.getByRole("alert").filter({ hasText: "Enter at least one measurement." }).waitFor();
  await field("Waist (cm)").fill("82,5");
  await field("Hips (cm)").fill("98");
  await field("Arm (cm)").fill("5");
  await button(page, "Save measurements").click();
  await page.getByRole("alert").filter({ hasText: "between 10 and 300 cm" }).waitFor();
  await field("Arm (cm)").fill("");
  await field("Measurement date (YYYY-MM-DD)").fill("2026-10-01");
  await button(page, "Save measurements").click();
  await row("2026-10-01").waitFor();
  assert.match(await row("2026-10-01").innerText(), /Waist\s82\.5\scm · Hips\s98\scm/);
  await button(page, "Log measurements").click();
  await field("Waist (cm)").fill("81");
  await field("Thigh (cm)").fill("57.5");
  await button(page, "Save measurements").click();
  await row("2026-10-07").waitFor();

  const chart = (name) => page.getByRole("img", { name: new RegExp(`^${name} trend`) });
  assert.match(
    await chart("Waist").getAttribute("aria-label"),
    /2 measurements\. 2026-10-01: 82\.5 cm; 2026-10-07: 81 cm$/,
  );
  await button(page, "Choose measurement").click();
  await button(page, "Thigh").click();
  assert.match(await chart("Thigh").getAttribute("aria-label"), /2026-10-07: 57\.5 cm$/);
  assert.match(await journal.innerText(), /57\.5\s*cm/);

  // The selected day already has measurements, so Log opens them instead of replacing them.
  await button(page, "Log measurements").click();
  await page.getByRole("dialog", { name: "Edit measurements", exact: true }).waitFor();
  assert.equal(await field("Waist (cm)").inputValue(), "81");
  await field("Arm (cm)").fill("34");
  await button(page, "Save measurements").click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  assert.match(
    await row("2026-10-07").innerText(),
    /Waist\s81\scm · Arm\s34\scm · Thigh\s57\.5\scm/,
  );
  const saved = await stored(page);
  assert.deepEqual(saved.bodyMeasurements, [
    { date: "2026-10-01", cm: { waist: 82.5, hips: 98 } },
    { date: "2026-10-07", cm: { waist: 81, arm: 34, thigh: 57.5 } },
  ]);
  assert.deepEqual(saved.answers, answers);
  assert.equal(saved.weightEntries, undefined);

  await button(page, "Edit measurements 2026-10-01").click();
  await field("Chest (cm)").fill("101");
  await page.evaluate(() => {
    window.__weightWriteFailure = true;
  });
  await button(page, "Save measurements").click();
  await page.getByRole("alert").filter({ hasText: "Couldn't save your measurements" }).waitFor();
  assert.equal(await field("Chest (cm)").inputValue(), "101");
  assert.deepEqual((await stored(page)).bodyMeasurements, saved.bodyMeasurements);
  await page.evaluate(() => {
    window.__weightWriteFailure = false;
  });
  await button(page, "Save measurements").click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  assert.match(
    await row("2026-10-01").innerText(),
    /Waist\s82\.5\scm · Chest\s101\scm · Hips\s98\scm/,
  );

  await page.reload();
  await row("2026-10-01").waitFor();
  await button(page, "Delete measurements 2026-10-01").click();
  await button(page, "Delete measurements").click();
  await row("2026-10-01").waitFor({ state: "detached" });
  assert.deepEqual((await stored(page)).bodyMeasurements, [
    { date: "2026-10-07", cm: { waist: 81, arm: 34, thigh: 57.5 } },
  ]);
  assert.match(
    await chart("Waist").getAttribute("aria-label"),
    /1 measurements\. 2026-10-07: 81 cm$/,
  );
});
