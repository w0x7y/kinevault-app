import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { chromium } from "playwright";
import {
  fixtureAuthKey,
  fixtureEmail,
  fixturePassword,
  fixtureUserId,
  installAccountFixture,
} from "./helpers/account-fixture.mjs";

const baseURL = process.env.KINE_PREVIEW_URL || "http://localhost:8081";
const profileKey = "kinevault-track.profile.v1";
const waterKey = "kinevault-track.water-log.v1";
const foodKey = "kinevault-track.food-log.v1";
const goalKey = "kinevault-track.water-goal.v1";
const ownerPrefix = `kinevault-track.account.${fixtureUserId}.`;
const otherPrefix = "kinevault-track.account.22222222-2222-4222-8222-222222222222.";
const profile = {
  version: 1,
  kind: "complete",
  answers: {
    name: "Settings fixture",
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
  },
  weightEntries: [
    { date: "2026-10-01", kg: 82 },
    { date: "2026-10-08", kg: 79.5 },
  ],
};
const water = { version: 1, days: { "2026-10-08": 1750 } };
const food = { version: 1, days: { "2026-10-08": [] } };
const goal = { version: 1, dailyMl: 2600 };
const preserved = {
  "kinevault-track.appearance": "light",
  [`${otherPrefix}${profileKey}`]: JSON.stringify({
    version: 1,
    payload: JSON.stringify({ ...profile, answers: { ...profile.answers, name: "Other owner" } }),
    revision: 0,
    dirty: true,
    sequence: 1,
  }),
  [`${otherPrefix}${waterKey}.partition.v2.2026-10.fixture`]: "other-owner-fragment",
  [`${otherPrefix}kinevault-track.profile-media.v1`]: JSON.stringify({
    version: 1,
    avatar: null,
    photos: [],
  }),
};
const button = (page, name) => page.getByRole("button", { name, exact: true });

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function settings(page) {
  await page.getByRole("tab", { name: "Settings", exact: true }).click();
  await page.getByRole("heading", { name: "Your account", exact: true }).waitFor();
  await page.getByText("All changes saved to your account.", { exact: true }).waitFor();
}

async function open(t) {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    timezoneId: "Asia/Jerusalem",
    acceptDownloads: true,
  });
  await context.addInitScript(
    ({
      profileKey,
      waterKey,
      foodKey,
      goalKey,
      profile,
      water,
      food,
      goal,
      preserved,
      ownerPrefix,
    }) => {
      if (sessionStorage.getItem("settings-fixture-seeded")) return;
      localStorage.setItem(profileKey, JSON.stringify(profile));
      localStorage.setItem(waterKey, JSON.stringify(water));
      localStorage.setItem(foodKey, JSON.stringify(food));
      localStorage.setItem(goalKey, JSON.stringify(goal));
      localStorage.setItem(`${ownerPrefix}recovery-test.v1`, "owned-recovery-record");
      for (const [key, value] of Object.entries(preserved)) localStorage.setItem(key, value);
      sessionStorage.setItem("settings-fixture-seeded", "1");
    },
    { profileKey, waterKey, foodKey, goalKey, profile, water, food, goal, preserved, ownerPrefix },
  );
  const account = await installAccountFixture(context);
  const deletion = [0, 1].map(() => ({ started: deferred(), response: deferred() }));
  t.after(() => deletion.forEach((attempt) => attempt.response.resolve()));
  const deletionRequests = [];
  // Playwright uses the last registered matching route first. Install this after
  // the account fixture so every other Supabase request remains synthetic too.
  await context.route(
    "https://kkywpvkckxniriatelta.supabase.co/functions/v1/delete-account",
    async (route) => {
      const index = deletionRequests.length;
      deletionRequests.push({
        method: route.request().method(),
        body: route.request().postDataJSON(),
        authorization: route.request().headers().authorization,
      });
      assert.ok(index < deletion.length, "Deletion must require an explicit UI retry");
      deletion[index].started.resolve();
      await deletion[index].response.promise;
      await route.fulfill({
        status: index === 0 ? 403 : 200,
        contentType: "application/json",
        body: JSON.stringify(
          index === 0 ? { error: "Password verification failed" } : { deleted: true },
        ),
      });
    },
  );
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, []));
  await page.goto(baseURL);
  await settings(page);
  // Seed a real partitioned history cache through the shared browser codec;
  // reload lets the providers restore and sync its logical document normally.
  await page.evaluate(
    ({ foodKey, food }) => window.accountFixture.setItem(foodKey, JSON.stringify(food)),
    { foodKey, food },
  );
  await page.reload();
  await page.getByRole("heading", { name: "Your account", exact: true }).waitFor();
  await page.getByText("All changes saved to your account.", { exact: true }).waitFor();
  await page.getByText(fixtureEmail, { exact: true }).waitFor();
  return { page, account, deletion, deletionRequests };
}

