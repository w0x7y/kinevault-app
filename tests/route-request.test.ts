import assert from "node:assert/strict";
import test from "node:test";
import {
  routeRequestStep,
  type RouteParam,
  type RouteRequestMemory,
} from "../src/navigation/route-request.ts";

// Replays renders through the step the way the hook does, recording clears and deliveries.
function replay(renders: { value: RouteParam; ready?: boolean }[]) {
  let memory: RouteRequestMemory = null;
  const clears: number[] = [],
    delivered: string[] = [];
  renders.forEach(({ value, ready = true }, index) => {
    const step = routeRequestStep(memory, value, ready);
    memory = step.memory;
    if (step.clear) clears.push(index);
    if (step.deliver !== null) delivered.push(step.deliver);
  });
  return { clears, delivered, memory };
}

test("a request is delivered and cleared once", () => {
  assert.deepEqual(replay([{ value: "photos" }, { value: "photos" }, { value: undefined }]), {
    clears: [0],
    delivered: ["photos"],
    memory: null,
  });
});

test("a repeated value after the param clears is delivered again", () => {
  const { clears, delivered } = replay([
    { value: "photos" },
    { value: undefined },
    { value: "photos" },
  ]);
  assert.deepEqual(clears, [0, 2]);
  assert.deepEqual(delivered, ["photos", "photos"]);
});

test("a changed value is delivered without the param clearing in between", () => {
  assert.deepEqual(replay([{ value: "overview" }, { value: "photos" }]).delivered, [
    "overview",
    "photos",
  ]);
});

test("nothing is delivered or cleared before the screen is ready", () => {
  assert.deepEqual(
    replay([
      { value: "2026-10-04", ready: false },
      { value: "2026-10-04", ready: false },
      { value: "2026-10-04", ready: true },
    ]),
    { clears: [2], delivered: ["2026-10-04"], memory: "2026-10-04" },
  );
});

test("array values are cleared but not delivered", () => {
  const value = ["photos", "goals"];
  assert.deepEqual(replay([{ value }, { value }, { value: undefined }]), {
    clears: [0],
    delivered: [],
    memory: null,
  });
});
