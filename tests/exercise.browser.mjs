import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";

const baseURL = process.env.KINE_PREVIEW_URL || "http://localhost:8081";
const storageKey = "kinevault-track.exercise.v1";
const date = "2026-10-04";
const time = new Date("2026-10-04T12:00:00+03:00");
const answers = { name: "Exercise fixture", goal: "maintain", activity: "moderate", age: "30", height: "180", weight: "80",
  sex: "male", estimateEnabled: true, eligible: true, customCalories: "" };
const single = { id: "squat", name: "Squat", muscleGroup: "Legs", equipment: "Barbell", notes: "", tracking: "single" };
const sides = { id: "curl", name: "Curl", muscleGroup: "Arms", equipment: "Dumbbells", notes: "", tracking: "sides" };
const empty = () => ({ version: 1, exercises: [], workouts: [], sessions: [] });
const button = (page, name) => page.getByRole("button", { name, exact: true });
const field = (page, name) => page.getByRole("textbox", { name, exact: true });
const documentFrom = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
async function storedWhen(page, predicate, argument) {
  await page.waitForFunction(({ key, predicate, argument }) => {
    const raw = localStorage.getItem(key);
    return raw !== null && new Function("document", "argument", `return (${predicate})(document, argument)`)(JSON.parse(raw), argument);
  }, { key: storageKey, predicate: predicate.toString(), argument });
  return documentFrom(page);
}

async function openLoggedWorkout(page, name, completed = false) {
  await button(page, "Saved workouts").click();
  await button(page.getByTestId("workout-library"), `${completed ? "Edit" : "Open"} logged workout ${name}`).click();
}

async function open(t, { document = empty(), raw, foodRaw, failure = false, freeze = false, developmentExamples = false, path = "/exercise" } = {}) {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Asia/Jerusalem" });
  await context.addInitScript(({ answers, key, raw, foodRaw, failure }) => {
    if (!sessionStorage.getItem("exercise-fixture-seeded")) {
      localStorage.setItem("kinevault-track.profile.v1", JSON.stringify({ version: 1, kind: "complete", answers }));
      localStorage.setItem(key, raw);
      if (foodRaw !== undefined) localStorage.setItem("kinevault-track.food-log.v1", foodRaw);
      sessionStorage.setItem("exercise-fixture-seeded", "true");
    }
    window.__exerciseWriteFailure = failure;
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(keyToSet, value) {
      if (keyToSet === key && window.__exerciseWriteFailure) throw new Error("Fixture exercise write failure");
      return setItem.call(this, keyToSet, value);
    };
  }, { answers, key: storageKey, raw: raw ?? JSON.stringify(developmentExamples ? document : { ...document, developmentExamplesSeeded: true }), foodRaw, failure });
  const page = await context.newPage();
  const runtimeErrors = [];
  page.on("pageerror", error => runtimeErrors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error") runtimeErrors.push(message.text());
  });
  t.after(() => assert.deepEqual(runtimeErrors, [], "Exercise flows should not emit runtime errors"));
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(30000);
  await page.clock.install({ time: freeze ? new Date(time.getTime() - 60000) : time });
  await page.goto(`${baseURL}${path}`);
  await (path === "/" ? page.locator('[data-testid="home-workout"], [data-testid="home-workout-empty"]') : page.getByTestId("exercise-search-actions")).waitFor();
  if (freeze) await page.clock.pauseAt(time);
  return page;
}

test("Home aggregates completed same-day sessions and side sets while ignoring planned and other-day records", async t => {
  const morning = { id: "morning", date, name: "Morning", status: "completed", startedAt: null, durationSeconds: 600,
    exercises: [{ id: "squat-row", exercise: single, sets: [{ id: "set1", kind: "single", reps: "5", weightKg: "40" }] }] };
  const evening = { ...morning, id: "evening", name: "Evening", durationSeconds: 300,
    exercises: [{ id: "curl-row", exercise: sides, sets: [{ id: "set2", kind: "sides", left: { reps: "8", weightKg: "10" }, right: { reps: "6", weightKg: "12" } }] }] };
  const page = await open(t, { path: "/", document: { version: 1, exercises: [single, sides], workouts: [], sessions: [morning, evening,
    { ...morning, id: "planned", status: "planned", durationSeconds: null }, { ...morning, id: "yesterday", date: "2026-10-03" }] } });
  const widget = page.getByTestId("home-workout");
  await widget.getByText("352 kg", { exact: true }).waitFor();
  assert.equal(await widget.getByText("15 min", { exact: true }).count(), 1);
  assert.equal(await widget.getByText("19", { exact: true }).count(), 1);
  assert.equal(await widget.getByText("2", { exact: true }).count(), 1);
});

