import { installAccountFixture } from "./helpers/account-fixture.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
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
async function selectLatestWorkoutWeek(page) {
  const graph = button(page, "Select workout graph point");
  const bounds = await graph.boundingBox();
  await graph.click({ position: { x: bounds.width - 12, y: 50 } });
}
const photoButton = (page, id, action = "Edit") =>
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
        localStorage.setItem("kinevault-track.appearance", options.appearance || "light");
        sessionStorage.setItem("profile-fixture", "1");
      }
      if (options.failureKey) {
        window.__profileFailureKey = options.failureKey;
        const get = Storage.prototype.getItem;
        Storage.prototype.getItem = function (key) {
          if (key.endsWith(window.__profileFailureKey) && window.accountFixture?.domainReady)
            throw new Error("source read failure");
          return get.call(this, key);
        };
      }
    },
    { answers: options.answers || answers, food, session, options },
  );
  await installAccountFixture(context);
  const page = await context.newPage();
  page.on("filechooser", () => {});
  page.setDefaultTimeout(15000);
  // Cold Metro bundles need the standard navigation allowance on CI runners.
  if (options.developmentRuntime) page.setDefaultNavigationTimeout(30000);
  const runtimeErrors = [];
  page.__profileWarnings = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning")
      page.__profileWarnings.push(message.text());
  });
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  t.after(() => assert.deepEqual(runtimeErrors, [], "no uncaught browser errors"));
  await page.clock.install({ time: new Date("2026-10-04T12:00:00+03:00") });
  const previewURL = options.developmentRuntime
    ? process.env.KINE_DEV_PREVIEW_URL || baseURL
    : baseURL;
  await page.goto(previewURL);
  await button(page, "Profile menu").waitFor();
  return page;
}
async function editDetail(page, section) {
  await button(page, "Edit details and goals").click();
  await button(page, `Edit ${section}`).click();
}
async function expectGoal(page, field, label) {
  await page.getByTestId(`profile-goal-${field}`).waitFor();
  assert.equal(await page.getByTestId(`profile-goal-${field}`).getAttribute("aria-label"), label);
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
  return JSON.parse(await page.evaluate((key) => window.accountFixture.getItem(key), key));
}
async function bottomTabGeometry(page) {
  await page.evaluate(() => document.fonts.ready);
  const tabs = await page.getByRole("tab").evaluateAll((elements) =>
    elements.map((element) => {
      const descendants = [...element.querySelectorAll("*")];
      const name = descendants
        .find(
          (node) =>
            node.childElementCount === 0 &&
            ["Home", "Food", "Exercise", "Settings"].includes(node.textContent.trim()),
        )
        ?.textContent.trim();
      const geometry = (node) => {
        const style = getComputedStyle(node),
          box = node.getBoundingClientRect();
        return {
          fontFamily: style.fontFamily,
          fontSize: style.fontSize,
          lineHeight: style.lineHeight,
          width: Math.round(box.width * 100) / 100,
          height: Math.round(box.height * 100) / 100,
        };
      };
      return {
        name,
        icons: descendants
          .filter(
            (node) =>
              node.childElementCount === 0 &&
              getComputedStyle(node).fontFamily.includes("FontAwesome"),
          )
          .map(geometry),
        labels: descendants
          .filter((node) => node.childElementCount === 0 && node.textContent.trim() === name)
          .map(geometry),
      };
    }),
  );
  assert.deepEqual(
    tabs.map((tab) => tab.name),
    ["Home", "Food", "Exercise", "Settings"],
  );
  for (const tab of tabs) {
    assert.ok(tab.icons.length > 0, `${tab.name} has measured icon glyphs`);
    assert.ok(tab.labels.length > 0, `${tab.name} has a measured text label`);
    assert.ok([...tab.icons, ...tab.labels].every((item) => item.width > 0 && item.height > 0));
  }
  return tabs;
}
const photoDateLabel = (date) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
async function expectDateBelowPhoto(container, date) {
  const image = container.getByRole("img", {
    name: `Progress photo ${date}`,
    exact: true,
  });
  await image.waitFor();
  const label = container.getByText(photoDateLabel(date), { exact: true });
  await label.waitFor();
  const imageBox = await image.boundingBox(),
    dateBox = await label.boundingBox();
  assert.ok(dateBox.y >= imageBox.y + imageBox.height - 1, `${date} date is beneath its image`);
}
async function expectComparison(page, firstDate, latestDate) {
  const comparison = page.getByTestId("profile-recent-photos");
  await comparison.getByRole("heading", { name: "Progress comparison", exact: true }).waitFor();
  assert.deepEqual(
    await comparison
      .getByRole("button")
      .evaluateAll((elements) => elements.map((element) => element.getAttribute("data-testid"))),
    ["profile-comparison-first", "profile-comparison-latest"],
    "comparison offers only its two photo panes with no header or Add buttons",
  );
  for (const [side, date] of [
    ["first", firstDate],
    ["latest", latestDate],
  ]) {
    const pane = comparison.getByTestId(`profile-comparison-${side}`);
    await pane.waitFor();
    if (date) await expectDateBelowPhoto(pane, date);
    else {
      assert.equal(await pane.getByRole("img").count(), 0);
      await pane.getByText("No saved photo", { exact: true }).waitFor();
    }
  }
  const firstBox = await comparison.getByTestId("profile-comparison-first").boundingBox();
  const latestBox = await comparison.getByTestId("profile-comparison-latest").boundingBox();
  assert.ok(firstBox.x + firstBox.width <= latestBox.x, "first photo is left of latest photo");
}
async function addPhoto(page, date, note = "") {
  await button(page, "Add from library").click();
  await upload(page, `photo-${date}.png`);
  await page.getByRole("textbox", { name: "Photo date (YYYY-MM-DD)", exact: true }).fill(date);
  if (note)
    await page.getByRole("textbox", { name: "Photo note (optional)", exact: true }).fill(note);
  await button(page, "Save photo").click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  return (await stored(page, mediaKey)).photos.find((photo) => photo.date === date);
}
async function expectCarousel(page, photos) {
  const journal = page.getByTestId("profile-photos");
  assert.deepEqual(
    await journal
      .locator('[data-testid^="progress-photo-"]')
      .evaluateAll((elements) =>
        elements.map((element) =>
          element.getAttribute("data-testid").slice("progress-photo-".length),
        ),
      ),
    photos.map((photo) => photo.id),
    "carousel renders the entire saved gallery in date order",
  );
  assert.equal(
    await journal.getByRole("button").count(),
    photos.length + 1,
    "Photos offers one editor per item and one Add action",
  );
  const separators = journal.getByTestId("profile-photo-separator");
  assert.equal(await separators.count(), Math.max(0, photos.length - 1));
  for (const [index, photo] of photos.entries()) {
    const item = journal.getByTestId(`progress-photo-${photo.id}`);
    assert.equal(
      await photoButton(page, photo.id).getAttribute("aria-label"),
      `Edit photo ${index + 1} from ${photo.date}`,
    );
    await expectDateBelowPhoto(item, photo.date);
    if (index < photos.length - 1) {
      const divider = await separators.nth(index).boundingBox();
      const image = await item
        .getByRole("img", { name: `Progress photo ${photo.date}`, exact: true })
        .boundingBox();
      const nextItem = await journal
        .getByTestId(`progress-photo-${photos[index + 1].id}`)
        .boundingBox();
      assert.ok(divider.height > divider.width * 10, "photo divider is vertical");
      assert.ok(
        divider.x >= image.x + image.width - 1 && divider.x + divider.width <= nextItem.x + 1,
        "divider sits between adjacent photos",
      );
    }
  }
}
test("historical Home date survives Profile/back; calendar streak week and four bottom tabs use consistent sizing", async (t) => {
  const page = await open(t);
  const homeTabs = await bottomTabGeometry(page);
  await button(page, "Expand calendar").click();
  await button(page, "Select previous day").click();
  await button(page, "Collapse calendar").click();
  await profile(page);
  assert.deepEqual(
    await bottomTabGeometry(page),
    homeTabs,
    "Profile keeps Home icon and label fonts and dimensions",
  );
  assert.equal(await button(page, "Expand calendar").count(), 0);
  await page.getByTestId("profile-streak").getByText("3 days", { exact: true }).first().waitFor();
  assert.deepEqual(
    await page
      .getByTestId("streak-week")
      .locator("[data-testid^=streak-day-]")
      .evaluateAll((e) => e.map((x) => x.getAttribute("data-testid").slice(11))),
    [
      "2026-10-04",
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
      "2026-10-10",
    ],
  );
  await selectLatestWorkoutWeek(page);
  await page.getByText("Week ending 2026-10-04: 150 kg x reps", { exact: true }).waitFor();
  await button(page, "Exercise weight").click();
  await selectLatestWorkoutWeek(page);
  await page
    .getByText("Week ending 2026-10-04: Left 10 kg, Right 20 kg", { exact: true })
    .waitFor();
  await button(page, "Duration").click();
  await selectLatestWorkoutWeek(page);
  await page.getByText("Week ending 2026-10-04: 30 min", { exact: true }).waitFor();
  await button(page, "Today's nutrition").click();
  await page.getByLabel("Today & targets · 2026-10-04", { exact: true }).waitFor();
  await expectGoal(page, "calories", "240 / 2,000 kcal");
  await expectGoal(page, "carbs", "30 / 0 g");
  await expectGoal(page, "water", "2,500 / 1,500 ml");
  await button(page, "Back from Profile").click();
  await page.waitForURL(baseURL + "/");
  await page.getByLabel("Saturday, October 3, 2026").waitFor();
});
test("details chooser cancels without opening an editor or changing saved answers", async (t) => {
  const page = await open(t);
  await profile(page);
  await button(page, "Goals").click();
  const before = await stored(page);
  const trigger = button(page, "Edit details and goals");
  await trigger.click();
  const chooser = page.getByRole("dialog", { name: "Edit details & goals", exact: true });
  await chooser.waitFor();
  const cancel = chooser.getByRole("button", { name: "Cancel", exact: true });
  await cancel.focus();
  await cancel.press("Enter");
  await chooser.waitFor({ state: "detached" });
  assert.equal(await page.getByTestId("profile-editor").count(), 0);
  assert.deepEqual(await stored(page), before);
  assert.equal(await button(page, "Goals").getAttribute("aria-pressed"), "true");
  assert.equal(await trigger.evaluate((node) => node === document.activeElement), true);
  await trigger.click();
  await chooser.waitFor();
  await chooser.getByRole("button", { name: "Edit age", exact: true }).click();
  await page.getByRole("textbox", { name: "Age (years)", exact: true }).waitFor();
});

