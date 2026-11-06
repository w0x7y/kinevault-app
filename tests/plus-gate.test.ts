import assert from "node:assert/strict";
import test from "node:test";
import type { Membership } from "../src/account/membership.ts";
import {
  cachedMembership,
  defaultWorkoutWeeks,
  demoLocked,
  hasPlus,
  isMembership,
  limitNotice,
  limitReached,
  membershipCacheWrite,
  plusAccess,
  plusGatesEnabled,
  starterDemoIds,
  workoutWeeksLocked,
} from "../src/plus/gate.ts";
import {
  paywallRows,
  paywallSource,
  plusCheckout,
  plusPlanCards,
  plusStore,
} from "../src/plus/plans.ts";
import { plusPurchases, purchaseMessage } from "../src/plus/purchases.ts";

const free: Membership = { plan: "free", status: "active" };
const plus: Membership = { plan: "plus", status: "active" };
const day = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 10, 6, 12);

test("the switch ships off", () => {
  assert.equal(plusGatesEnabled, false, "Plus stays dormant until store billing ships");
});

test("with the switch off every feature is unlocked and no entry point shows", () => {
  for (const membership of [null, free, plus, { plan: "plus", status: "canceled" } as const])
    assert.deepEqual(plusAccess(membership, false), { unlocked: true, offered: false });
  assert.deepEqual(plusAccess(null), { unlocked: true, offered: false });
});

test("with the switch on only a billed Plus or Pro plan unlocks", () => {
  assert.deepEqual(plusAccess(null, true), { unlocked: false, offered: true });
  assert.deepEqual(plusAccess(free, true), { unlocked: false, offered: true });
  assert.deepEqual(plusAccess(plus, true), { unlocked: true, offered: true });
  for (const status of ["active", "trialing", "past_due"] as const) {
    assert.equal(hasPlus({ plan: "plus", status }), true, status);
    assert.equal(hasPlus({ plan: "pro", status }), true, status);
    assert.equal(hasPlus({ plan: "free", status }), false, status);
  }
  for (const status of ["canceled", "inactive"] as const) {
    assert.equal(hasPlus({ plan: "plus", status }), false, status);
    assert.equal(hasPlus({ plan: "pro", status }), false, status);
  }
});

test("only the server's plans and statuses count as a membership", () => {
  assert.equal(isMembership({ plan: "plus", status: "trialing" }), true);
  assert.equal(isMembership({ plan: "gold", status: "active" }), false);
  assert.equal(isMembership({ plan: "plus", status: "paused" }), false);
  assert.equal(isMembership({ plan: 1, status: null }), false);
});

test("the cached membership stands in for up to 7 days, then counts as Free", () => {
  const entry = membershipCacheWrite(null, { plan: "plus", status: "trialing" }, now, true);
  assert.ok(entry);
  assert.deepEqual(cachedMembership(entry, now), { plan: "plus", status: "trialing" });
  assert.deepEqual(cachedMembership(entry, now + 7 * day), { plan: "plus", status: "trialing" });
  assert.equal(cachedMembership(entry, now + 7 * day + 1), null);
  // A clock set back can't keep an old read alive.
  assert.equal(cachedMembership(entry, now - 1), null);
  assert.equal(plusAccess(cachedMembership(entry, now + 8 * day), true).unlocked, false);
});

test("nothing is cached with the switch off, and an unchanged read is saved at most daily", () => {
  assert.equal(membershipCacheWrite(null, plus, now, false), null);
  assert.equal(membershipCacheWrite(null, plus, now), null);
  const entry = membershipCacheWrite(null, plus, now, true);
  assert.ok(entry);
  assert.equal(membershipCacheWrite(entry, plus, now + day - 1, true), null);
  const refreshed = membershipCacheWrite(entry, plus, now + day, true);
  assert.ok(refreshed);
  assert.deepEqual(cachedMembership(refreshed, now + 8 * day), plus);
  // A changed plan or status is saved at once.
  const ended = membershipCacheWrite(entry, { plan: "plus", status: "canceled" }, now + 1, true);
  assert.deepEqual(cachedMembership(ended, now + 1), { plan: "plus", status: "canceled" });
  assert.ok(membershipCacheWrite("{", free, now, true));
});

test("a damaged or foreign cache entry is ignored", () => {
  for (const raw of [
    null,
    "",
    "{",
    "null",
    "[]",
    JSON.stringify({ version: 2, plan: "plus", status: "active", readAt: now }),
    JSON.stringify({ version: 1, plan: "gold", status: "active", readAt: now }),
    JSON.stringify({ version: 1, plan: "plus", status: "active", readAt: "today" }),
    JSON.stringify({ version: 1, plan: "plus", status: "active" }),
  ])
    assert.equal(cachedMembership(raw, now), null, String(raw));
});

test("limits block only the next new item, and only with Plus locked", () => {
  assert.equal(limitReached("workouts", 4, false), false);
  assert.equal(limitReached("workouts", 5, false), true);
  assert.equal(limitReached("workouts", 9, false), true);
  assert.equal(limitReached("workouts", 9, true), false);
  assert.equal(limitReached("foods", 9, false), false);
  assert.equal(limitReached("foods", 10, false), true);
  assert.equal(limitReached("meals", 10, false), true);
  assert.equal(limitReached("photos", 2, false), false);
  assert.equal(limitReached("photos", 3, false), true);
});