async function records(page) {
  return page.evaluate(
    ({ profileKey, waterKey, foodKey, goalKey, ownerPrefix, preserved, authKey }) => ({
      profile: JSON.parse(window.accountFixture.getItem(profileKey)),
      water: JSON.parse(window.accountFixture.getItem(waterKey)),
      food: JSON.parse(window.accountFixture.getItem(foodKey)),
      goal: JSON.parse(window.accountFixture.getItem(goalKey)),
      owned: Object.fromEntries(
        Object.entries(localStorage)
          .filter(([key]) => key.startsWith(ownerPrefix))
          .map(([key, raw]) => {
            try {
              const value = JSON.parse(raw);
              if (value?.historyFormat === 2) {
                // Retry sync may republish an identical cache under a new
                // generation; records, references and sync metadata must stay.
                delete value.generation;
                return [key, value];
              }
            } catch {
              // Recovery records need not contain JSON.
            }
            return [key, raw];
          }),
      ),
      preserved: Object.fromEntries(
        Object.keys(preserved).map((key) => [key, localStorage.getItem(key)]),
      ),
      auth: localStorage.getItem(authKey),
    }),
    { profileKey, waterKey, foodKey, goalKey, ownerPrefix, preserved, authKey: fixtureAuthKey },
  );
}

test("Settings exports downloaded logical account JSON with weight history and no auth credentials", async (t) => {
  const { page, account, deletionRequests } = await open(t);
  const before = await records(page);
  const downloading = page.waitForEvent("download");
  await button(page, "Export account data").click();
  const download = await downloading;
  assert.match(download.suggestedFilename(), /^kinevault-export-\d{4}-\d{2}-\d{2}\.json$/);
  const contents = await readFile(await download.path(), "utf8");
  const exported = JSON.parse(contents);
  assert.equal(exported.format, "kinevault-track-account-export");
  assert.equal(exported.version, 1);
  assert.equal(exported.ownerId, fixtureUserId);
  assert.equal(exported.cloudStatus, "included");
  assert.ok(Number.isFinite(Date.parse(exported.exportedAt)));
  assert.deepEqual(
    exported.documents.map(({ key }) => key).sort(),
    [
      "kinevault-track.custom-foods.v1",
      "kinevault-track.exercise.v1",
      "kinevault-track.food-log.v1",
      profileKey,
      goalKey,
      waterKey,
    ].sort(),
  );
  for (const [key, data] of [
    [profileKey, profile],
    [waterKey, water],
    [foodKey, food],
    [goalKey, goal],
  ]) {
    const document = exported.documents.find((entry) => entry.key === key);
    assert.deepEqual(document.local.data, data);
    assert.deepEqual(document.cloud.data, data);
    assert.equal(document.local.pending, false);
    assert.equal(document.cloud.source, "cloud-export");
  }
  assert.doesNotMatch(
    contents,
    /access_token|refresh_token|browser-fixture|historyFormat|partition\.v2|Other owner/,
  );
  for (const secret of [
    account.session.access_token,
    account.session.refresh_token,
    fixturePassword,
  ])
    assert.equal(contents.includes(secret), false);
  await page
    .getByText("Export prepared with your device data, cloud copies and photos.", { exact: true })
    .waitFor();
  assert.equal(new URL(page.url()).pathname, "/settings");
  assert.deepEqual(await records(page), before);
  assert.deepEqual(deletionRequests, []);
});