test("focused editing validates, retains failed saves, merges latest values and keeps Settings compatible", async (t) => {
  const page = await open(t);
  await profile(page);
  await button(page, "Goals").click();
  await editDetail(page, "name");
  await page.getByRole("textbox", { name: "Your name (optional)", exact: true }).fill("New name");
  await page.evaluate((key) => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k.endsWith(key)) {
        Storage.prototype.setItem = set;
        throw new Error("write failure");
      }
      return set.call(this, k, v);
    };
  }, profileKey);
  await button(page, "Save name").click();
  await page.getByRole("alert").filter({ hasText: "Couldn't save your answers" }).waitFor();
  assert.equal(
    await page.getByRole("textbox", { name: "Your name (optional)", exact: true }).inputValue(),
    "New name",
  );
  await button(page, "Save name").click();
  assert.equal((await stored(page)).answers.name, "New name");
  await editDetail(page, "age");
  await page.getByRole("textbox", { name: "Age (years)", exact: true }).fill("15");
  await button(page, "Save age").click();
  await page.getByRole("alert").filter({ hasText: "between 16 and 100" }).waitFor();
  await page.getByRole("textbox", { name: "Age (years)", exact: true }).fill("17");
  await button(page, "Save age").click();
  await button(page, "Edit details and goals").waitFor();
  const next = (await stored(page)).answers;
  assert.equal(next.estimateEnabled, false);
  assert.equal(next.customCalories, "");
  assert.equal(next.sex, null);
  await page.getByRole("tab", { name: "Settings", exact: true }).click();
  await page.getByText("Your profile", { exact: true }).waitFor();
});
test("real library uploads support dated notes, replacement, oldest/latest comparison, reload and confirmed removal", async (t) => {
  const page = await open(t);
  await profile(page);
  await button(page, "Photos").click();
  await page.getByText("Your photo journal starts here.", { exact: true }).waitFor();
  await button(page, "Add from library").click();
  await upload(page);
  await page.getByRole("dialog", { name: "Add progress photo", exact: true }).waitFor();
  await page
    .getByRole("textbox", { name: "Photo date (YYYY-MM-DD)", exact: true })
    .fill("2026-10-01");
  await page.getByRole("textbox", { name: "Photo note (optional)", exact: true }).fill("First day");
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
  await page.getByRole("textbox", { name: "Photo note (optional)", exact: true }).fill("Replaced");
  await button(page, "Save photo").click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  const old = document.photos[0].image.id;
  document = await stored(page, mediaKey);
  assert.notEqual(document.photos[0].image.id, old);
  await button(page, "Overview").click();
  await expectComparison(page, "2026-10-01", "2026-10-04");
  await button(page, "Photos").click();
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
    await page.getByRole("textbox", { name: "Daily water goal (ml)", exact: true }).count(),
    0,
  );
  await button(page, "Edit water goal").click();
  await page.getByRole("textbox", { name: "Daily water goal (ml)", exact: true }).fill("2500");
  await button(page, "Cancel").click();
  assert.equal(
    await page.getByRole("textbox", { name: "Daily water goal (ml)", exact: true }).count(),
    0,
  );
  await expectGoal(page, "water", "2,500 / 1,500 ml");
  await button(page, "Edit water goal").click();
  await page.getByRole("textbox", { name: "Daily water goal (ml)", exact: true }).fill("0");
  await button(page, "Save water goal").click();
  await page.getByRole("alert").filter({ hasText: "1 to 10,000" }).waitFor();
  await page.getByRole("textbox", { name: "Daily water goal (ml)", exact: true }).fill("2000");
  await page.evaluate(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k.endsWith("kinevault-track.water-goal.v1")) {
        Storage.prototype.setItem = set;
        throw new Error("goal failure");
      }
      return set.call(this, k, v);
    };
  });
  await button(page, "Save water goal").click();
  await page.getByRole("alert").filter({ hasText: "Couldn't save your water goal" }).waitFor();
  assert.equal(
    await page.getByRole("textbox", { name: "Daily water goal (ml)", exact: true }).inputValue(),
    "2000",
  );
  await button(page, "Save water goal").click();
  await expectGoal(page, "water", "2,500 / 2,000 ml");
  assert.equal(
    await page.getByRole("textbox", { name: "Daily water goal (ml)", exact: true }).count(),
    0,
  );
  await page.reload();
  await button(page, "Goals").click();
  await expectGoal(page, "water", "2,500 / 2,000 ml");
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
        await page.getByTestId("profile-streak").getByText("3 days", { exact: true }).count(),
        0,
      );
      await button(page, "Photos").click();
      await page.getByText("Your photo journal starts here.", { exact: true }).waitFor();
      await button(page, "Overview").click();
      if (name !== "workouts") {
        await selectLatestWorkoutWeek(page);
        await page.getByText("Week ending 2026-10-04: 150 kg x reps", { exact: true }).waitFor();
      }
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
      await page.getByText("Your photo journal starts here.", { exact: true }).waitFor();
    if (section === "Goals") await button(page, "Edit water goal").waitFor();
  }
});
test("canceled photo failure does not appear on a newly opened media edit", async (t) => {
  const page = await open(t);
  await profile(page);
  await button(page, "Change profile photo").click();
  await button(page, "Choose profile photo from library").click();
  await upload(page, "failed-avatar.png");
  await page.evaluate((key) => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k.endsWith(key)) {
        Storage.prototype.setItem = set;
        throw new Error("media failure");
      }
      return set.call(this, k, v);
    };
  }, mediaKey);
  await button(page, "Save profile photo").click();
  await page.getByRole("alert").filter({ hasText: "Couldn't save your photo changes" }).waitFor();
  await button(page, "Cancel").click();
  await button(page, "Change profile photo").click();
  const avatar = page.getByRole("dialog", { name: "Profile photo", exact: true });
  await avatar.waitFor();
  assert.equal(await avatar.getByRole("alert").count(), 0);
  await button(page, "Cancel").click();
  await button(page, "Photos").click();
  await button(page, "Add from library").click();
  await upload(page, "new-progress-photo.png");
  const photo = page.getByRole("dialog", { name: "Add progress photo", exact: true });
  await photo.waitFor();
  assert.equal(await photo.getByRole("alert").count(), 0);
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
  await dialog.getByRole("img", { name: "Draft profile photo", exact: true }).waitFor();
  await page.evaluate((key) => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k.endsWith(key)) {
        Storage.prototype.setItem = set;
        throw new Error("media failure");
      }
      return set.call(this, k, v);
    };
  }, mediaKey);
  await button(page, "Save profile photo").click();
  await page.getByRole("alert").filter({ hasText: "Couldn't save your photo changes" }).waitFor();
  assert.equal(
    await dialog.getByRole("img", { name: "Draft profile photo", exact: true }).count(),
    1,
  );
  assert.equal(await stored(page, mediaKey), null);
  await page.evaluate((key) => {
    const set = Storage.prototype.setItem;
    window.__profileWrites = 0;
    Storage.prototype.setItem = function (k, v) {
      if (!k.endsWith(key)) return set.call(this, k, v);
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
  await page.waitForFunction(() => window.__profileWrites === 1);
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
  await dialog.getByRole("img", { name: "Profile photo", exact: true }).waitFor();
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
      if (k.endsWith(key)) {
        Storage.prototype.setItem = set;
        throw new Error("photo write failure");
      }
      return set.call(this, k, v);
    };
  }, mediaKey);
  await button(page, "Save photo").click();
  await page.getByRole("alert").filter({ hasText: "Couldn't save your photo changes" }).waitFor();
  assert.equal(
    await dialog
      .getByRole("textbox", { name: "Photo date (YYYY-MM-DD)", exact: true })
      .inputValue(),
    "2026-10-02",
  );
  assert.equal(
    await dialog.getByRole("textbox", { name: "Photo note (optional)", exact: true }).inputValue(),
    "Retain this draft",
  );
  assert.equal(
    await dialog.getByRole("img", { name: "Draft progress photo", exact: true }).count(),
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
      if (k.endsWith(key)) {
        Storage.prototype.setItem = set;
        throw new Error("remove failure");
      }
      return set.call(this, k, v);
    };
  }, mediaKey);
  await button(page, "Remove photo").click();
  await button(page, "Confirm remove photo").click();
  await page.getByRole("alert").filter({ hasText: "Couldn't save your photo changes" }).waitFor();
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
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
          false,
          `${appearance} ${width} ${section} has no horizontal overflow`,
        );
        const geometry = await page.locator("[role=button]").evaluateAll((elements) =>
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
      await editDetail(page, "body");
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
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
test("dated carousel scrolls oldest to newest and date edits and removal update the comparison", async (t) => {
  const page = await open(t);
  await profile(page);
  await button(page, "Photos").click();
  const photos = [];
  // Save out of order so neither insertion order nor the two newest dates can pass.
  for (const date of ["2026-10-03", "2026-08-23", "2026-10-01"])
    photos.push(await addPhoto(page, date));
  await expectCarousel(page, [photos[1], photos[2], photos[0]]);
  await button(page, "Overview").click();
  await expectComparison(page, "2026-08-23", "2026-10-03");
  await button(page, "Photos").click();
  assert.equal(await button(page, "Add from library").count(), 1);

  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    const carousel = page.getByTestId("profile-photo-carousel");
    await carousel.scrollIntoViewIfNeeded();
    await carousel.evaluate((element) => {
      element.scrollLeft = 0;
    });
    const initial = await carousel.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      scrollLeft: element.scrollLeft,
    }));
    assert.ok(
      initial.scrollWidth > initial.clientWidth,
      `${width}px carousel has more photos than its viewport`,
    );
    await carousel.hover();
    await page.mouse.wheel(500, 0);
    await page.waitForFunction(
      () => document.querySelector('[data-testid="profile-photo-carousel"]').scrollLeft > 0,
    );
    const scrolled = await carousel.evaluate((element) => element.scrollLeft);
    assert.ok(
      scrolled > initial.scrollLeft,
      `${width}px carousel responds to horizontal wheel scrolling`,
    );
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
      `${width}px Photos keeps horizontal scrolling inside the carousel`,
    );
    await photoButton(page, photos[0].id).click();
    await page.getByRole("dialog", { name: "Edit progress photo", exact: true }).waitFor();
    await button(page, "Cancel").click();
  }

  // Move the middle dated photo earlier than the original first photo.
  await photoButton(page, photos[2].id).click();
  await page
    .getByRole("textbox", { name: "Photo date (YYYY-MM-DD)", exact: true })
    .fill("2026-08-01");
  await button(page, "Save photo").click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  photos[2] = { ...photos[2], date: "2026-08-01" };
  await expectCarousel(page, [photos[2], photos[1], photos[0]]);
  await button(page, "Overview").click();
  await expectComparison(page, "2026-08-01", "2026-10-03");
  await button(page, "Photos").click();

  // Editing the original first photo can also change the latest endpoint.
  await photoButton(page, photos[1].id).click();
  await page
    .getByRole("textbox", { name: "Photo date (YYYY-MM-DD)", exact: true })
    .fill("2026-10-04");
  await button(page, "Save photo").click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  photos[1] = { ...photos[1], date: "2026-10-04" };
  await expectCarousel(page, [photos[2], photos[0], photos[1]]);
  await button(page, "Overview").click();
  await expectComparison(page, "2026-08-01", "2026-10-04");
  await button(page, "Photos").click();

  for (const [removed, remaining] of [
    [photos[2], [photos[0], photos[1]]],
    [photos[1], [photos[0]]],
    [photos[0], []],
  ]) {
    await photoButton(page, removed.id).click();
    await button(page, "Remove photo").click();
    await button(page, "Confirm remove photo").click();
    await page.getByRole("dialog").waitFor({ state: "detached" });
    assert.equal(await page.getByTestId(`progress-photo-${removed.id}`).count(), 0);
    assert.equal((await stored(page, mediaKey)).photos.length, remaining.length);
    await expectCarousel(page, remaining);
    await button(page, "Overview").click();
    await expectComparison(page, remaining[0]?.date, remaining.at(-1)?.date);
    await button(page, "Photos").click();
  }
  await page.getByText("Your photo journal starts here.", { exact: true }).waitFor();
});

