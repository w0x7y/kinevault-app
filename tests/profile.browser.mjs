import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
const baseURL = process.env.KINE_PREVIEW_URL || "http://localhost:8081";
const profileKey = "kinevault-track.profile.v1",
  mediaKey = "kinevault-track.profile-media.v1";
const answers = {
  name: "Journal fixture",
  age: "30",
  height: "180",
  weight: "80",
  goal: "maintain",
  activity: "moderate",
  sex: "male",
  estimateEnabled: true,
  eligible: true,
  customCalories: "2000",
  customCarbs: "0",
  customProtein: "",
  customFat: "",
};
const food = {
  id: "food",
  fdcId: 1,
  name: "Breakfast",
  meal: "breakfast",
  grams: 100,
  calories: 240,
  carbs: 30,
  protein: 12,
  fat: 8,
};
const session = {
  id: "session",
  date: "2026-10-04",
  name: "Press",
  status: "completed",
  startedAt: null,
  durationSeconds: 1800,
  exercises: [
    {
      id: "row",
      exercise: {
        id: "press",
        name: "Press",
        muscleGroup: "",
        equipment: "",
        notes: "",
        tracking: "sides",
      },
      sets: [
        {
          id: "set",
          kind: "sides",
          left: { reps: "5", weightKg: "10" },
          right: { reps: "5", weightKg: "20" },
        },
      ],
    },
  ],
};
const button = (p, name) => p.getByRole("button", { name, exact: true });
const photoButton = (page, id, action) =>
  page
    .getByTestId(`progress-photo-${id}`)
    .getByRole("button", { name: new RegExp(`^${action} photo `) });
