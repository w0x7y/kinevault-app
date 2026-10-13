import assert from "node:assert/strict";
import test from "node:test";
import { installAccountFixture } from "./helpers/account-fixture.mjs";
import { launchBrowser } from "./helpers/browser.mjs";

const baseURL = process.env.KINE_PREVIEW_URL || "http://localhost:8081";
const storageKey = "kinevault-track.exercise.v1";
const time = new Date("2026-10-04T12:00:00+03:00");
const answers = {
  name: "Demo fixture",
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
const pressId = "3f1c2b9e-8a4d-4c1e-9b7a-2d5e6f708192";
const raiseId = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
const credit =
  "Demonstration: KineVault. Anatomy: Z-Anatomy (CC BY-SA 4.0); BodyParts3D © DBCLS (CC BY-SA 2.1 JP).";
const catalog = [
  {
    id: pressId,
    slug: "dumbbell-shoulder-press",
    name: "Dumbbell shoulder press",
    aliases: ["DB overhead press"],
    muscle_group: "Shoulders",
    equipment: "Dumbbell",
    status: "published",
    video_path: `${pressId}/0123456789abcdef.mp4`,
    poster_path: `${pressId}/fedcba9876543210.webp`,
    credit,
  },
  {
    id: raiseId,
    slug: "cable-lateral-raise",
    name: "Cable lateral raise",
    aliases: [],
    muscle_group: "Shoulders",
    equipment: "Cable",
    status: "withdrawn",
    video_path: null,
    poster_path: null,
    credit,
  },
];
const squat = {
  id: "squat",
  name: "Squat",
  muscleGroup: "Legs",
  equipment: "Barbell",
  notes: "",
  tracking: "single",
};
const press = {
  ...squat,
  id: "press",
  name: "Shoulder press",
  muscleGroup: "Shoulders",
  equipment: "Dumbbells",
  catalog: { id: pressId, slug: "dumbbell-shoulder-press" },
};
const raise = {
  ...squat,
  id: "raise",
  name: "Lateral raise",
  catalog: { id: raiseId, slug: "cable-lateral-raise" },
};
const historical = (exercises) => ({
  id: "history",
  date: "2026-10-04",
  name: "Historical workout",
  status: "completed",
  startedAt: null,
  durationSeconds: 1020,
  exercises: exercises.map((exercise) => ({
    id: `${exercise.id}-row`,
    exercise,
    sets: [{ id: `${exercise.id}-set`, kind: "single", reps: "5", weightKg: "40" }],
  })),
});
const documentWith = (exercises, extra = {}) => ({
  version: 1,
  exercises,
  workouts: [],
  sessions: [],
  developmentExamplesSeeded: true,
  ...extra,
});
const button = (scope, name) => scope.getByRole("button", { name, exact: true });
const field = (scope, name) => scope.getByRole("textbox", { name, exact: true });

async function open(t, document, fixtureState = {}) {
  const browser = await launchBrowser();
  t.after(() => browser.close());
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    timezoneId: "Asia/Jerusalem",
  });
  await context.addInitScript(
    ({ answers, key, raw }) => {
      if (!sessionStorage.getItem("demo-fixture-seeded")) {
        localStorage.setItem(
          "kinevault-track.profile.v1",
          JSON.stringify({ version: 1, kind: "complete", answers }),
        );
        localStorage.setItem(key, raw);
        sessionStorage.setItem("demo-fixture-seeded", "true");
      }
    },
    { answers, key: storageKey, raw: JSON.stringify(document) },
  );
  const fixture = await installAccountFixture(context);
  Object.assign(fixture, { catalog }, fixtureState);
  const page = await context.newPage();
  const runtimeErrors = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    // Deliberate 404/503 fixture responses are transport failures, not app errors.
    if (
      message.type() === "error" &&
      !(
        message.location().url.includes("kkywpvkckxniriatelta.supabase.co") &&
        message.text().startsWith("Failed to load resource:")
      )
    )
      runtimeErrors.push(message.text());
  });
  t.after(() => assert.deepEqual(runtimeErrors, [], "Demo flows should not emit runtime errors"));
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(30000);
  await page.clock.install({ time });
  await page.goto(`${baseURL}/exercise`);
  await page.getByTestId("exercise-search-actions").waitFor();
  return { page, fixture };
}

