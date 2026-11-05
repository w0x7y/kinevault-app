import assert from "node:assert/strict";
import test from "node:test";
import { installAccountFixture } from "./helpers/account-fixture.mjs";
import { launchBrowser } from "./helpers/browser.mjs";

const baseURL = process.env.KINE_PREVIEW_URL || "http://localhost:8081";
const fixturePath =
  "/tests/health-settings-fixture.bundle?platform=web&dev=true&hot=false&minify=false";
const answers = {
  name: "Settings fixture",
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
const button = (page, name) => page.getByRole("button", { name, exact: true });
// Saved IDs start with this account's random tag on the device.
const expectSaved = ({ saves }) => assert.match(saves.join(" "), /^[^/\s]+\/weight:2026-10-01$/);

/** The Health settings group over a fake Health Connect, which the web preview can't show. */
async function openFixture(t, setup = {}) {
  const browser = await launchBrowser();
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 320, height: 844 } });
  if (process.env.KINE_DEV_PREVIEW_URL) {
    await page.route("**/tests/health-settings-fixture.bundle?*", async (route) => {
      const response = await route.fetch({
        url: new URL(fixturePath, process.env.KINE_DEV_PREVIEW_URL).href,
      });
      await route.fulfill({ response });
    });
    // The dev bundle's icon fonts are Metro assets the static preview doesn't serve.
    await page.route(/\/assets\/\?unstable_path=/, async (route) => {
      const { pathname, search } = new URL(route.request().url());
      const response = await route.fetch({
        url: new URL(pathname + search, process.env.KINE_DEV_PREVIEW_URL).href,
      });
      await route.fulfill({ response });
    });
  }
  await page.route("**/__test-health-settings", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html><body style="margin:0"><div id="root"></div><script src="${fixturePath}"></script></body></html>`,
    }),
  );
  await page.addInitScript((setup) => {
    window.healthFixture = {
      enabled: false,
      access: "undetermined",
      answer: "granted",
      failSave: false,
      failSetting: false,
      saves: [],
      settingsOpened: 0,
      ...setup,
    };
  }, setup);
  await page.goto(`${baseURL}/__test-health-settings`);
  const toggle = page.getByRole("switch", { name: "Save to Health Connect", exact: true });
  await toggle.waitFor();
  return { page, toggle, fixture: () => page.evaluate(() => window.healthFixture) };
}

test("the web preview's Settings has no health option", async (t) => {
  const browser = await launchBrowser();
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 320, height: 844 } });
  await context.addInitScript((answers) => {
    if (sessionStorage.getItem("health-fixture-seeded")) return;
    localStorage.setItem(
      "kinevault-track.profile.v1",
      JSON.stringify({ version: 1, kind: "complete", answers }),
    );
    sessionStorage.setItem("health-fixture-seeded", "true");
  }, answers);
  await installAccountFixture(context);
  const page = await context.newPage();
  await page.goto(baseURL);
  await page.getByTestId("home-water").waitFor();
  await page.getByRole("tab", { name: "Settings", exact: true }).click();
  const heading = (name) => page.getByRole("heading", { name, exact: true });
  await heading("Appearance").waitFor();
  assert.equal(await heading("Health").count(), 0);
  assert.equal(await page.getByRole("switch").count(), 0);
});

test("turning it on asks for access; a refusal offers the settings, and access granted there saves", async (t) => {
  const { page, toggle, fixture } = await openFixture(t, { answer: "denied" });
  assert.equal(await toggle.getAttribute("aria-checked"), "false");
  await page
    .getByText("Completed workouts, body weight and daily water", { exact: true })
    .waitFor();
  await toggle.click();
  await page.getByText("Access to Health Connect is off.", { exact: true }).waitFor();
  assert.equal(await toggle.getAttribute("aria-checked"), "true");
  assert.deepEqual((await fixture()).saves, []);
  await button(page, "Open settings").click();
  assert.equal((await fixture()).settingsOpened, 1);
  await page.evaluate(() => {
    window.healthFixture.access = "granted";
    return window.refreshHealth();
  });
  await page.getByText("Access to Health Connect is off.").waitFor({ state: "detached" });
  await page.waitForFunction(() => window.healthFixture.saves.length === 1);
  expectSaved(await fixture());
});

test("an unasked device offers Allow access, which saves", async (t) => {
  const { page, toggle, fixture } = await openFixture(t, { enabled: true });
  assert.equal(await toggle.getAttribute("aria-checked"), "true");
  await page.getByText("Not connected", { exact: true }).waitFor();
  await button(page, "Allow access").click();
  await page.waitForFunction(() => window.healthFixture.saves.length === 1);
  await page.getByText("Not connected").waitFor({ state: "detached" });
  expectSaved(await fixture());
});

test("a failed save says so and Try again saves it; a failed setting save keeps the switch", async (t) => {
  const { page, toggle, fixture } = await openFixture(t, { access: "granted", failSave: true });
  await toggle.click();
  await page.getByText("Couldn't save to Health Connect.", { exact: true }).waitFor();
  await page.evaluate(() => (window.healthFixture.failSave = false));
  await button(page, "Try again").click();
  await page.getByText("Couldn't save to Health Connect.").waitFor({ state: "detached" });
  expectSaved(await fixture());
  await page.evaluate(() => (window.healthFixture.failSetting = true));
  await toggle.click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Couldn't save this setting. Try again." })
    .waitFor();
  assert.equal(await toggle.getAttribute("aria-checked"), "true");
});