async function open(t, options = {}) {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    timezoneId: "Asia/Jerusalem",
  });
  await context.addInitScript(
    ({ answers, food, session, options }) => {
      if (!sessionStorage.getItem("profile-fixture")) {
        localStorage.setItem(
          "kinevault-track.profile.v1",
          JSON.stringify({ version: 1, kind: "complete", answers }),
        );
        localStorage.setItem(
          "kinevault-track.food-log.v1",
          JSON.stringify({
            version: 1,
            days: {
              "2026-10-04": [food],
              "2026-10-03": [{ ...food, id: "yesterday-food" }],
            },
          }),
        );
        localStorage.setItem(
          "kinevault-track.water-log.v1",
          JSON.stringify({
            version: 1,
            days: { "2026-10-04": 2500, "2026-10-02": 250 },
          }),
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
        localStorage.setItem(
          "kinevault-track.appearance",
          options.appearance || "light",
        );
        sessionStorage.setItem("profile-fixture", "1");
      }
      if (options.failureKey) {
        window.__profileFailureKey = options.failureKey;
        const get = Storage.prototype.getItem;
        Storage.prototype.getItem = function (key) {
          if (key === window.__profileFailureKey)
            throw new Error("source read failure");
          return get.call(this, key);
        };
      }
    },
    { answers, food, session, options },
  );
  const page = await context.newPage();
  page.on("filechooser", () => {});
  page.setDefaultTimeout(15000);
  const runtimeErrors = [];
  page.__profileWarnings = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning")
      page.__profileWarnings.push(message.text());
  });
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  t.after(() =>
    assert.deepEqual(runtimeErrors, [], "no uncaught browser errors"),
  );
  await page.clock.install({ time: new Date("2026-10-04T12:00:00+03:00") });
  await page.goto(baseURL);
  await button(page, "Profile menu").waitFor();
  return page;
}
async function profile(page) {
  await button(page, "Profile menu").click();
  await page.getByRole("menuitem", { name: "Profile", exact: true }).click();
  await page.waitForURL("**/profile");
  await button(page, "Overview").waitFor();
}
async function upload(page, name = "fixture.png") {
  const bytes = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 60;
    c.height = 90;
    const x = c.getContext("2d");
    x.fillStyle = "#638ba6";
    x.fillRect(0, 0, 60, 90);
    return c.toDataURL().split(",")[1];
  });
  await page
    .locator("input[type=file]")
    .last()
    .setInputFiles({
      name,
      mimeType: "image/png",
      buffer: Buffer.from(bytes, "base64"),
    });
}
async function stored(page, key = profileKey) {
  return JSON.parse(
    await page.evaluate((key) => localStorage.getItem(key), key),
  );
}
test("historical Home date survives Profile/back; journal uses today and four bottom tabs", async (t) => {
  const page = await open(t);
  await button(page, "Expand calendar").click();
  await button(page, "Select previous day").click();
  await button(page, "Collapse calendar").click();
  await profile(page);
  assert.equal(await page.getByRole("tab").count(), 4);
  assert.equal(await button(page, "Expand calendar").count(), 0);
  await page
    .getByTestId("profile-streak")
    .getByText("3 days", { exact: true })
    .first()
    .waitFor();
  assert.deepEqual(
    await page
      .getByTestId("streak-week")
      .locator("[data-testid^=streak-day-]")
      .evaluateAll((e) =>
        e.map((x) => x.getAttribute("data-testid").slice(11)),
      ),
    [
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
    ],
  );
  await page.getByText("2026-10-04: 150 kg x reps", { exact: true }).waitFor();
  await button(page, "Weight").click();
  await page
    .getByText("2026-10-04: Left 10 kg, Right 20 kg", { exact: true })
    .waitFor();
  await button(page, "Duration").click();
  await page.getByText("2026-10-04: 30 min", { exact: true }).waitFor();
  await button(page, "Today's nutrition").click();
  await page.getByText("Today · 2026-10-04", { exact: true }).waitFor();
  await page
    .getByTestId("profile-goal-calories")
    .getByText("240 / 2,000 kcal", { exact: true })
    .waitFor();
  await page
    .getByTestId("profile-goal-carbs")
    .getByText("30 / 0 g", { exact: true })
    .waitFor();
  await page
    .getByTestId("profile-goal-water")
    .getByText("2,500 / 1,500 ml", { exact: true })
    .waitFor();
  await button(page, "Back from Profile").click();
  await page.waitForURL(baseURL + "/");
  await page.getByLabel("Saturday, October 3, 2026").waitFor();
});
test("focused editing validates, retains failed saves, merges latest values and keeps Settings compatible", async (t) => {
  const page = await open(t);
  await profile(page);
  await button(page, "Goals").click();
  await button(page, "Edit name").click();
  await page
    .getByRole("textbox", { name: "Your name (optional)", exact: true })
    .fill("New name");
  await page.evaluate((key) => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k === key) {
        Storage.prototype.setItem = set;
        throw new Error("write failure");
      }
      return set.call(this, k, v);
    };
  }, profileKey);
  await button(page, "Save name").click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Couldn't save your answers" })
    .waitFor();
  assert.equal(
    await page
      .getByRole("textbox", { name: "Your name (optional)", exact: true })
      .inputValue(),
    "New name",
  );
  await button(page, "Save name").click();
  assert.equal((await stored(page)).answers.name, "New name");
  await button(page, "Edit age").click();
  await page
    .getByRole("textbox", { name: "Age (years)", exact: true })
    .fill("15");
  await button(page, "Save age").click();
  await page
    .getByRole("alert")
    .filter({ hasText: "between 16 and 100" })
    .waitFor();
  await page
    .getByRole("textbox", { name: "Age (years)", exact: true })
    .fill("17");
  await button(page, "Save age").click();
  await button(page, "Edit body").waitFor();
  const next = (await stored(page)).answers;
  assert.equal(next.estimateEnabled, false);
  assert.equal(next.customCalories, "");
  assert.equal(next.sex, null);
  await page.getByRole("tab", { name: "Settings", exact: true }).click();
  await page.getByText("Your profile", { exact: true }).waitFor();
});
test("real library uploads support dated notes, replacement, two-photo comparison, reload and confirmed removal", async (t) => {
  const page = await open(t);
  await profile(page);
  await button(page, "Photos").click();
  await page
    .getByText("Your photo journal starts here.", { exact: true })
    .waitFor();
  await button(page, "Add from library").click();
  await upload(page);
  await page
    .getByRole("dialog", { name: "Add progress photo", exact: true })
    .waitFor();
  await page
    .getByRole("textbox", { name: "Photo date (YYYY-MM-DD)", exact: true })
    .fill("2026-10-01");
  await page
    .getByRole("textbox", { name: "Photo note (optional)", exact: true })
    .fill("First day");
  await button(page, "Save photo").click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  await button(page, "Add from library").click();
  await upload(page, "second.png");
  await button(page, "Save photo").click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  let document = await stored(page, mediaKey);
  assert.equal(document.photos.length, 2);
  assert.equal(document.photos[0].note, "First day");
  await photoButton(page, document.photos[0].id, "Edit").click();
  await button(page, "Replace from library").click();
  await upload(page, "replacement.png");
  await page
    .getByRole("textbox", { name: "Photo note (optional)", exact: true })
    .fill("Replaced");
  await button(page, "Save photo").click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  const old = document.photos[0].image.id;
  document = await stored(page, mediaKey);
  assert.notEqual(document.photos[0].image.id, old);
  assert.equal(
    await button(page, "Compare selected photos").isDisabled(),
    true,
  );
  await photoButton(page, document.photos[0].id, "Select").click();
  assert.equal(
    await button(page, "Compare selected photos").isDisabled(),
    true,
  );
  await photoButton(page, document.photos[1].id, "Select").click();
  await button(page, "Compare selected photos").click();
  await page
    .getByRole("dialog", { name: "Compare progress photos", exact: true })
    .waitFor();
  assert.equal(await page.getByRole("dialog").getByRole("img").count(), 2);
  await button(page, "Back to photos").click();
  await page.reload();
  await button(page, "Photos").click();
  await page.getByText("Replaced", { exact: true }).waitFor();
  assert.equal((await stored(page, mediaKey)).photos.length, 2);
  const blobs = await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const r = indexedDB.open("kinevault-track.profile-media-files.v1", 1);
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const db = r.result;
          const tx = db.transaction("photos", "readonly");
          const read = tx.objectStore("photos").getAll();
          read.onsuccess = () => {
            resolve(
              read.result.map((x) => ({
                original: x.original instanceof Blob,
                thumbnail: x.thumbnail instanceof Blob,
              })),
            );
            db.close();
          };
        };
      }),
  );
  assert.ok(blobs.length >= 2);
  assert.ok(blobs.every((x) => x.original && x.thumbnail));
  document = await stored(page, mediaKey);
  await photoButton(page, document.photos[0].id, "Edit").click();
  await button(page, "Remove photo").click();
  await button(page, "Confirm remove photo").click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  assert.equal((await stored(page, mediaKey)).photos.length, 1);
});
test("Profile water goal has focused cancel, validation, failed draft retry and saved target persistence", async (t) => {
  const page = await open(t);
  await profile(page);
  await button(page, "Goals").click();
  assert.equal(
    await page
      .getByRole("textbox", { name: "Daily water goal (ml)", exact: true })
      .count(),
    0,
  );
  await button(page, "Edit water goal").click();
  await page
    .getByRole("textbox", { name: "Daily water goal (ml)", exact: true })
    .fill("2500");
  await button(page, "Cancel").click();
  assert.equal(
    await page
      .getByRole("textbox", { name: "Daily water goal (ml)", exact: true })
      .count(),
    0,
  );
  await page
    .getByTestId("profile-goal-water")
    .getByText("2,500 / 1,500 ml", { exact: true })
    .waitFor();
  await button(page, "Edit water goal").click();
  await page
    .getByRole("textbox", { name: "Daily water goal (ml)", exact: true })
    .fill("0");
  await button(page, "Save water goal").click();
  await page.getByRole("alert").filter({ hasText: "1 to 10,000" }).waitFor();
  await page
    .getByRole("textbox", { name: "Daily water goal (ml)", exact: true })
    .fill("2000");
  await page.evaluate(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k === "kinevault-track.water-goal.v1") {
        Storage.prototype.setItem = set;
        throw new Error("goal failure");
      }
      return set.call(this, k, v);
    };
  });
  await button(page, "Save water goal").click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Couldn't save your water goal" })
    .waitFor();
  assert.equal(
    await page
      .getByRole("textbox", { name: "Daily water goal (ml)", exact: true })
      .inputValue(),
    "2000",
  );
  await button(page, "Save water goal").click();
  await page
    .getByTestId("profile-goal-water")
    .getByText("2,500 / 2,000 ml", { exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole("textbox", { name: "Daily water goal (ml)", exact: true })
      .count(),
    0,
  );
  await page.reload();
  await button(page, "Goals").click();
  await page
    .getByTestId("profile-goal-water")
    .getByText("2,500 / 2,000 ml", { exact: true })
    .waitFor();
});
test("each source recovers independently while usable sections remain available", async (t) => {
  for (const [name, key, section] of [
    ["food log", "kinevault-track.food-log.v1", "Overview"],
    ["water log", "kinevault-track.water-log.v1", "Overview"],
    ["workouts", "kinevault-track.exercise.v1", "Overview"],
    ["profile media", mediaKey, "Photos"],
    ["water goal", "kinevault-track.water-goal.v1", "Goals"],
  ]) {
    const page = await open(t, { failureKey: key });
    await profile(page);
    await button(page, section).click();
    await button(page, `Retry ${name}`).first().waitFor();
    if (section === "Overview") {
      assert.equal(
        await page
          .getByTestId("profile-streak")
          .getByText("3 days", { exact: true })
          .count(),
        0,
      );
      await button(page, "Photos").click();
      await page
        .getByText("Your photo journal starts here.", { exact: true })
        .waitFor();
      await button(page, "Overview").click();
      if (name !== "workouts")
        await page
          .getByText("2026-10-04: 150 kg x reps", { exact: true })
          .waitFor();
    }
    await page.evaluate(() => {
      window.__profileFailureKey = null;
    });
    await button(page, `Retry ${name}`).first().click();
    if (section === "Overview")
      await page
        .getByTestId("profile-streak")
        .getByText("3 days", { exact: true })
        .first()
        .waitFor();
    if (section === "Photos")
      await page
        .getByText("Your photo journal starts here.", { exact: true })
        .waitFor();
    if (section === "Goals") await button(page, "Edit water goal").waitFor();
  }
});
test("avatar retains failed draft, prevents pending duplicate writes, replaces and removes with confirmation", async (t) => {
  const page = await open(t);
  await profile(page);
  await button(page, "Change profile photo").click();
  await button(page, "Choose profile photo from library").click();
  await upload(page, "avatar.png");
  const dialog = page.getByRole("dialog", {
    name: "Profile photo",
    exact: true,
  });
  await dialog
    .getByRole("img", { name: "Draft profile photo", exact: true })
    .waitFor();
  await page.evaluate((key) => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k === key) {
        Storage.prototype.setItem = set;
        throw new Error("media failure");
      }
      return set.call(this, k, v);
    };
  }, mediaKey);
  await button(page, "Save profile photo").click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Couldn't save your photo changes" })
    .waitFor();
  assert.equal(
    await dialog
      .getByRole("img", { name: "Draft profile photo", exact: true })
      .count(),
    1,
  );
  assert.equal(await stored(page, mediaKey), null);
  await page.evaluate((key) => {
    const set = Storage.prototype.setItem;
    window.__profileWrites = 0;
    Storage.prototype.setItem = function (k, v) {
      if (k !== key) return set.call(this, k, v);
      window.__profileWrites++;
      return new Promise((resolve) => {
        window.__releaseProfileWrite = () => {
          Storage.prototype.setItem = set;
          set.call(this, k, v);
          resolve();
        };
      });
    };
  }, mediaKey);
  await button(page, "Save profile photo").evaluate((element) => {
    element.click();
    element.click();
    element.click();
  });
  await button(page, "Saving profile photo…").waitFor();
  assert.equal(await button(page, "Cancel").isDisabled(), true);
  assert.equal(await page.evaluate(() => window.__profileWrites), 1);
  await page.evaluate(() => window.__releaseProfileWrite());
  await dialog.waitFor({ state: "detached" });
  const original = (await stored(page, mediaKey)).avatar.id;
  await button(page, "Change profile photo").click();
  await button(page, "Replace profile photo from library").click();
  await upload(page, "replacement-avatar.png");
  await button(page, "Save profile photo").click();
  await dialog.waitFor({ state: "detached" });
  assert.notEqual((await stored(page, mediaKey)).avatar.id, original);
  await page.reload();
  await button(page, "Change profile photo").click();
  await dialog
    .getByRole("img", { name: "Profile photo", exact: true })
    .waitFor();
  await button(page, "Remove profile photo").click();
  assert.notEqual((await stored(page, mediaKey)).avatar, null);
  await button(page, "Confirm remove profile photo").click();
  await dialog.waitFor({ state: "detached" });
  assert.equal((await stored(page, mediaKey)).avatar, null);
});
test("photo save and remove failures preserve date, note, image and saved metadata for retry", async (t) => {
  const page = await open(t);
  await profile(page);
  await button(page, "Photos").click();
  await button(page, "Add from library").click();
  await upload(page);
  const dialog = page.getByRole("dialog", {
    name: "Add progress photo",
    exact: true,
  });
  await dialog
    .getByRole("textbox", { name: "Photo date (YYYY-MM-DD)", exact: true })
    .fill("2026-02-30");
  await button(page, "Save photo").click();
  await page.getByRole("alert").filter({ hasText: "valid date" }).waitFor();
  await dialog
    .getByRole("textbox", { name: "Photo date (YYYY-MM-DD)", exact: true })
    .fill("2026-10-02");
  await dialog
    .getByRole("textbox", { name: "Photo note (optional)", exact: true })
    .fill("Retain this draft");
  await page.evaluate((key) => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k === key) {
        Storage.prototype.setItem = set;
        throw new Error("photo write failure");
      }
      return set.call(this, k, v);
    };
  }, mediaKey);
  await button(page, "Save photo").click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Couldn't save your photo changes" })
    .waitFor();
  assert.equal(
    await dialog
      .getByRole("textbox", { name: "Photo date (YYYY-MM-DD)", exact: true })
      .inputValue(),
    "2026-10-02",
  );
  assert.equal(
    await dialog
      .getByRole("textbox", { name: "Photo note (optional)", exact: true })
      .inputValue(),
    "Retain this draft",
  );
  assert.equal(
    await dialog
      .getByRole("img", { name: "Draft progress photo", exact: true })
      .count(),
    1,
  );
  await button(page, "Save photo").click();
  await dialog.waitFor({ state: "detached" });
  const saved = await stored(page, mediaKey);
  await photoButton(page, saved.photos[0].id, "Edit").click();
  await button(page, "Replace from library").click();
  await page
    .locator("input[type=file]")
    .last()
    .evaluate((input) => input.dispatchEvent(new Event("cancel")));
  await button(page, "Save photo").waitFor();
  assert.equal(
    await page
      .getByRole("dialog")
      .getByRole("img", { name: "Progress photo 2026-10-02", exact: true })
      .count(),
    1,
  );
  await page.evaluate((key) => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k === key) {
        Storage.prototype.setItem = set;
        throw new Error("remove failure");
      }
      return set.call(this, k, v);
    };
  }, mediaKey);
  await button(page, "Remove photo").click();
  await button(page, "Confirm remove photo").click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Couldn't save your photo changes" })
    .waitFor();
  assert.deepEqual(await stored(page, mediaKey), saved);
  await button(page, "Confirm remove photo").click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  assert.equal((await stored(page, mediaKey)).photos.length, 0);
});
test("journal sections and focused editors fit light and dark small, tablet and desktop widths", async (t) => {
  for (const appearance of ["light", "dark"]) {
    const page = await open(t, { appearance });
    await profile(page);
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      for (const section of ["Overview", "Goals", "Photos"]) {
        await button(page, section).click();
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
          `${appearance} ${width} ${section} has no horizontal overflow`,
        );
        const geometry = await page
          .locator("[role=button]")
          .evaluateAll((elements) =>
            elements
              .filter((element) => {
                const b = element.getBoundingClientRect();
                return b.width > 0 && b.height > 0;
              })
              .map((element) => ({
                name: element.getAttribute("aria-label"),
                width: element.getBoundingClientRect().width,
                height: element.getBoundingClientRect().height,
              })),
          );
        assert.deepEqual(
          geometry.filter((hit) => hit.width < 44 || hit.height < 44),
          [],
          `${appearance} ${width} ${section} targets >=44`,
        );
        assert.equal(await page.getByRole("tab").count(), 4);
      }
      await button(page, "Goals").click();
      await button(page, "Edit body").click();
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await button(page, "Cancel").click();
      await button(page, "Overview").click();
      if (width === 320 || width === 390)
        await page.screenshot({
          path: `/tmp/profile-${appearance}-${width}.png`,
          fullPage: true,
        });
    }
  }
});
test("removing a selected photo lets another photo complete the comparison pair", async (t) => {
  const page = await open(t);
  await profile(page);
  await button(page, "Photos").click();
  for (let i = 0; i < 3; i++) {
    await button(page, "Add from library").click();
    await upload(page, `photo-${i}.png`);
    await button(page, "Save photo").click();
    await page.getByRole("dialog").waitFor({ state: "detached" });
  }
  const photos = (await stored(page, mediaKey)).photos;
  await photoButton(page, photos[0].id, "Select").click();
  await photoButton(page, photos[1].id, "Select").click();
  assert.equal(
    await photoButton(page, photos[2].id, "Select").isDisabled(),
    true,
  );
  await photoButton(page, photos[0].id, "Edit").click();
  await button(page, "Remove photo").click();
  await button(page, "Confirm remove photo").click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  await photoButton(page, photos[2].id, "Select").click();
  assert.equal(
    await button(page, "Compare selected photos").isDisabled(),
    false,
  );
});

test("workout graph supports point selection and accessible data without web responder warnings", async (t) => {
  const page = await open(t);
  await profile(page);
  await button(page, "Select workout graph point").click({
    position: { x: 40, y: 60 },
  });
  await page.getByText(/2026-07-\d+: No measurement recorded/).waitFor();
  await button(page, "Show workout data").click();
  await button(page, "2026-10-04: 150 kg x reps").click();
  assert.equal(
    await page.getByText("2026-10-04: 150 kg x reps", { exact: true }).count(),
    2,
  );
  assert.deepEqual(
    page.__profileWarnings.filter((text) =>
      text.includes("Unknown event handler property"),
    ),
    [],
  );
});
