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

async function open(t, { document = empty(), raw, foodRaw, failure = false, freeze = false, path = "/exercise" } = {}) {
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
  }, { answers, key: storageKey, raw: raw ?? JSON.stringify(document), foodRaw, failure });
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
  await page.getByTestId(path === "/" ? "home-workout" : "exercise-search-actions").waitFor();
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
  await page.getByTestId("home-workout").getByText("No workout logged", { exact: true }).waitFor();
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
  await button(page, "Log completed Strength").click();
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

test("exercise selection always opens a session picker even with a running workout", async t => {
  const active = { id: "running", date, name: "Running workout", status: "active", startedAt: time.getTime() - 30000, durationSeconds: null, exercises: [] };
  const planned = { ...active, id: "later", name: "Later", status: "planned", startedAt: null };
  const page = await open(t, { document: { ...empty(), exercises: [sides], sessions: [active, planned] } });
  await field(page, "Search exercises").fill("Curl");
  await button(page, "Select exercise Curl").click();
  const picker = page.getByTestId("session-picker");
  await picker.waitFor();
  assert.equal((await documentFrom(page)).sessions[0].exercises.length, 0);
  await button(picker, "Add Curl to Later").click();
  const document = await storedWhen(page, document => document.sessions.find(session => session.id === "later").exercises.length === 1);
  assert.equal(document.sessions[0].exercises.length, 0);
  assert.equal(document.sessions[0].status, "active");
  assert.equal(document.sessions[1].status, "planned");
});

test("manual duration survives closing and reloading, and the card Start action begins a timed workout", async t => {
  const planned = { id: "draft", date, name: "Draft", status: "planned", startedAt: null, durationSeconds: null,
    exercises: [{ id: "squat-row", exercise: single, sets: [{ id: "set", kind: "single", reps: "5", weightKg: "" }] }] };
  const page = await open(t, { freeze: true, document: { ...empty(), exercises: [single], sessions: [planned] } });
  await button(page, "Open Draft").click();
  let editor = page.getByTestId("session-editor");
  await field(editor, "Duration in minutes (optional)").fill("invalid");
  await button(editor, "Close session").click();
  await editor.getByRole("alert").waitFor();
  assert.equal(await field(editor, "Duration in minutes (optional)").inputValue(), "invalid");
  await field(editor, "Duration in minutes (optional)").fill("12.5");
  await button(editor, "Close session").click();
  await editor.waitFor({ state: "detached" });
  assert.equal((await documentFrom(page)).sessions[0].durationSeconds, 750);
  await page.clock.resume();
  await page.reload();
  await page.getByTestId("exercise-search-actions").waitFor();
  await button(page, "Open Draft").click();
  editor = page.getByTestId("session-editor");
  assert.equal(await field(editor, "Duration in minutes (optional)").inputValue(), "12.5");
  await button(editor, "Close session").click();
  await button(page, "Start Draft").click();
  const active = await storedWhen(page, document => document.sessions[0].status === "active");
  await page.getByTestId("active-workout-timer").waitFor();
  assert.equal(active.sessions[0].durationSeconds, null);
  await page.clock.fastForward(61000);
  await button(editor, "Finish workout").click();
  const completed = await storedWhen(page, document => document.sessions[0].status === "completed");
  assert.ok(completed.sessions[0].durationSeconds >= 61);
  assert.ok(completed.sessions[0].durationSeconds < 750);
});

test("build an ad hoc session from search and validate incomplete measurements before completion", async t => {
  const page = await open(t, { document: { ...empty(), exercises: [single] } });
  await field(page, "Search exercises").fill("Squat");
  await button(page, "Select exercise Squat").click();
  const picker = page.getByTestId("session-picker");
  await button(picker, "New session").click();
  await field(picker, "New session name").fill("Quick workout");
  await button(picker, "Create session and add exercise").click();
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
  await button(page, "Open Running workout").first().click();
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
  await button(page, "Edit session Manual").click();
  const editor = page.getByTestId("session-editor");
  await field(editor, "Squat set 1 reps").fill("10");
  assert.equal((await documentFrom(page)).sessions[0].exercises[0].sets[0].reps, "5");
  await button(editor, "Save changes").click();
  document = await storedWhen(page, document => document.sessions[0].exercises[0].sets[0].reps === "10");
  await page.getByTestId("exercise-workout").getByText("400 kg", { exact: true }).waitFor();
  await button(page, "Delete session Manual").click();
  assert.equal((await documentFrom(page)).sessions.length, 2);
  await button(page, "Confirm delete session").click();
  document = await storedWhen(page, document => document.sessions.length === 1);
  assert.equal(document.sessions[0].status, "planned");
});

test("completed edits retain name, measurements, duration, and repeated exercise additions through the picker", async t => {
  const completed = { id: "done", date, name: "Manual", status: "completed", startedAt: null, durationSeconds: null,
    exercises: [{ id: "squat-row", exercise: single, sets: [{ id: "set", kind: "single", reps: "5", weightKg: "40" }] }] };
  const page = await open(t, { document: { ...empty(), exercises: [single, sides], sessions: [completed] } });
  await button(page, "Edit session Manual").click();
  const editor = page.getByTestId("session-editor");
  await field(editor, "Session name").fill("Updated workout");
  await field(editor, "Squat set 1 reps").fill("10");
  await field(editor, "Duration in minutes (optional)").fill("15");
  for (const name of ["Curl", "Squat"]) {
    await field(page, "Search exercises").fill(name);
    await button(page, `Select exercise ${name}`).click();
    await button(page.getByTestId("session-picker"), `Add ${name} to Manual`).click();
    await editor.waitFor();
  }
  assert.equal(await field(editor, "Session name").inputValue(), "Updated workout");
  assert.equal(await field(editor, "Squat exercise 1 set 1 reps").inputValue(), "10");
  assert.equal(await field(editor, "Duration in minutes (optional)").inputValue(), "15");
  assert.equal(await button(editor, "Add set to Curl").count(), 1);
  assert.equal(await button(editor, "Add set to Squat exercise 3").count(), 1);
  assert.deepEqual((await documentFrom(page)).sessions[0], completed);
  await button(editor, "Save changes").click();
  const document = await storedWhen(page, document => document.sessions[0].name === "Updated workout");
  assert.deepEqual(document.sessions[0].exercises.map(row => row.exercise.name), ["Squat", "Curl", "Squat"]);
  assert.equal(document.sessions[0].exercises[0].sets[0].reps, "10");
  assert.equal(document.sessions[0].durationSeconds, 900);
});