test("a limit notice shows from one item before the limit", () => {
  assert.equal(limitNotice("workouts", 3, false), null);
  assert.deepEqual(limitNotice("workouts", 4, false), {
    lead: "4 of 5 saved workouts.",
    detail: "Free keeps 5. Plus has no limit.",
    full: false,
  });
  assert.deepEqual(limitNotice("workouts", 5, false), {
    lead: "5 of 5 saved workouts.",
    detail: "Free keeps 5. Edit or delete one to make room, or get Plus for unlimited.",
    full: true,
  });
  // Items kept past the limit after Plus ends.
  assert.equal(limitNotice("foods", 12, false)?.lead, "12 custom foods.");
  assert.equal(limitNotice("meals", 9, false)?.lead, "9 of 10 saved meals.");
  assert.equal(limitNotice("photos", 2, false)?.lead, "2 of 3 progress photos.");
  assert.equal(limitNotice("workouts", 5, true), null);
});

test("Free keeps the 4-week Workout graph", () => {
  assert.equal(workoutWeeksLocked(4, false), false);
  assert.equal(workoutWeeksLocked(12, false), true);
  assert.equal(workoutWeeksLocked(52, false), true);
  assert.equal(workoutWeeksLocked(52, true), false);
  assert.equal(defaultWorkoutWeeks(false), 4);
  assert.equal(defaultWorkoutWeeks(true), 12);
});

test("Free plays the starter demos only", () => {
  assert.equal(starterDemoIds.length, 3);
  for (const id of starterDemoIds) assert.equal(demoLocked(id, false), false);
  assert.equal(demoLocked("44fcc77b-d4c8-4a29-9ff2-d23da4e89a5d", false), true);
  assert.equal(demoLocked("44fcc77b-d4c8-4a29-9ff2-d23da4e89a5d", true), false);
});

test("the plan cards and checkout come from the one price list", () => {
  assert.deepEqual(plusPlanCards(), [
    {
      plan: "yearly",
      name: "Yearly",
      caption: "7 days free, then billed yearly",
      price: "$34.99",
      per: "$2.92 a month",
      badge: "Save 41%",
    },
    {
      plan: "monthly",
      name: "Monthly",
      caption: "Cancel anytime",
      price: "$4.99",
      per: "a month",
      badge: null,
    },
  ]);
  assert.deepEqual(plusCheckout("yearly", plusStore("ios")), {
    action: "Start 7-day free trial",
    terms:
      "Free for 7 days, then $34.99 a year. Renews automatically until you cancel in App Store settings, at least 24 hours before the renewal date.",
  });
  assert.deepEqual(plusCheckout("monthly", plusStore("android")), {
    action: "Subscribe for $4.99 a month",
    terms:
      "$4.99 a month. Renews automatically until you cancel in Google Play settings, at least 24 hours before the renewal date.",
  });
});

test("the store and health store follow the platform", () => {
  assert.equal(plusStore("ios").name, "App Store");
  assert.equal(plusStore("web").name, "App Store");
  assert.equal(plusStore("android").name, "Google Play");
  assert.equal(paywallRows(plusStore("ios"))[5].title, "Save to Apple Health");
  assert.equal(paywallRows(plusStore("android"))[5].title, "Save to Health Connect");
  assert.equal(paywallRows(plusStore("ios")).length, 7);
});

test("the paywall names the feature it opened from and leads its welcome with it", () => {
  const store = plusStore("ios");
  const plates = paywallSource("plates", store);
  assert.equal(plates.context, "The Plate calculator is part of Plus.");
  assert.deepEqual(
    plates.welcome.map((row) => row.title),
    ["Plate calculator", "Long-range trends"],
  );
  assert.equal(plates.back, "Back to Plates");
  const settings = paywallSource("settings", store);
  assert.equal(settings.context, null);
  assert.deepEqual(
    settings.welcome.map((row) => row.title),
    ["Long-range trends", "Detailed nutrients"],
  );
  assert.equal(settings.back, "Back to Settings");
  assert.equal(paywallSource("nutrients", store).context, "Detailed nutrients are part of Plus.");
  assert.equal(
    paywallSource("health", plusStore("android")).context,
    "Save to Health Connect is part of Plus.",
  );
  assert.equal(
    paywallSource("workouts", store).context,
    "More than 5 saved workouts are part of Plus.",
  );
});

test("purchases report that the store isn't open yet", async () => {
  assert.deepEqual(await plusPurchases.buy("yearly"), { kind: "unavailable" });
  assert.deepEqual(await plusPurchases.restore(), { kind: "unavailable" });
  assert.equal(purchaseMessage({ kind: "unavailable" }), "Purchases open with the store release.");
  assert.equal(purchaseMessage({ kind: "cancelled" }), null);
  assert.equal(purchaseMessage({ kind: "purchased", membership: plus }), null);
});