test("workout graph icon stays decorative while point selection announces weekly values", async (t) => {
  const page = await open(t);
  await profile(page);
  await button(page, "Select workout graph point").click({
    position: { x: 40, y: 60 },
  });
  await page.getByText(/2026-07-\d+: No measurement recorded/).waitFor();
  const icon = page.getByTestId("profile-workout-icon");
  assert.equal(await icon.count(), 1);
  assert.equal(await icon.getAttribute("role"), null);
  assert.equal(await button(page, "Show workout data").count(), 0);
  await icon.click();
  assert.equal(
    await page.getByText("Gaps mean no measurement was recorded.", { exact: true }).count(),
    0,
  );
  assert.equal(await page.getByRole("button", { name: /^2026-\d\d-\d\d:/ }).count(), 0);
  await selectLatestWorkoutWeek(page);
  assert.equal(
    await page.getByText("Week ending 2026-10-04: 150 kg x reps", { exact: true }).count(),
    1,
  );
  assert.deepEqual(
    page.__profileWarnings.filter((text) => text.includes("Unknown event handler property")),
    [],
  );
});

async function delayWrite(page, key) {
  await page.evaluate((key) => {
    const set = Storage.prototype.setItem;
    window.__editorWriteCount = 0;
    Storage.prototype.setItem = function (k, value) {
      if (!k.endsWith(key)) return set.call(this, k, value);
      window.__editorWriteCount++;
      return new Promise((resolve) => {
        window.__releaseEditorWrite = () => {
          Storage.prototype.setItem = set;
          set.call(this, k, value);
          resolve();
        };
      });
    };
  }, key);
}

