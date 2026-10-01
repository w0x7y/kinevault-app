import assert from "node:assert/strict";
import test from "node:test";
import { emptyAnswers, type Answers } from "../src/profile/answers.ts";
import type { ProfileDocument } from "../src/profile/model.ts";
import { createOnboardingFlow } from "../src/onboarding/flow.ts";

const adult: Answers = {
  ...emptyAnswers,
  age: "30",
  name: " Alex ",
  goal: "maintain",
  activity: "moderate",
  height: "180",
  weight: "80",
  sex: "male",
  eligible: true,
};
function setup(
  document: ProfileDocument,
  save: (document: ProfileDocument) => Promise<boolean> = async () => true,
) {
  const destinations: string[] = [];
  const flow = createOnboardingFlow(document, {
    save,
    exit: (destination) => destinations.push(destination),
  });
  return { flow, destinations };
}

test("a failed draft save preserves review editing and supports retry", async () => {
  let fail = false;
  const { flow } = setup(
    { version: 1, kind: "draft", step: "review", answers: adult },
    async () => !fail,
  );
  await flow.act({ kind: "edit", step: "goal" });
  flow.update({ kind: "fields", patch: { goal: "gain" } });
  fail = true;
  await flow.act({ kind: "next" });
  assert.equal(flow.getSnapshot().step, "goal");
  assert.equal(flow.getSnapshot().primaryLabel, "Back to review");
  assert.ok(flow.getSnapshot().error);
  fail = false;
  await flow.act({ kind: "next" });
  assert.equal(flow.getSnapshot().step, "review");
  assert.equal(flow.getSnapshot().answers.goal, "gain");
  assert.equal(flow.getSnapshot().error, null);
});

test("draft navigation commits a resumable record before moving", async () => {
  const saved: ProfileDocument[] = [];
  const { flow } = setup(
    { version: 1, kind: "draft", step: "body", answers: adult },
    async (document) => {
      saved.push(document);
      return true;
    },
  );
  await flow.act({ kind: "next" });
  assert.equal(saved[0]?.kind, "draft");
  const resumed = setup(
    saved[0] ?? {
      version: 1,
      kind: "draft",
      step: "welcome",
      answers: emptyAnswers,
    },
  ).flow;
  assert.equal(resumed.getSnapshot().step, "activity");
  await flow.act({ kind: "back" });
  assert.equal(flow.getSnapshot().step, "body");
  assert.equal(flow.getSnapshot().direction, -1);
});

test("pending saves reject repeated navigation and answer edits", async () => {
  let resolveSave: (result: boolean) => void = () => {
    throw new Error("Save did not start");
  };
  const saved: ProfileDocument[] = [];
  const { flow } = setup(
    { version: 1, kind: "draft", step: "name", answers: adult },
    (document) => {
      saved.push(document);
      return new Promise((resolve) => {
        resolveSave = resolve;
      });
    },
  );
  const pending = flow.act({ kind: "next" });
  await flow.act({ kind: "next" });
  flow.update({ kind: "fields", patch: { name: "Changed during save" } });
  assert.equal(flow.getSnapshot().saving, true);
  assert.equal(flow.getSnapshot().step, "name");
  resolveSave(true);
  await pending;
  assert.equal(saved.length, 1);
  assert.equal(flow.getSnapshot().step, "body");
  assert.equal(flow.getSnapshot().answers.name, " Alex ");
});

test("profile edits remain staged and cancel never writes", async () => {
  const original: ProfileDocument = {
    version: 1,
    kind: "complete",
    answers: adult,
  };
  const saved: ProfileDocument[] = [];
  const { flow, destinations } = setup(original, async (document) => {
    saved.push(document);
    return true;
  });
  flow.update({ kind: "fields", patch: { name: "New name" } });
  await flow.act({ kind: "next" });
  await flow.act({ kind: "cancel" });
  assert.equal(saved.length, 0);
  assert.equal(original.answers.name, " Alex ");
  assert.deepEqual(destinations, ["settings"]);
});

test("finish failure keeps review and retry trims the name before exiting", async () => {
  let fail = true;
  const saved: ProfileDocument[] = [];
  const { flow, destinations } = setup(
    { version: 1, kind: "complete", answers: adult },
    async (document) => {
      saved.push(document);
      return !fail;
    },
  );
  for (let step = 0; step < 6; step++) await flow.act({ kind: "next" });
  assert.equal(flow.getSnapshot().step, "review");
  await flow.act({ kind: "next" });
  assert.deepEqual(destinations, []);
  assert.equal(flow.getSnapshot().step, "review");
  fail = false;
  await flow.act({ kind: "next" });
  assert.deepEqual(destinations, ["settings"]);
  assert.equal(flow.getSnapshot().answers.name, "Alex");
  assert.equal(saved.at(-1)?.kind, "complete");
});