test("unreadable exercise data shows recovery without hiding known food totals", async t => {
  const page = await open(t, { path: "/", raw: "{broken" });
  await button(page, "Retry workouts").waitFor();
  assert.match(await page.getByTestId("home-workout").innerText(), /Couldn't load your workouts/);
  assert.equal(await page.getByTestId("home-workout").getByText("0 kg", { exact: true }).count(), 0);
  await page.evaluate(({ key, document }) => localStorage.setItem(key, JSON.stringify(document)), { key: storageKey, document: empty() });
  await button(page, "Retry workouts").click();
  await page.getByTestId("home-workout-empty").waitFor();
});

test("Home keeps workout totals and independent recovery visible when Food storage is corrupt", async t => {
  const session = { id: "complete", date, name: "Training", status: "completed", startedAt: null, durationSeconds: null,
    exercises: [{ id: "squat-row", exercise: single, sets: [{ id: "set", kind: "single", reps: "5", weightKg: "40" }] }] };
  const page = await open(t, { path: "/", foodRaw: "{broken", document: { ...empty(), exercises: [single], sessions: [session] } });
  await page.getByTestId("home-workout").getByText("200 kg", { exact: true }).waitFor();
  assert.equal(await page.getByTestId("home-workout").getByText("Not recorded", { exact: true }).count(), 1);
  await page.evaluate(key => localStorage.setItem(key, "{broken"), storageKey);
  await page.reload();
  await button(page, "Retry workouts").waitFor();
});

test("active timer restores elapsed time and drafts after reload and remains visible on another selected date", async t => {
  const startedAt = time.getTime() - 90000;
  const active = { id: "active", date, name: "Active training", status: "active", startedAt, durationSeconds: null,
    exercises: [{ id: "curl-row", exercise: sides, sets: [{ id: "set", kind: "sides", left: { reps: "8", weightKg: "10" }, right: { reps: "6", weightKg: "12" } }] }] };
  const page = await open(t, { freeze: true, document: { ...empty(), exercises: [sides], sessions: [active] } });
  const timer = page.getByTestId("active-workout-timer");
  await timer.waitFor();
  assert.match(await timer.innerText(), /1:30/);
  assert.equal(await page.getByTestId("exercise-workout").getByText("0 kg", { exact: true }).count(), 1);
  await page.clock.fastForward(31000);
  assert.match(await timer.innerText(), /2:01/);
  await page.clock.resume();
  await page.reload();
  await timer.waitFor();
  await page.clock.pauseAt(new Date(time.getTime() + 60000));
  assert.match(await timer.innerText(), /2:30/);
  assert.deepEqual((await documentFrom(page)).sessions[0], active);
  await button(page, "Expand calendar").click();
  await page.getByRole("button", { name: "Saturday, October 3, 2026", exact: true }).click();
  await button(page, "Collapse calendar").click();
  assert.equal(await timer.isVisible(), true);
  assert.match(await timer.innerText(), /Active training/);
  await page.getByTestId("exercise-workout-empty").waitFor();
  assert.equal(await page.getByTestId("exercise-workout").count(), 0);
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
  }
});

test("create exercises and ordered workouts, then add a planned session without starting a timer", async t => {
  const page = await open(t);
  assert.equal(await button(page, "Create Exercise").isEnabled(), true);
  for (const [name, tracking] of [["Curl", "Left and right"], ["Squat", "Single weight"]]) {
    await button(page, "Create Exercise").click();
    const form = page.getByTestId("exercise-form");
    await field(form, "Exercise name").fill(name);
    await button(form, tracking).click();
    await button(form, "Save exercise").click();
    await storedWhen(page, (document, name) => document.exercises.some(exercise => exercise.name === name), name);
  }
  await button(page, "Create Workouts").click();
  const form = page.getByTestId("workout-form");
  await field(form, "Workout name").fill("Upper day");
  await button(form, "Add Squat to workout").click();
  await button(form, "Add Curl to workout").click();
  await button(form, "Move Curl up").click();
  await button(form, "Save workout").click();
  let document = await storedWhen(page, document => document.workouts.length === 1);
  assert.deepEqual(document.workouts[0].exercises.map(exercise => exercise.name), ["Curl", "Squat"]);
  assert.equal(document.sessions.length, 0);
  await button(page, "Saved workouts").click();
  await button(page.getByTestId("workout-library"), "Add Upper day to selected day").click();
  document = await storedWhen(page, document => document.sessions.length === 1);
  assert.equal(document.sessions[0].date, date);
  assert.equal(document.sessions[0].status, "planned");
  assert.equal(document.sessions[0].startedAt, null);
  assert.deepEqual(document.sessions[0].exercises.map(row => row.exercise.name), ["Curl", "Squat"]);
  assert.equal(await page.getByTestId("active-workout-timer").count(), 0);
  await page.reload();
  await page.getByTestId("exercise-search-actions").waitFor();
  assert.equal((await documentFrom(page)).sessions[0].status, "planned");
});