test("inline name editing stays in place, cancels cleanly, saves, and persists", async (t) => {
  const page = await open(t);
  await profile(page);
  assert.equal(await button(page, "Edit profile").count(), 0);
  for (const caption of [
    "Food, water, or a completed workout counts.",
    "kg × reps · latest week",
    "Completed workouts only",
  ]) {
    assert.equal(await page.getByText(caption, { exact: true }).count(), 0);
  }
  const badge = await page.getByTestId("profile-camera-badge").evaluate((node) => {
    const parent = node.getBoundingClientRect(),
      svg = node.querySelector("svg"),
      path = svg.querySelector("path");
    const bounds = path.getBBox(),
      point = svg.createSVGPoint();
    point.x = bounds.x + bounds.width / 2;
    point.y = bounds.y + bounds.height / 2;
    const center = point.matrixTransform(path.getScreenCTM());
    return {
      x: Math.abs(parent.x + parent.width / 2 - center.x),
      y: Math.abs(parent.y + parent.height / 2 - center.y),
    };
  });
  assert.ok(
    badge.x <= 0.5 && badge.y <= 0.5,
    "the visible camera drawing is centered in its badge",
  );
  const name = page.getByRole("textbox", { name: "Profile name", exact: true });
  await button(page, "Edit profile name").focus();
  await page.keyboard.press("Enter");
  assert.equal(await button(page, "Overview").getAttribute("aria-pressed"), "true");
  assert.equal(await page.getByTestId("profile-editor").count(), 0);
  assert.equal(await name.evaluate((node) => getComputedStyle(node).borderBottomWidth), "1px");
  assert.equal(await name.evaluate((node) => getComputedStyle(node).outlineWidth), "0px");
  assert.equal(await name.evaluate((node) => getComputedStyle(node).outlineStyle), "solid");
  await name.fill("Discarded");
  await button(page, "Cancel name editing").click();
  await button(page, "Edit profile name").click();
  assert.equal(await name.inputValue(), "Journal fixture");
  await page.setViewportSize({ width: 320, height: 844 });
  await name.fill("a".repeat(40));
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    "inline editing fits a narrow phone",
  );
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const input = await name.boundingBox();
    const avatar = await button(page, "Change profile photo").boundingBox();
    const cancel = await button(page, "Cancel name editing").boundingBox();
    const save = await button(page, "Save profile name").boundingBox();
    assert.ok(
      Math.abs(input.x + input.width / 2 - avatar.x - avatar.width / 2) <= 0.5,
      "editing name is centered under the avatar",
    );
    assert.ok(cancel.x + cancel.width <= input.x + 0.5, "Cancel is left of the name");
    assert.ok(save.x >= input.x + input.width - 0.5, "Save is right of the name");
  }
  await name.fill("Saved name");
  await button(page, "Save profile name").click();
  await name.waitFor({ state: "detached" });
  assert.equal((await stored(page)).answers.name, "Saved name");
  await button(page, "Edit profile name").click();
  assert.equal(await name.inputValue(), "Saved name");
  await button(page, "Cancel name editing").click();
  await page.reload();
  await page.getByRole("heading", { name: "Saved name", exact: true }).waitFor();
  assert.deepEqual(
    page.__profileWarnings.filter((text) => text.includes("non-boolean attribute")),
    [],
    "decorative camera SVG emits no DOM attribute warning",
  );
});