async function openHistoricalWorkout(page) {
  await button(page, "Saved workouts").click();
  await button(
    page.getByTestId("workout-library"),
    "Edit logged workout Historical workout",
  ).click();
  await page.getByTestId("completed-workout-workspace").waitFor();
  return page.getByTestId("session-editor");
}

test("a linked exercise plays its demo from the workout detail", async (t) => {
  const { page } = await open(t, documentWith([press], { sessions: [historical([press])] }));
  const editor = await openHistoricalWorkout(page);
  await editor.getByText(credit, { exact: true }).waitFor();
  assert.equal(
    await editor
      .getByText("Exercise videos are upcoming with KineVault studio integration.")
      .count(),
    0,
  );
  await button(editor, "Play demonstration of Shoulder press").click();
  await page.waitForFunction(() => {
    const video = document.querySelector("video");
    const source = video?.currentSrc || video?.src || video?.querySelector("source")?.src || "";
    return source.includes("/storage/v1/object/public/exercise-demos/");
  });
});

test("withdrawn demos are unavailable and failed media can be retried", async (t) => {
  const { page, fixture } = await open(
    t,
    documentWith([press, raise], { sessions: [historical([raise, press])] }),
    { demoMediaFailure: true },
  );
  const editor = await openHistoricalWorkout(page);
  await editor.getByText("Demonstration unavailable.", { exact: true }).waitFor();
  assert.equal(await button(editor, "Link a KineVault demo to Lateral raise").count(), 0);
  await button(editor, "Select exercise Shoulder press").click();
  await editor
    .getByText("Couldn't load this demonstration. Check your connection and try again.", {
      exact: true,
    })
    .waitFor();
  fixture.demoMediaFailure = false;
  await button(editor, "Retry loading the demonstration").click();
  await button(editor, "Play demonstration of Shoulder press").waitFor();
});

test("an unlinked exercise offers Link demo in the workout but not in the template", async (t) => {
  const template = {
    id: "upper",
    name: "Upper",
    exercises: [press, squat],
    setCounts: { press: 3, squat: 3 },
  };
  const { page } = await open(
    t,
    documentWith([press, squat], { workouts: [template], sessions: [historical([squat])] }),
  );
  const editor = await openHistoricalWorkout(page);
  await button(editor, "Link a KineVault demo to Squat").waitFor();
  await button(page, "Saved workouts").click();
  await button(page.getByTestId("workout-library"), "Edit workout Upper").click();
  const form = page.getByTestId("workout-form");
  await button(form, "Play demonstration of Shoulder press").waitFor();
  await button(form, "Select exercise Squat").click();
  assert.equal(await button(form, "Link a KineVault demo to Squat").count(), 0);
});

test("linked exercises show a poster thumbnail in search", async (t) => {
  const { page } = await open(t, documentWith([press, squat]));
  await field(page, "Search exercises").fill("s");
  await button(page, "Edit exercise Shoulder press")
    .getByTestId("exercise-demo-thumbnail")
    .waitFor();
  assert.equal(
    await button(page, "Edit exercise Squat").getByTestId("exercise-demo-thumbnail").count(),
    0,
  );
  assert.equal(
    await page.getByText("Exercise videos are upcoming with KineVault studio integration.").count(),
    0,
  );
});