test("manual completion saves independent side measurements and bodyweight and shares totals with Home", async t => {
  const planned = { id: "manual", date, name: "Strength", status: "planned", startedAt: null, durationSeconds: null,
    exercises: [{ id: "curl-row", exercise: sides, sets: [] }, { id: "squat-row", exercise: single, sets: [] }] };
  const page = await open(t, { document: { ...empty(), exercises: [single, sides], sessions: [planned] } });
  await openLoggedWorkout(page, "Strength");
  const editor = page.getByTestId("session-editor");
  await button(editor, "Add set to Curl").click();
  await field(editor, "Curl set 1 left reps").fill("8");
  await field(editor, "Curl set 1 left weight (kg)").fill("10");
  await field(editor, "Curl set 1 right reps").fill("6");
  await field(editor, "Curl set 1 right weight (kg)").fill("12");
  await button(editor, "Add set to Squat").click();
  await field(editor, "Squat set 1 reps").fill("5");
  await field(editor, "Duration in minutes (optional)").fill("10");
  await button(editor, "Log completed workout").click();
  const document = await storedWhen(page, document => document.sessions[0].status === "completed");
  assert.equal(document.sessions[0].durationSeconds, 600);
  assert.deepEqual(document.sessions[0].exercises[0].sets[0].left, { reps: "8", weightKg: "10" });
  assert.deepEqual(document.sessions[0].exercises[0].sets[0].right, { reps: "6", weightKg: "12" });
  assert.equal(document.sessions[0].exercises[1].sets[0].weightKg, "");
  await page.getByTestId("exercise-workout").getByText("152 kg", { exact: true }).waitFor();
  await page.getByRole("tab", { name: /Home/ }).click();
  const summary = page.getByTestId("home-workout");
  await summary.getByText("152 kg", { exact: true }).waitFor();
  assert.equal(await summary.getByText("19", { exact: true }).count(), 1);
  assert.equal(await summary.getByText("2", { exact: true }).count(), 1);
  await page.reload();
  await summary.getByText("152 kg", { exact: true }).waitFor();
});

test("exercise search edits definitions without adding them to a running or planned workout", async t => {
  const active = { id: "running", date, name: "Running workout", status: "active", startedAt: time.getTime() - 30000, durationSeconds: null, exercises: [] };
  const planned = { ...active, id: "later", name: "Later", status: "planned", startedAt: null };
  const page = await open(t, { document: { ...empty(), exercises: [sides], sessions: [active, planned] } });
  await field(page, "Search exercises").fill("Curl");
  await button(page, "Edit exercise Curl").click();
  await page.getByTestId("exercise-form").waitFor();
  assert.equal(await page.getByTestId("session-picker").count(), 0);
  assert.equal(await button(page, "New workout session").count(), 0);
  assert.deepEqual((await documentFrom(page)).sessions, [active, planned]);
});