test("inline name input limit and failed save retain the draft for retry", async (t) => {
  const page = await open(t);
  await profile(page);
  await button(page, "Edit profile name").click();
  const name = page.getByRole("textbox", { name: "Profile name", exact: true });
  await name.fill("a".repeat(41));
  assert.equal(await name.getAttribute("maxlength"), "40");
  assert.equal(await name.inputValue(), "a".repeat(40));
  assert.equal((await stored(page)).answers.name, "Journal fixture");
  await name.fill("Retry name");
  await page.evaluate((key) => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, value) {
      if (k.endsWith(key)) {
        Storage.prototype.setItem = set;
        throw new Error("name write failure");
      }
      return set.call(this, k, value);
    };
  }, profileKey);
  await button(page, "Save profile name").click();
  await page.getByText("Couldn't save your name. Try again.", { exact: true }).waitFor();
  assert.equal(await name.inputValue(), "Retry name");
  assert.equal((await stored(page)).answers.name, "Journal fixture");
  await button(page, "Save profile name").click();
  await name.waitFor({ state: "detached" });
  assert.deepEqual((await stored(page)).answers, { ...answers, name: "Retry name" });
});

test("delayed water save leaves replacement Name draft and section navigation intact", async (t) => {
  const page = await open(t);
  await profile(page);
  await button(page, "Goals").click();
  await button(page, "Edit water goal").click();
  await page.getByRole("textbox", { name: "Daily water goal (ml)", exact: true }).fill("2000");
  await delayWrite(page, "kinevault-track.water-goal.v1");
  await button(page, "Save water goal").click();
  await button(page, "Saving water goal…").waitFor();
  await editDetail(page, "name");
  const name = page.getByRole("textbox", {
    name: "Your name (optional)",
    exact: true,
  });
  await name.fill("Replacement name draft");
  await page.evaluate(() => window.__releaseEditorWrite());
  await expectGoal(page, "water", "2,500 / 2,000 ml");
  assert.equal(await name.inputValue(), "Replacement name draft");
  assert.equal(await button(page, "Goals").getAttribute("aria-pressed"), "true");
  await button(page, "Save name").click();
  await name.waitFor({ state: "detached" });
  assert.equal((await stored(page)).answers.name, "Replacement name draft");
});

test("delayed profile save closes only its original editor and preserves replacement water draft", async (t) => {
  const page = await open(t);
  await profile(page);
  await button(page, "Goals").click();
  await editDetail(page, "name");
  await page
    .getByRole("textbox", { name: "Your name (optional)", exact: true })
    .fill("Pending saved name");
  await delayWrite(page, profileKey);
  await button(page, "Save name").click();
  await button(page, "Saving…").waitFor();
  await button(page, "Edit water goal").click();
  const water = page.getByRole("textbox", {
    name: "Daily water goal (ml)",
    exact: true,
  });
  await water.fill("2345");
  await page.evaluate(() => window.__releaseEditorWrite());
  await page.getByRole("heading", { name: "Pending saved name", exact: true }).waitFor();
  assert.equal(await water.inputValue(), "2345");
  await button(page, "Save water goal").click();
  await water.waitFor({ state: "detached" });
  assert.equal((await stored(page, "kinevault-track.water-goal.v1")).dailyMl, 2345);
});