test("skip requires age 16 and completes with other answers unset", async () => {
  const saved: ProfileDocument[] = [];
  const { flow, destinations } = setup(
    {
      version: 1,
      kind: "draft",
      step: "age",
      answers: { ...adult, age: "15" },
    },
    async (document) => {
      saved.push(document);
      return true;
    },
  );
  await flow.act({ kind: "skip" });
  assert.ok(flow.getSnapshot().errors.age);
  assert.equal(saved.length, 0);
  flow.update({ kind: "fields", patch: { age: "16" } });
  await flow.act({ kind: "skip" });
  assert.deepEqual(saved, [
    {
      version: 1,
      kind: "complete",
      answers: { ...emptyAnswers, age: "16", estimateEnabled: false },
    },
  ]);
  assert.deepEqual(destinations, ["today"]);
});

test("step validation shows local errors and review validates all answers", async () => {
  const { flow } = setup({
    version: 1,
    kind: "draft",
    step: "name",
    answers: { ...adult, age: "15", name: "a".repeat(41) },
  });
  await flow.act({ kind: "next" });
  assert.ok(flow.getSnapshot().errors.name);
  assert.equal(flow.getSnapshot().errors.age, undefined);
  const review = setup({
    version: 1,
    kind: "draft",
    step: "review",
    answers: { ...adult, age: "15" },
  });
  await review.flow.act({ kind: "next" });
  assert.ok(review.flow.getSnapshot().errors.age);
  assert.deepEqual(review.destinations, []);
});

test("thrown saves leave answers available for another attempt", async () => {
  const { flow } = setup(
    { version: 1, kind: "draft", step: "name", answers: adult },
    async () => {
      throw new Error("disk unavailable");
    },
  );
  await flow.act({ kind: "next" });
  assert.equal(flow.getSnapshot().saving, false);
  assert.equal(flow.getSnapshot().step, "name");
  assert.ok(flow.getSnapshot().error);
});

test("save completion publishes an idle destination rather than an idle previous step", async () => {
  const { flow } = setup({
    version: 1,
    kind: "draft",
    step: "name",
    answers: adult,
  });
  let started = false;
  const idleSteps: string[] = [];
  const unsubscribe = flow.subscribe(() => {
    const state = flow.getSnapshot();
    if (state.saving) started = true;
    else if (started) idleSteps.push(state.step);
  });
  await flow.act({ kind: "next" });
  unsubscribe();
  assert.deepEqual(idleSteps, ["body"]);
});

test("introduction and goals precede the age gate, while skip stays age-gated", async () => {
  const { flow, destinations } = setup({
    version: 1,
    kind: "draft",
    step: "welcome",
    answers: { ...emptyAnswers },
  });
  assert.equal(flow.getSnapshot().showSkip, false);
  await flow.act({ kind: "skip" });
  assert.deepEqual(destinations, []);
  await flow.act({ kind: "next" });
  assert.equal(flow.getSnapshot().step, "goal");
  flow.update({ kind: "fields", patch: { goal: "maintain" } });
  await flow.act({ kind: "next" });
  assert.equal(flow.getSnapshot().step, "age");
  assert.equal(flow.getSnapshot().showSkip, true);
  await flow.act({ kind: "next" });
  assert.ok(flow.getSnapshot().errors.age);
  flow.update({ kind: "fields", patch: { age: "30" } });
  await flow.act({ kind: "next" });
  assert.equal(flow.getSnapshot().step, "name");
});

test("invalid macro inputs block the calorie step and persist after correction", async () => {
  const saved: ProfileDocument[] = [];
  const { flow } = setup(
    { version: 1, kind: "draft", step: "calories", answers: adult },
    async (document) => { saved.push(document); return true; },
  );
  flow.update({ kind: "fields", patch: { customCarbs: "-5" } });
  await flow.act({ kind: "next" });
  assert.equal(flow.getSnapshot().step, "calories");
  assert.ok(flow.getSnapshot().errors.customCarbs);
  flow.update({ kind: "fields", patch: { customCarbs: "0", customProtein: "180" } });
  await flow.act({ kind: "next" });
  assert.equal(flow.getSnapshot().step, "review");
  assert.equal(saved.at(-1)?.answers.customCarbs, "0");
  assert.equal(saved.at(-1)?.answers.customProtein, "180");
});