test("linking from the form fills blank fields and saves the link", async (t) => {
  const { page } = await open(t, documentWith([squat]));
  await button(page, "Create Exercise").click();
  const form = page.getByTestId("exercise-form");
  await field(form, "Exercise name").fill("Overhead press");
  await field(form, "Find in KineVault").fill("db overhead");
  await form.getByText("1 KineVault exercise found.", { exact: true }).waitFor();
  await button(form, "Link Dumbbell shoulder press").click();
  assert.equal(await field(form, "Exercise name").inputValue(), "Overhead press");
  assert.equal(await field(form, "Muscle group (optional)").inputValue(), "Shoulders");
  assert.equal(await field(form, "Equipment (optional)").inputValue(), "Dumbbell");
  await form.getByText("Linked to Dumbbell shoulder press", { exact: true }).waitFor();
  await button(form, "Play demonstration of Overhead press").waitFor();
  await button(form, "Save exercise").click();
  await page.waitForFunction(
    (key) =>
      JSON.parse(window.accountFixture.getItem(key)).exercises.some(
        (exercise) => exercise.catalog?.slug === "dumbbell-shoulder-press",
      ),
    storageKey,
  );
});

test("Unlink removes the link and Change keeps it until another is chosen", async (t) => {
  const { page } = await open(t, documentWith([press]));
  await field(page, "Search exercises").fill("shoulder");
  await button(page, "Edit exercise Shoulder press").click();
  const form = page.getByTestId("exercise-form");
  await button(form, "Change KineVault demo").click();
  await button(form, "Keep current demo").click();
  await form.getByText("Linked to Dumbbell shoulder press", { exact: true }).waitFor();
  await button(form, "Unlink KineVault demo").click();
  await field(form, "Find in KineVault").waitFor();
  await button(form, "Save exercise").click();
  await page.waitForFunction(
    (key) => !("catalog" in JSON.parse(window.accountFixture.getItem(key)).exercises[0]),
    storageKey,
  );
});

test("Link demo opens the form at its search and returns to the workout", async (t) => {
  const { page } = await open(t, documentWith([squat], { sessions: [historical([squat])] }));
  await page.setViewportSize({ width: 390, height: 640 });
  const editor = await openHistoricalWorkout(page);
  await field(editor, "Squat set 1 reps").fill("6");
  await button(editor, "Link a KineVault demo to Squat").click();
  const form = page.getByTestId("exercise-form");
  const search = field(form, "Find in KineVault");
  await search.waitFor();
  assert.equal(await search.evaluate((element) => element === document.activeElement), true);
  // The search is only reachable when the screen scrolls to it; the scroll area
  // ends above the tab bar, so compare against every clipping ancestor.
  const inView = () =>
    search.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      let top = 0;
      let bottom = window.innerHeight;
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        if (!/auto|scroll|hidden/.test(getComputedStyle(parent).overflowY)) continue;
        const bounds = parent.getBoundingClientRect();
        top = Math.max(top, bounds.top);
        bottom = Math.min(bottom, bounds.bottom);
      }
      return rect.top >= top && rect.bottom <= bottom;
    });
  await page.waitForTimeout(500);
  assert.equal(await inView(), true, "The KineVault search should be scrolled into view");
  await search.fill("shoulder press");
  await button(form, "Link Dumbbell shoulder press").click();
  assert.equal(await field(form, "Exercise name").inputValue(), "Squat");
  await button(form, "Save exercise").click();
  const returned = page.getByTestId("session-editor");
  await page.getByTestId("completed-workout-workspace").waitFor();
  assert.equal(await field(returned, "Squat set 1 reps").inputValue(), "6");
  await button(returned, "Play demonstration of Squat").waitFor();
});

test("a failed catalog load offers Retry in the form", async (t) => {
  const { page, fixture } = await open(t, documentWith([squat]), { catalogFailure: true });
  await button(page, "Create Exercise").click();
  const form = page.getByTestId("exercise-form");
  await form.getByText("Connect to search KineVault demos.", { exact: true }).waitFor();
  fixture.catalogFailure = false;
  await button(form, "Retry loading KineVault demos").click();
  await field(form, "Find in KineVault").waitFor();
});