test("inline name drafts survive pending water or profile section saves", async (t) => {
  for (const section of ["water", "name"]) {
    const page = await open(t);
    await profile(page);
    await button(page, "Goals").click();
    if (section === "water") {
      await button(page, "Edit water goal").click();
      await page.getByRole("textbox", { name: "Daily water goal (ml)", exact: true }).fill("2000");
    } else {
      await editDetail(page, "name");
      await page
        .getByRole("textbox", { name: "Your name (optional)", exact: true })
        .fill("Pending section name");
    }
    await delayWrite(page, section === "water" ? "kinevault-track.water-goal.v1" : profileKey);
    await button(page, section === "water" ? "Save water goal" : "Save name").click();
    await button(page, section === "water" ? "Saving water goal…" : "Saving…").waitFor();
    await button(page, "Edit profile name").click();
    const name = page.getByRole("textbox", { name: "Profile name", exact: true });
    await name.waitFor();
    if (section === "water") await name.fill("Inline draft");
    else assert.equal(await name.isEditable(), false);
    await page.evaluate(() => window.__releaseEditorWrite());
    await button(page, "Save profile name").waitFor();
    assert.equal(await name.isEditable(), true);
    assert.equal(await name.inputValue(), section === "water" ? "Inline draft" : "Journal fixture");
    assert.equal(await button(page, "Goals").getAttribute("aria-pressed"), "true");
    await name.fill("Final inline name");
    await button(page, "Save profile name").click();
    await name.waitFor({ state: "detached" });
    assert.equal((await stored(page)).answers.name, "Final inline name");
    assert.equal(await page.evaluate(() => window.__editorWriteCount), 1);
  }
});

test("pending inline name save blocks duplicates while section navigation stays available", async (t) => {
  const page = await open(t);
  await profile(page);
  await button(page, "Edit profile name").click();
  const name = page.getByRole("textbox", { name: "Profile name", exact: true });
  await name.fill("Pending inline name");
  await delayWrite(page, profileKey);
  await name.press("Enter");
  await button(page, "Saving profile name…").waitFor();
  assert.equal(await name.isEditable(), false);
  assert.equal(await button(page, "Saving profile name…").isDisabled(), true);
  assert.equal(await button(page, "Cancel name editing").isDisabled(), true);
  await button(page, "Photos").click();
  await page.getByText("Your photo journal starts here.", { exact: true }).waitFor();
  await page.evaluate(() => window.__releaseEditorWrite());
  await name.waitFor({ state: "detached" });
  assert.equal(await button(page, "Photos").getAttribute("aria-pressed"), "true");
  assert.equal((await stored(page)).answers.name, "Pending inline name");
  assert.equal(await page.evaluate(() => window.__editorWriteCount), 1);
});

test("section controls stay responsive during pending water and profile saves", async (t) => {
  for (const section of ["water", "name"]) {
    const page = await open(t);
    await profile(page);
    await button(page, "Goals").click();
    if (section === "water") await button(page, "Edit water goal").click();
    else await editDetail(page, "name");
    const sourceField = page.getByRole("textbox", {
      name: section === "water" ? "Daily water goal (ml)" : "Your name (optional)",
      exact: true,
    });
    await sourceField.fill(section === "water" ? "2000" : "Pending name");
    await delayWrite(page, section === "water" ? "kinevault-track.water-goal.v1" : profileKey);
    await button(page, section === "water" ? "Save water goal" : "Save name").click();
    await button(page, section === "water" ? "Saving water goal…" : "Saving…").waitFor();
    for (const destination of ["Photos", "Overview", "Goals"]) {
      assert.equal(await button(page, destination).isEnabled(), true);
      await button(page, destination).click();
      assert.equal(await button(page, destination).getAttribute("aria-pressed"), "true");
      assert.equal(
        await page.getByTestId("profile-section").getAttribute("aria-label"),
        `${destination} section`,
      );
    }
    const replacement = section === "water" ? "name" : "water";
    if (replacement === "name") await editDetail(page, "name");
    else await button(page, "Edit water goal").click();
    const draft = page.getByRole("textbox", {
      name: replacement === "name" ? "Your name (optional)" : "Daily water goal (ml)",
      exact: true,
    });
    await draft.fill(replacement === "name" ? "Replacement after navigation" : "2345");
    await page.evaluate(() => window.__releaseEditorWrite());
    if (section === "water") await expectGoal(page, "water", "2,500 / 2,000 ml");
    else await page.getByRole("heading", { name: "Pending name", exact: true }).waitFor();
    assert.equal(
      await draft.inputValue(),
      replacement === "name" ? "Replacement after navigation" : "2345",
    );
  }
});

async function installHardwareBackBoundary(page) {
  await page.evaluate(() => {
    const definition = [...globalThis.__r.getModules().values()].find((module) =>
      String(module.verboseName).includes("react-native-web/dist/exports/BackHandler/"),
    );
    if (!definition) throw new Error("The installed native Back event boundary was not found");
    const backHandler = definition.publicModule.exports.default;
    const listeners = [];
    // Web has no Android OS events. Replace only that boundary; actual AppHeader
    // subscriptions, dismissal callbacks and Expo route changes remain in use.
    backHandler.addEventListener = (event, listener) => {
      if (event !== "hardwareBackPress") throw new Error(`Unexpected Back event ${event}`);
      listeners.push(listener);
      return {
        remove() {
          const index = listeners.indexOf(listener);
          if (index >= 0) listeners.splice(index, 1);
        },
      };
    };
    window.__pressHardwareBack = () => [...listeners].reverse().some((listener) => listener());
    window.__hardwareBackListenerCount = () => listeners.length;
  });
}
const hardwareBack = (page) => page.evaluate(() => window.__pressHardwareBack());

test("Profile hardware Back boundary returns every source tab and retains its selected day", async (t) => {
  for (const [tab, path] of [
    ["Home", "/"],
    ["Food", "/food"],
    ["Exercise", "/exercise"],
    ["Settings", "/settings"],
  ]) {
    const page = await open(t, { developmentRuntime: true });
    await installHardwareBackBoundary(page);
    await button(page, "Expand calendar").click();
    await button(page, "Select previous day").click();
    if (tab !== "Home") await page.getByRole("tab", { name: tab, exact: true }).click();
    await profile(page);
    assert.equal(await button(page, "Expand calendar").count(), 0);
    assert.equal(await button(page, "Collapse calendar").count(), 0);
    assert.equal(await hardwareBack(page), true);
    await page.waitForURL(new URL(path, page.url()).href);
    if (tab === "Settings") await page.getByRole("tab", { name: "Home", exact: true }).click();
    await page.getByLabel("Saturday, October 3, 2026", { exact: true }).waitFor();
    await button(page, "Expand calendar").waitFor();
  }
});