test("Settings gates deletion, clears submitted passwords, preserves failed data and retries scoped cleanup", async (t) => {
  const { page, account, deletion, deletionRequests } = await open(t);
  const before = await records(page);
  assert.deepEqual(before.profile, profile);
  assert.deepEqual(before.water, water);
  assert.deepEqual(before.goal, goal);
  assert.deepEqual(before.preserved, preserved);
  assert.ok(before.auth);
  assert.ok(
    Object.keys(before.owned).some((key) => key.includes(".partition.v2.")),
    JSON.stringify(Object.keys(before.owned)),
  );
  await button(page, "Delete account").click();
  const password = page.getByLabel("Current password", { exact: true });
  const confirmation = page.getByLabel("Type DELETE to confirm", { exact: true });
  const submit = button(page, "Permanently delete my account");
  assert.equal(await password.getAttribute("type"), "password");
  assert.equal(await submit.isDisabled(), true);
  await password.fill("wrong-password");
  assert.equal(await submit.isDisabled(), true);
  await confirmation.fill("delete");
  assert.equal(await submit.isDisabled(), true);
  await confirmation.fill("DELETE");
  await password.fill("");
  assert.equal(await submit.isDisabled(), true);
  assert.deepEqual(deletionRequests, []);

  await password.fill("wrong-password");
  assert.equal(await submit.isEnabled(), true);
  await Promise.all([submit.click(), deletion[0].started.promise]);
  assert.equal(await password.inputValue(), "");
  assert.equal(await password.isEditable(), false);
  assert.equal(await button(page, "Deleting account…").isDisabled(), true);
  assert.deepEqual(deletionRequests[0], {
    method: "POST",
    body: { password: "wrong-password", confirmation: "DELETE" },
    authorization: `Bearer ${account.session.access_token}`,
  });
  deletion[0].response.resolve();
  await page.getByRole("alert").filter({ hasText: "Your local data has been kept." }).waitFor();
  await page.getByText("All changes saved to your account.", { exact: true }).waitFor();
  assert.equal(new URL(page.url()).pathname, "/settings");
  assert.equal(await password.inputValue(), "");
  assert.equal(await confirmation.inputValue(), "DELETE");
  assert.equal(await submit.isDisabled(), true);
  assert.deepEqual(await records(page), before);
  assert.equal(deletionRequests.length, 1);

  await page.reload();
  await page.getByRole("heading", { name: "Your account", exact: true }).waitFor();
  await page.getByText("All changes saved to your account.", { exact: true }).waitFor();
  assert.deepEqual(await records(page), before);
  await button(page, "Delete account").click();
  await password.fill(fixturePassword);
  await confirmation.fill("DELETE");
  await Promise.all([submit.click(), deletion[1].started.promise]);
  assert.equal(await password.inputValue(), "");
  assert.equal(await button(page, "Deleting account…").isDisabled(), true);
  assert.deepEqual(deletionRequests[1].body, { password: fixturePassword, confirmation: "DELETE" });
  deletion[1].response.resolve();
  await page.waitForURL((url) => url.pathname === "/account");
  await page.getByRole("tab", { name: "Log in", exact: true }).waitFor();
  const after = await records(page);
  assert.equal(after.auth, null);
  assert.deepEqual(after.preserved, preserved);
  assert.deepEqual(after.owned, { [`${ownerPrefix}deleted.v1`]: "1" });
  assert.equal(await page.getByRole("heading", { name: "Your account", exact: true }).count(), 0);
  assert.equal(await page.getByRole("alert").count(), 0);
  assert.equal(deletionRequests.length, 2);
  assert.equal(
    account.requests.some(({ path }) => path === "/auth/v1/logout"),
    false,
  );
  await page
    .getByText("Your KineVault account has been deleted.", { exact: true })
    .waitFor()
    .catch(async (error) => {
      throw new Error(
        `${error.message}\nAccount screen: ${await page.locator("body").innerText()}`,
      );
    });
  await page.reload();
  await page.getByRole("tab", { name: "Log in", exact: true }).waitFor();
  assert.equal(new URL(page.url()).pathname, "/account");
  const reloaded = await records(page);
  assert.equal(reloaded.auth, null);
  assert.deepEqual(reloaded.owned, after.owned);
  assert.deepEqual(reloaded.preserved, preserved);
});