test("the saved workout menu restores manual duration and starts a timed workout", async t => {
  const planned = { id: "draft", date, name: "Draft", status: "planned", startedAt: null, durationSeconds: null,
    exercises: [{ id: "squat-row", exercise: single, sets: [{ id: "set", kind: "single", reps: "5", weightKg: "" }] }] };
  const page = await open(t, { freeze: true, document: { ...empty(), exercises: [single], sessions: [planned] } });
  await openLoggedWorkout(page, "Draft");
  let editor = page.getByTestId("session-editor");
  await field(editor, "Duration in minutes (optional)").fill("invalid");
  await button(editor, "Close workout").click();
  await editor.getByRole("alert").waitFor();
  assert.equal(await field(editor, "Duration in minutes (optional)").inputValue(), "invalid");
  await field(editor, "Duration in minutes (optional)").fill("12.5");
  await button(editor, "Close workout").click();
  await editor.waitFor({ state: "detached" });
  assert.equal((await documentFrom(page)).sessions[0].durationSeconds, 750);
  await page.clock.resume();
  await page.reload();
  await page.getByTestId("exercise-search-actions").waitFor();
  await openLoggedWorkout(page, "Draft");
  editor = page.getByTestId("session-editor");
  assert.equal(await field(editor, "Duration in minutes (optional)").inputValue(), "12.5");
  await button(editor, "Close workout").click();
  await openLoggedWorkout(page, "Draft");
  await button(editor, "Start workout").click();
  const active = await storedWhen(page, document => document.sessions[0].status === "active");
  await page.getByTestId("active-workout-timer").waitFor();
  assert.equal(active.sessions[0].durationSeconds, null);
  await page.clock.fastForward(61000);
  await button(editor, "Finish workout").click();
  const completed = await storedWhen(page, document => document.sessions[0].status === "completed");
  assert.ok(completed.sessions[0].durationSeconds >= 61);
  assert.ok(completed.sessions[0].durationSeconds < 750);
});

test("logging starts from a saved workout and rejects incomplete measurements before completion", async t => {
  const template = { id: "template", name: "Quick workout", exercises: [single] };
  const page = await open(t, { document: { ...empty(), exercises: [single], workouts: [template] } });
  await button(page, "Saved workouts").click();
  await button(page, "Add Quick workout to selected day").click();
  const editor = page.getByTestId("session-editor");
  await button(editor, "Add set to Squat").click();
  await field(editor, "Squat set 1 reps").fill("1.5");
  await button(editor, "Log completed workout").click();
  await editor.getByRole("alert").first().waitFor();
  assert.equal((await documentFrom(page)).sessions[0].status, "planned");
  assert.equal(await field(editor, "Squat set 1 reps").inputValue(), "1.5");
  await field(editor, "Squat set 1 reps").fill("10");
  await button(editor, "Log completed workout").click();
  const document = await storedWhen(page, document => document.sessions[0].status === "completed");
  assert.equal(document.sessions[0].name, "Quick workout");
  assert.equal(document.sessions[0].durationSeconds, null);
  await page.getByTestId("exercise-workout").getByText("Not recorded", { exact: true }).waitFor();
});

test("failed active completion retains local edits and the running timer, then retry saves the current draft", async t => {
  const active = { id: "running", date, name: "Running workout", status: "active", startedAt: time.getTime() - 90000, durationSeconds: null,
    exercises: [{ id: "squat-row", exercise: single, sets: [{ id: "set", kind: "single", reps: "8", weightKg: "10" }] }] };
  const page = await open(t, { failure: true, document: { ...empty(), exercises: [single], sessions: [active] } });
  await button(page, "Open active workout").click();
  const editor = page.getByTestId("session-editor");
  await field(editor, "Squat set 1 reps").fill("12");
  await button(editor, "Finish workout").click();
  await editor.getByRole("alert").first().waitFor();
  assert.equal(await field(editor, "Squat set 1 reps").inputValue(), "12");
  assert.deepEqual((await documentFrom(page)).sessions[0], active);
  assert.equal(await page.getByTestId("active-workout-timer").isVisible(), true);
  await page.evaluate(() => { window.__exerciseWriteFailure = false; });
  await button(editor, "Finish workout").click();
  const document = await storedWhen(page, document => document.sessions[0].status === "completed");
  assert.equal(document.sessions[0].exercises[0].sets[0].reps, "12");
  assert.ok(document.sessions[0].durationSeconds >= 90);
  assert.equal(document.sessions[0].startedAt, active.startedAt);
  await page.getByTestId("exercise-workout").getByText("120 kg", { exact: true }).waitFor();
  assert.equal(await page.getByTestId("active-workout-timer").count(), 0);
});

