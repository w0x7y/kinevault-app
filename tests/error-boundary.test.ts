import assert from "node:assert/strict";
import test from "node:test";
import {
  errorMessageFor,
  initialBoundaryState,
  nextBoundaryState,
  reloadActionFor,
  remountLimit,
  type BoundaryState,
} from "../src/components/error-boundary-state.ts";

const secret = "Idan ate 3 eggs at /Users/idan/private";

test("fallback messages never leak error text or stack traces", () => {
  const leaky = new Error(secret);
  leaky.stack = `Error: ${secret}\n    at render (src/food/log.tsx:12:5)`;
  const chunk = Object.assign(new Error(secret), { name: "ChunkLoadError" });
  for (const error of [leaky, chunk, secret, { message: secret }, null, undefined, 42]) {
    const message = errorMessageFor(error);
    assert.ok(message.length > 0);
    assert.ok(!message.includes(secret));
    assert.ok(!message.includes("at render"));
    assert.ok(!/\.tsx?:\d+/.test(message));
  }
});

test("known loading failures get a specific message, everything else the generic one", () => {
  const chunk = Object.assign(new Error("x"), { name: "ChunkLoadError" });
  assert.notEqual(errorMessageFor(chunk), errorMessageFor(new Error("x")));
  assert.equal(errorMessageFor(new TypeError("x")), errorMessageFor("x"));
});

test("even an error with an unsafe name getter cannot break the recovery screen", () => {
  const error = Object.defineProperty({}, "name", {
    get() {
      throw new Error(secret);
    },
  });
  assert.equal(errorMessageFor(error), errorMessageFor(null));
});

test("a crash shows the fallback and reload remounts while keeping the crash count", () => {
  const crashed = nextBoundaryState(initialBoundaryState, {
    kind: "crash",
    error: new Error(secret),
  });
  assert.equal(crashed.failed, true);
  assert.equal(crashed.crashes, 1);
  assert.ok(!crashed.message.includes(secret));

  const reloaded = nextBoundaryState(crashed, { kind: "reload" });
  assert.equal(reloaded.failed, false);
  assert.equal(reloaded.crashes, 1);

  const again = nextBoundaryState(reloaded, { kind: "crash", error: "boom" });
  assert.equal(again.crashes, 2);
  assert.deepEqual(nextBoundaryState(again, { kind: "recovered" }), initialBoundaryState);
});

test("reload always remounts on native and until remounting fails twice on web", () => {
  let state: BoundaryState = initialBoundaryState;
  for (let crash = 1; crash <= remountLimit + 1; crash++) {
    state = nextBoundaryState(state, { kind: "crash", error: new Error("x") });
    assert.equal(reloadActionFor(state, "ios"), "remount");
    assert.equal(reloadActionFor(state, "android"), "remount");
    assert.equal(
      reloadActionFor(state, "web"),
      crash > remountLimit ? "full" : "remount",
      `crash ${crash}`,
    );
    state = nextBoundaryState(state, { kind: "reload" });
  }
});