test("Profile Back dismisses dropdown before returning to its source tab", async (t) => {
  const page = await open(t, { developmentRuntime: true });
  await installHardwareBackBoundary(page);
  await page.getByRole("tab", { name: "Food", exact: true }).click();
  await profile(page);
  await button(page, "Profile menu").click();
  assert.equal(await hardwareBack(page), true);
  await page
    .getByRole("menu", { name: "Profile menu", exact: true })
    .waitFor({ state: "detached" });
  assert.equal(new URL(page.url()).pathname, "/profile");
  await button(page, "Profile menu").click();
  const friends = page.getByRole("menuitem", { name: "Friends · Upcoming", exact: true });
  assert.equal(await friends.isDisabled(), true);
  await friends.evaluate((element) => element.click());
  assert.equal(await page.getByRole("dialog").count(), 0);
  assert.equal(await hardwareBack(page), true);
  await page
    .getByRole("menu", { name: "Profile menu", exact: true })
    .waitFor({ state: "detached" });
  assert.equal(new URL(page.url()).pathname, "/profile");
  assert.equal(await hardwareBack(page), true);
  await page.waitForURL(new URL("/food", page.url()).href);
});

test("direct Profile Back uses Home fallback after dismissing an open menu", async (t) => {
  const page = await open(t, { developmentRuntime: true });
  await page.goto(new URL("/profile", page.url()).href);
  await button(page, "Overview").waitFor();
  await installHardwareBackBoundary(page);
  await button(page, "Profile menu").click();
  assert.equal(await hardwareBack(page), true);
  await page
    .getByRole("menu", { name: "Profile menu", exact: true })
    .waitFor({ state: "detached" });
  assert.equal(new URL(page.url()).pathname, "/profile");
  assert.equal(await hardwareBack(page), true);
  await page.waitForURL(new URL("/", page.url()).href);
  await page.getByLabel("Sunday, October 4, 2026, today", { exact: true }).waitFor();
});

test("Profile chart menus close on tab blur and do not consume another tab's Back", async (t) => {
  const page = await open(t, { developmentRuntime: true });
  await installHardwareBackBoundary(page);
  for (const label of ["Workout range", "Choose exercise"]) {
    await profile(page);
    await page.waitForFunction(() => window.__hardwareBackListenerCount() === 1);
    if (label === "Choose exercise") await button(page, "Exercise weight").click();
    const trigger = button(page, label);
    await trigger.click();
    await page.waitForFunction(() => window.__hardwareBackListenerCount() === 2);
    assert.equal(await trigger.getAttribute("aria-expanded"), "true");
    // Route through the real tab without pointer/focus dismissal, as native
    // navigation or a programmatic route change would do.
    await page.getByRole("tab", { name: "Food", exact: true }).evaluate((el) => el.click());
    await page.waitForURL("**/food");
    await page.waitForFunction(() => window.__hardwareBackListenerCount() === 0);
    assert.equal(await hardwareBack(page), false, "hidden chart menus cannot handle Back");
    await profile(page);
    await page.waitForFunction(() => window.__hardwareBackListenerCount() === 1);
    assert.equal(await trigger.getAttribute("aria-expanded"), "false");
    await trigger.click();
    await page.waitForFunction(() => window.__hardwareBackListenerCount() === 2);
    assert.equal(await hardwareBack(page), true);
    await page.waitForFunction(() => window.__hardwareBackListenerCount() === 1);
    assert.equal(await trigger.getAttribute("aria-expanded"), "false");
    assert.equal(new URL(page.url()).pathname, "/profile");
    assert.equal(await hardwareBack(page), true);
    await page.waitForURL("**/food");
  }
});

test("Profile chart menus dismiss when pointer or keyboard focus leaves them", async (t) => {
  const page = await open(t);
  await profile(page);
  const trigger = button(page, "Workout range");
  await trigger.click();
  await button(page, "Overview").click();
  assert.equal(await trigger.getAttribute("aria-expanded"), "false");
  await trigger.click();
  await button(page, "Goals").focus();
  assert.equal(await trigger.getAttribute("aria-expanded"), "false");
  assert.equal(await button(page, "Overview").getAttribute("aria-pressed"), "true");
});