test("library edits and confirmed deletion preserve historical snapshots and sessions remain editable", async t => {
  const completed = { id: "done", date, name: "Manual", status: "completed", startedAt: null, durationSeconds: null,
    exercises: [{ id: "squat-row", exercise: single, sets: [{ id: "set", kind: "single", reps: "5", weightKg: "40" }] }] };
  const workout = { id: "template", name: "Leg day", exercises: [single] };
  const page = await open(t, { document: { ...empty(), exercises: [single], workouts: [workout], sessions: [completed] } });
  await field(page, "Search exercises").fill("Squat");
  await button(page, "Edit exercise Squat").click();
  let form = page.getByTestId("exercise-form");
  await field(form, "Exercise name").fill("Front squat");
  await button(form, "Save exercise").click();
  let document = await storedWhen(page, document => document.exercises[0].name === "Front squat");
  assert.equal(document.sessions[0].exercises[0].exercise.name, "Squat");
  await button(page, "Edit exercise Front squat").click();
  form = page.getByTestId("exercise-form");
  await button(form, "Delete exercise").click();
  assert.equal((await documentFrom(page)).exercises.length, 1);
  await button(form, "Confirm delete exercise").click();
  document = await storedWhen(page, document => document.exercises.length === 0);
  assert.equal(document.sessions[0].exercises[0].exercise.name, "Squat");
  await button(page, "Saved workouts").click();
  await button(page.getByTestId("workout-library"), "Add Leg day to selected day").click();
  document = await storedWhen(page, document => document.sessions.length === 2);
  assert.equal(document.sessions[1].exercises[0].exercise.name, "Squat");
  await button(page, "Saved workouts").click();
  await button(page.getByTestId("workout-library"), "Edit workout Leg day").click();
  form = page.getByTestId("workout-form");
  await button(form, "Delete workout").click();
  await button(form, "Confirm delete workout").click();
  document = await storedWhen(page, document => document.workouts.length === 0);
  assert.equal(document.sessions.length, 2);
  await openLoggedWorkout(page, "Manual", true);
  const editor = page.getByTestId("session-editor");
  await field(editor, "Squat set 1 reps").fill("10");
  assert.equal((await documentFrom(page)).sessions[0].exercises[0].sets[0].reps, "5");
  await button(editor, "Save changes").click();
  document = await storedWhen(page, document => document.sessions[0].exercises[0].sets[0].reps === "10");
  await page.getByTestId("exercise-workout").getByText("400 kg", { exact: true }).waitFor();
  await button(page, "Saved workouts").click();
  await button(page, "Delete logged workout Manual").click();
  assert.equal((await documentFrom(page)).sessions.length, 2);
  await button(page, "Confirm delete logged workout").click();
  document = await storedWhen(page, document => document.sessions.length === 1);
  assert.equal(document.sessions[0].status, "planned");
});

test("completed workout edits survive exercise editing and menu navigation without saving early", async t => {
  const completed = { id: "done", date, name: "Manual", status: "completed", startedAt: null, durationSeconds: null,
    exercises: [{ id: "squat-row", exercise: single, sets: [{ id: "set", kind: "single", reps: "5", weightKg: "40" }] }] };
  const page = await open(t, { document: { ...empty(), exercises: [single], sessions: [completed] } });
  await openLoggedWorkout(page, "Manual", true);
  const editor = page.getByTestId("session-editor");
  await field(editor, "Workout name").fill("Updated workout");
  await field(editor, "Squat set 1 reps").fill("10");
  await field(editor, "Duration in minutes (optional)").fill("15");
  await field(page, "Search exercises").fill("Squat");
  await button(page, "Edit exercise Squat").click();
  await button(page.getByTestId("exercise-form"), "Cancel").click();
  await openLoggedWorkout(page, "Manual", true);
  assert.equal(await field(editor, "Workout name").inputValue(), "Updated workout");
  assert.equal(await field(editor, "Squat set 1 reps").inputValue(), "10");
  assert.equal(await field(editor, "Duration in minutes (optional)").inputValue(), "15");
  assert.deepEqual((await documentFrom(page)).sessions[0], completed);
  await button(editor, "Save changes").click();
  const document = await storedWhen(page, document => document.sessions[0].name === "Updated workout");
  assert.equal(document.sessions[0].exercises[0].sets[0].reps, "10");
  assert.equal(document.sessions[0].durationSeconds, 900);
});

test("empty days show an Add workout widget and planned workouts stay in the menu", async t => {
  const planned = { id: "draft", date, name: "Ready workout", status: "planned", startedAt: null, durationSeconds: null, exercises: [] };
  const page = await open(t, { document: { ...empty(), sessions: [planned] } });
  await page.getByTestId("exercise-workout-empty").waitFor();
  assert.equal(await button(page.getByTestId("exercise-workout-empty"), "Add workout").isEnabled(), true);
  for (const id of ["exercise-workout", "exercise-library", "session-list", "session-picker"]) assert.equal(await page.getByTestId(id).count(), 0);
  assert.equal(await page.getByRole("heading", { name: "Your exercises", exact: true }).count(), 0);
  assert.doesNotMatch(await page.locator("body").innerText(), /session/i);
  await button(page.getByTestId("exercise-workout-empty"), "Add workout").click();
  await button(page, "Open logged workout Ready workout").waitFor();
  await button(page, "Close saved workouts").click();
  await page.getByRole("tab", { name: /Home/ }).click();
  await page.getByTestId("home-workout-empty").waitFor();
  assert.equal(await page.getByTestId("home-workout").count(), 0);
  assert.equal(await button(page.getByTestId("home-workout-empty"), "Add workout").isEnabled(), true);
});

test("development seeds exactly three demo exercises once and preserves a deliberate deletion after reload", async t => {
  const page = await open(t, { developmentExamples: true });
  const seeded = await storedWhen(page, document => document.developmentExamplesSeeded === true);
  assert.deepEqual(seeded.exercises.map(exercise => exercise.name), ["Squat", "Push-up", "Dumbbell curl"]);
  assert.equal(seeded.exercises[2].tracking, "sides");
  assert.equal(seeded.workouts.length, 0);
  assert.equal(seeded.sessions.length, 0);
  await button(page, "Create Workouts").click();
  for (const name of ["Squat", "Push-up", "Dumbbell curl"]) await button(page, `Add ${name} to workout`).waitFor();
  await button(page.getByTestId("workout-form"), "Cancel").click();
  await field(page, "Search exercises").fill("Push-up");
  await button(page, "Edit exercise Push-up").click();
  await button(page, "Delete exercise").click();
  await button(page, "Confirm delete exercise").click();
  await storedWhen(page, document => document.exercises.length === 2);
  await page.reload();
  await page.getByTestId("exercise-search-actions").waitFor();
  assert.equal((await documentFrom(page)).exercises.length, 2);
});

test("a workout menu keeps its captured date when the calendar changes before logging", async t => {
  const template = { id: "template", name: "Leg day", exercises: [single] };
  const page = await open(t, { document: { ...empty(), exercises: [single], workouts: [template] } });
  await button(page, "Saved workouts").click();
  await button(page, "Expand calendar").click();
  await page.getByRole("button", { name: "Saturday, October 3, 2026", exact: true }).click();
  await button(page, "Collapse calendar").click();
  await button(page, "Add Leg day to selected day").click();
  const planned = await storedWhen(page, document => document.sessions.length === 1);
  assert.equal(planned.sessions[0].date, date);
  const editor = page.getByTestId("session-editor");
  await button(editor, "Add set to Squat").click();
  await field(editor, "Squat set 1 reps").fill("5");
  await field(editor, "Squat set 1 weight (kg)").fill("40");
  await button(editor, "Log completed workout").click();
  await storedWhen(page, document => document.sessions[0].status === "completed");
  await page.getByTestId("exercise-workout-empty").waitFor();
  await button(page, "Expand calendar").click();
  await page.getByRole("button", { name: "Sunday, October 4, 2026, today", exact: true }).click();
  await button(page, "Collapse calendar").click();
  await page.getByTestId("exercise-workout").getByText("200 kg", { exact: true }).waitFor();
});

test("Add workout and the workout icon open the same menu with the requested empty copy", async t => {
  const page = await open(t);
  const menu = page.getByTestId("workout-library");
  for (const opener of [button(page.getByTestId("exercise-workout-empty"), "Add workout"), button(page, "Saved workouts")]) {
    await opener.click();
    await menu.waitFor();
    assert.equal(await menu.getByText("No workout found. Create a workout to get started.", { exact: true }).count(), 1);
    assert.doesNotMatch(await menu.innerText(), /Choose a workout for|No saved workouts yet/);
    await button(menu, "Close saved workouts").click();
  }
});