// Opt-in screenshots use isolated browser storage, never the user's saved records.
test(
  "capture the approved journal with reference content",
  { skip: !process.env.KINE_PROFILE_VISUAL_DIR },
  async (t) => {
    const page = await open(t, {
      appearance: "dark",
      answers: {
        ...answers,
        name: "Alex Morgan",
        age: "29",
        weight: "78",
        goal: "gain",
        customCalories: "2400",
        customCarbs: "300",
        customProtein: "150",
        customFat: "67",
      },
    });
    await page.setViewportSize({ width: 380, height: 766 });
    await page.evaluate(async () => {
      const date = (offset) => {
        const d = new Date(2026, 9, 4);
        d.setDate(d.getDate() + offset);
        return [
          d.getFullYear(),
          String(d.getMonth() + 1).padStart(2, "0"),
          String(d.getDate()).padStart(2, "0"),
        ].join("-");
      };
      const days = {};
      for (let i = 0; i < 12; i++) days[date(-i)] = i ? 250 : 1800;
      for (let i = 45; i < 73; i++) days[date(-i)] = 250;
      window.accountFixture.setItem(
        "kinevault-track.water-log.v1",
        JSON.stringify({ version: 1, days }),
      );
      window.accountFixture.setItem(
        "kinevault-track.water-goal.v1",
        JSON.stringify({ version: 1, dailyMl: 2500 }),
      );
      window.accountFixture.setItem(
        "kinevault-track.food-log.v1",
        JSON.stringify({
          version: 1,
          days: {
            "2026-10-04": [
              {
                id: "sample",
                fdcId: 1,
                name: "Sample",
                meal: "breakfast",
                grams: 100,
                calories: 1746,
                carbs: 214,
                protein: 128,
                fat: 42,
              },
            ],
          },
        }),
      );
      const sessions = [
        7900, 8400, 8100, 9700, 9200, 10800, 10300, 12100, 11700, 13600, 14200, 15240,
      ].map((volume, i) => ({
        id: "visual-session-" + i,
        date: date(-(11 - i) * 7),
        name: "Lifting",
        status: "completed",
        startedAt: null,
        durationSeconds: 1800,
        exercises: [
          {
            id: "visual-row-" + i,
            exercise: {
              id: "squat",
              name: "Barbell squat",
              tracking: "single",
              muscleGroup: "",
              equipment: "",
              notes: "",
            },
            sets: [
              {
                id: "visual-set-" + i,
                kind: "single",
                reps: "100",
                weightKg: String(volume / 100),
              },
            ],
          },
        ],
      }));
      window.accountFixture.setItem(
        "kinevault-track.exercise.v1",
        JSON.stringify({
          version: 1,
          exercises: [],
          workouts: [],
          sessions,
          developmentExamplesSeeded: true,
        }),
      );
      const c = document.createElement("canvas");
      c.width = 320;
      c.height = 180;
      const x = c.getContext("2d");
      x.fillStyle = "#25313d";
      x.fillRect(0, 0, 320, 180);
      x.fillStyle = "#b0bdca";
      x.textAlign = "center";
      x.font = "22px FontAwesome6Free-Solid";
      x.fillText("\uf03e", 160, 88);
      x.font = "9px Comfortaa_400Regular";
      x.fillText("Progress photo", 160, 110);
      const blob = await new Promise((resolve) => c.toBlob(resolve, "image/jpeg", 0.95));
      const db = await new Promise((resolve, reject) => {
        const r = indexedDB.open("kinevault-track.profile-media-files.v1", 1);
        r.onupgradeneeded = () => r.result.createObjectStore("photos", { keyPath: "id" });
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      await new Promise((resolve, reject) => {
        const tx = db.transaction("photos", "readwrite");
        for (const id of ["visual-image-aug", "visual-image-sep", "visual-image-oct"])
          tx.objectStore("photos").put({ id, original: blob, thumbnail: blob });
        tx.oncomplete = resolve;
        tx.onabort = () => reject(tx.error);
      });
      db.close();
      window.accountFixture.setItem(
        "kinevault-track.profile-media.v1",
        JSON.stringify({
          version: 1,
          avatar: null,
          photos: [
            {
              id: "visual-photo-oct",
              date: "2026-10-04",
              note: "Front view\nFeeling consistent with training.",
              image: { id: "visual-image-oct", width: 320, height: 180 },
            },
            {
              id: "visual-photo-aug",
              date: "2026-08-23",
              note: "Front view\nStarting point.",
              image: { id: "visual-image-aug", width: 320, height: 180 },
            },
            {
              id: "visual-photo-sep",
              date: "2026-09-13",
              note: "Front view\nThree weeks into training.",
              image: { id: "visual-image-sep", width: 320, height: 180 },
            },
          ],
        }),
      );
    });
    await page.goto(baseURL + "/profile");
    await page.getByText("15,240", { exact: true }).waitFor();
    await page.getByRole("img", { name: "Progress photo 2026-10-04", exact: true }).waitFor();
    const dir = process.env.KINE_PROFILE_VISUAL_DIR;
    await mkdir(dir, { recursive: true });
    await page.screenshot({ path: path.join(dir, "overview.png") });
    await button(page, "Edit profile name").click();
    await page.getByRole("textbox", { name: "Profile name", exact: true }).waitFor();
    await page.screenshot({ path: path.join(dir, "name-editing.png") });
    await button(page, "Cancel name editing").click();
    await page.getByTestId("profile-workout-chart").evaluate((el) => {
      let parent = el.parentElement;
      while (parent && !["auto", "scroll"].includes(getComputedStyle(parent).overflowY))
        parent = parent.parentElement;
      parent.scrollTop += el.getBoundingClientRect().top - 53;
    });
    await page.screenshot({ path: path.join(dir, "overview-scrolled.png") });
    await expectComparison(page, "2026-08-23", "2026-10-04");
    await page.getByTestId("profile-recent-photos").scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(dir, "overview-comparison.png") });
    await button(page, "Goals").click();
    await button(page, "Change profile photo").scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(dir, "goals.png") });
    await button(page, "Photos").click();
    await page.getByRole("img", { name: "Progress photo 2026-10-04", exact: true }).waitFor();
    const carousel = page.getByTestId("profile-photo-carousel");
    await carousel.scrollIntoViewIfNeeded();
    await carousel.evaluate((element) => {
      element.scrollLeft = 0;
    });
    await page.screenshot({ path: path.join(dir, "photos.png") });
    await carousel.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
    });
    await page.screenshot({ path: path.join(dir, "photos-scrolled.png") });
  },
);

test("weekly chart selection matches the plotted total and range menu closes with Escape", async (t) => {
  const page = await open(t);
  await profile(page);
  await page.evaluate(() => {
    const key = "kinevault-track.exercise.v1",
      doc = JSON.parse(window.accountFixture.getItem(key));
    doc.sessions.push({
      ...doc.sessions[0],
      id: "earlier",
      date: "2026-10-02",
      exercises: [
        {
          ...doc.sessions[0].exercises[0],
          sets: [
            {
              id: "earlier-set",
              kind: "sides",
              left: { reps: "5", weightKg: "10" },
              right: { reps: "5", weightKg: "10" },
            },
          ],
        },
      ],
    });
    window.accountFixture.setItem(key, JSON.stringify(doc));
  });
  await page.reload();
  await button(page, "Workout range").click();
  await button(page, "4 weeks").click();
  assert.equal(await button(page, "Workout range").getAttribute("aria-expanded"), "false");
  const graph = button(page, "Select workout graph point"),
    bounds = await graph.boundingBox();
  await graph.click({ position: { x: bounds.width - 12, y: 50 } });
  await page.getByText("Week ending 2026-10-04: 250 kg x reps", { exact: true }).waitFor();
  assert.equal(
    await page.getByText("Week ending 2026-10-04: 250 kg x reps", { exact: true }).count(),
    1,
  );
  await button(page, "Workout range").click();
  await page.keyboard.press("Escape");
  assert.equal(await button(page, "Workout range").getAttribute("aria-expanded"), "false");
  assert.equal(
    await button(page, "Workout range").evaluate((el) => el === document.activeElement),
    true,
    "Escape restores the menu trigger's keyboard focus",
  );
  assert.ok(page.url().endsWith("/profile"));
});