test("Home Add workout opens the saved menu once with the selected date", async t => {
  const template = { id: "template", name: "Leg day", exercises: [single] };
  const exercises = Array.from({ length: 21 }, (_, index) => ({ ...single, id: `squat-${index}`, name: `Squat ${index + 1}` }));
  const page = await open(t, { path: "/", document: { ...empty(), exercises, workouts: [template] } });
  await page.getByRole("tab", { name: /Exercise/ }).click();
  await field(page, "Search exercises").fill("Squat");
  await page.getByTestId("exercise-result").first().waitFor();
  assert.equal(await page.getByTestId("exercise-result").count(), 20);
  await page.getByRole("tab", { name: /Home/ }).click();
  await button(page, "Expand calendar").click();
  await page.getByRole("button", { name: "Saturday, October 3, 2026", exact: true }).click();
  await button(page, "Collapse calendar").click();
  await button(page.getByTestId("home-workout-empty"), "Add workout").click();
  const menu = page.getByTestId("workout-library");
  await menu.waitFor();
  await page.waitForFunction(() => {
    const menu = document.querySelector('[data-testid="workout-library"]')?.getBoundingClientRect();
    return menu && menu.top >= 0 && menu.top < innerHeight - 100;
  });
  assert.match(page.url(), /\/exercise/);
  await button(menu, "Close saved workouts").click();
  await button(page, "Create Exercise").click();
  await field(page, "Exercise name").fill("Bench press");
  await button(page, "Save exercise").click();
  await storedWhen(page, document => document.exercises.length === 22);
  assert.equal(await menu.count(), 0, "the consumed menu intent must not reopen after a provider update");
  await page.getByRole("tab", { name: /Home/ }).click();
  await button(page.getByTestId("home-workout-empty"), "Add workout").click();
  await button(menu, "Add Leg day to selected day").click();
  const document = await storedWhen(page, document => document.sessions.length === 1);
  assert.equal(document.sessions[0].date, "2026-10-03");
});

test("Exercise search matches Food field and result styling, pages results, and clears them", async t => {
  const exercises = Array.from({ length: 21 }, (_, index) => ({ ...single, id: `squat-${index}`, name: `Squat ${index + 1}` }));
  const page = await open(t, { document: { ...empty(), exercises } });
  const styles = locator => locator.evaluate(element => {
    const css = getComputedStyle(element);
    return Object.fromEntries(["paddingLeft", "paddingRight", "paddingTop", "paddingBottom", "gap", "borderRadius", "borderColor", "backgroundColor", "minHeight"].map(key => [key, css[key]]));
  });
  for (const appearance of ["light", "dark"]) {
    await page.evaluate(value => localStorage.setItem("kinevault-track.appearance", value), appearance);
    await page.reload();
    await page.getByTestId("exercise-search-actions").waitFor();
    await page.getByRole("tab", { name: /Food/ }).click();
    await field(page, "Search foods").fill("apple");
    await page.getByTestId("food-result").first().waitFor();
    await field(page, "Search foods").blur();
    const foodFieldStyle = await styles(page.getByTestId("food-search-box"));
    const foodResultStyle = await styles(page.getByTestId("food-result").first());
    await page.getByRole("tab", { name: /Exercise/ }).click();
    assert.deepEqual(await styles(page.getByTestId("exercise-search-box")), foodFieldStyle);
    await field(page, "Search exercises").fill("S");
    await page.getByText("Type at least two letters to search exercises.", { exact: true }).waitFor();
    assert.equal(await page.getByTestId("exercise-result").count(), 0);
    await field(page, "Search exercises").fill("Squat");
    await page.getByTestId("exercise-result").first().waitFor();
    assert.deepEqual(await styles(page.getByTestId("exercise-result").first()), foodResultStyle);
    assert.equal(await page.getByTestId("exercise-result").count(), 20);
    await button(page, "Next exercise results").click();
    assert.equal(await page.getByTestId("exercise-result").count(), 1);
    await button(page, "Previous exercise results").click();
    await page.waitForFunction(() => {
      const result = document.querySelector('[data-testid="exercise-result"]')?.getBoundingClientRect();
      return result && result.top >= 0 && result.bottom < innerHeight - 60;
    });
    await button(page, "Edit exercise Squat 1").click();
    await page.getByTestId("exercise-form").waitFor();
    await page.waitForFunction(() => {
      const name = document.querySelector('[aria-label="Exercise name"]')?.getBoundingClientRect();
      return name && name.top >= 0 && name.bottom < innerHeight - 60;
    });
    await button(page.getByTestId("exercise-form"), "Cancel").click();
    await button(page, "Clear search").click();
    assert.equal(await page.getByTestId("exercise-library").count(), 0);
    assert.equal(await field(page, "Search exercises").inputValue(), "");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  }
});
