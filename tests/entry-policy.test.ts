import assert from "node:assert/strict";
import test from "node:test";
import {
  entryDecision,
  entryRoute,
  navigatorGate,
  onboardingExit,
  reminderTapAccess,
  sessionGate,
  storageGate,
  type EntryDecision,
  type EntryReadings,
  type EntryRoute,
  type ProfileReading,
} from "../src/account/entry-policy.ts";

const routes: EntryRoute[] = ["auth", "account", "onboarding", "tracking", "other"];
const profiles: Record<string, ProfileReading> = {
  loading: { kind: "loading" },
  error: { kind: "error" },
  draft: { kind: "ready", document: { kind: "draft" } },
  complete: { kind: "ready", document: { kind: "complete" } },
};

function* everyReading(): Generator<EntryReadings> {
  for (const accountLoading of [false, true])
    for (const signedIn of [false, true])
      for (const recovery of [false, true])
        for (const storage of ["loading", "ready", "error"] as const)
          for (const appReady of [false, true])
            for (const profile of Object.values(profiles))
              for (const setupStage of [undefined, "account", "review"])
                yield {
                  accountLoading,
                  signedIn,
                  recovery,
                  storage,
                  appReady,
                  profile,
                  setupStage,
                };
}

/**
 * The entry rules as the React tree applied them before the policy module existed,
 * transcribed layer by layer from AccountDataProvider, the root layout, account.tsx,
 * onboarding.tsx and the tab layout. `reminder` is null where the root navigator
 * isn't mounted, so a launching tap stays pending. One deliberate change since: the
 * sign-in screen skips the storage wait only while signed out.
 */
function previousTree(
  route: EntryRoute,
  r: EntryReadings,
): { screen: EntryDecision; reminder: "wait" | "open" | "ignore" | null } {
  const segments = { auth: ["auth"], account: ["account"], onboarding: ["onboarding"], tracking: ["(tabs)"], other: ["+not-found"] }[route]; // prettier-ignore
  const authRoute = segments[0] === "account" || segments[0] === "auth";
  const { profile: state, recovery } = r;
  const user = r.signedIn ? {} : null;
  // AccountDataProvider and ScopedData
  const storageExempt = segments[0] === "auth" || (segments[0] === "account" && !r.signedIn);
  if (r.accountLoading) return { screen: { kind: "loading" }, reminder: null };
  if (r.storage === "error" && !storageExempt)
    return { screen: { kind: "storageFailure" }, reminder: null };
  if (r.storage === "loading" && !storageExempt)
    return { screen: { kind: "loading" }, reminder: null };
  // RootNavigator
  const loaded = r.appReady && (authRoute || state.kind !== "loading");
  const tracking = ((): string => {
    if (recovery) return "redirect";
    if (state.kind !== "ready") return "wait";
    if (state.document.kind === "draft") return "redirect";
    if (!user) return "redirect";
    return "open";
  })();
  const reminder =
    !loaded || state.kind === "loading"
      ? "wait"
      : !authRoute && tracking === "open"
        ? "open"
        : "ignore";
  if (!loaded) return { screen: { kind: "loading" }, reminder };
  if (state.kind === "error" && !authRoute)
    return { screen: { kind: "profileRecovery" }, reminder };
  const screen = ((): EntryDecision => {
    switch (route) {
      case "account":
        if (recovery) return { kind: "redirect", href: "/auth/reset-password" };
        if (user && state.kind === "loading") return { kind: "loading" };
        if (user && state.kind === "error") return { kind: "profileRecovery" };
        if (user && state.kind === "ready")
          return {
            kind: "redirect",
            href: state.document.kind === "complete" ? "/(tabs)" : "/onboarding",
          };
        return { kind: "render" };
      case "onboarding":
        if (recovery) return { kind: "redirect", href: "/auth/reset-password" };
        if (state.kind !== "ready") return { kind: "wait" };
        if (user && state.document.kind === "complete" && r.setupStage === "account")
          return { kind: "redirect", href: "/(tabs)" };
        return { kind: "render" };
      case "tracking":
        if (recovery) return { kind: "redirect", href: "/auth/reset-password" };
        if (state.kind !== "ready") return { kind: "wait" };
        if (state.document.kind === "draft") return { kind: "redirect", href: "/onboarding" };
        if (!user) return { kind: "redirect", href: "/account" };
        return { kind: "render" };
      default:
        return { kind: "render" };
    }
  })();
  return { screen, reminder };
}

test("the policy matches the previous entry rules for every route and state", () => {
  let rows = 0;
  for (const route of routes)
    for (const readings of everyReading()) {
      const expected = previousTree(route, readings);
      const label = JSON.stringify({ route, ...readings });
      assert.deepEqual(entryDecision(route, readings), expected.screen, label);
      const navigatorMounted = !sessionGate(readings) && !storageGate(route, readings);
      assert.equal(navigatorMounted, expected.reminder !== null, label);
      if (expected.reminder !== null)
        assert.equal(reminderTapAccess(route, readings), expected.reminder, label);
      rows++;
    }
  assert.equal(rows, 5 * 2 * 2 * 2 * 3 * 2 * 4 * 3);
});

const ready: EntryReadings = {
  accountLoading: false,
  signedIn: true,
  recovery: false,
  storage: "ready",
  appReady: true,
  profile: profiles.complete,
};

test("readable rows of the entry policy", () => {
  const rows: [EntryRoute, Partial<EntryReadings>, EntryDecision][] = [
    ["tracking", {}, { kind: "render" }],
    ["tracking", { accountLoading: true }, { kind: "loading" }],
    ["tracking", { storage: "loading" }, { kind: "loading" }],
    ["tracking", { storage: "error" }, { kind: "storageFailure" }],
    ["tracking", { appReady: false }, { kind: "loading" }],
    ["tracking", { profile: profiles.loading }, { kind: "loading" }],
    ["tracking", { profile: profiles.error }, { kind: "profileRecovery" }],
    ["tracking", { profile: profiles.draft }, { kind: "redirect", href: "/onboarding" }],
    ["tracking", { signedIn: false }, { kind: "redirect", href: "/account" }],
    ["tracking", { recovery: true }, { kind: "redirect", href: "/auth/reset-password" }],
    // Storage and Profile failures don't block the public account routes.
    ["auth", { storage: "error", profile: profiles.error }, { kind: "render" }],
    ["account", { storage: "error", signedIn: false }, { kind: "render" }],
    ["account", { storage: "loading", profile: profiles.loading }, { kind: "loading" }],
    // Signed in, it waits for the account's data instead of acting on an empty local Profile.
    ["account", { storage: "loading", profile: profiles.draft }, { kind: "loading" }],
    ["account", { storage: "error" }, { kind: "storageFailure" }],
    ["account", { storage: "loading", signedIn: false }, { kind: "render" }],
    ["account", { profile: profiles.error }, { kind: "profileRecovery" }],
    ["account", {}, { kind: "redirect", href: "/(tabs)" }],
    ["account", { profile: profiles.draft }, { kind: "redirect", href: "/onboarding" }],
    ["account", { recovery: true }, { kind: "redirect", href: "/auth/reset-password" }],
    // Password recovery waits behind a damaged Profile on guarded routes.
    ["onboarding", { recovery: true, profile: profiles.error }, { kind: "profileRecovery" }],
    ["onboarding", {}, { kind: "render" }],
    ["onboarding", { setupStage: "account" }, { kind: "redirect", href: "/(tabs)" }],
    ["onboarding", { setupStage: "account", signedIn: false }, { kind: "render" }],
    ["other", { profile: profiles.draft, signedIn: false }, { kind: "render" }],
  ];
  for (const [route, change, decision] of rows)
    assert.deepEqual(
      entryDecision(route, { ...ready, ...change }),
      decision,
      JSON.stringify({ route, change }),
    );
});

test("reminder taps wait for startup and open only where tracking renders", () => {
  assert.equal(reminderTapAccess("tracking", ready), "open");
  assert.equal(reminderTapAccess("onboarding", ready), "open");
  assert.equal(reminderTapAccess("account", ready), "ignore");
  assert.equal(reminderTapAccess("tracking", { ...ready, appReady: false }), "wait");
  assert.equal(reminderTapAccess("auth", { ...ready, profile: profiles.loading }), "wait");
  assert.equal(reminderTapAccess("tracking", { ...ready, signedIn: false }), "ignore");
  assert.equal(reminderTapAccess("tracking", { ...ready, profile: profiles.error }), "ignore");
});

test("the root navigator shows Profile recovery only off the public account routes", () => {
  assert.deepEqual(navigatorGate("tracking", { appReady: true, profile: profiles.error }), {
    kind: "profileRecovery",
  });
  assert.equal(navigatorGate("account", { appReady: true, profile: profiles.error }), null);
});

test("routes are classified from their segments", () => {
  assert.equal(entryRoute(["auth", "callback"]), "auth");
  assert.equal(entryRoute(["account"]), "account");
  assert.equal(entryRoute(["onboarding"]), "onboarding");
  assert.equal(entryRoute(["(tabs)", "food"]), "tracking");
  assert.equal(entryRoute(["+not-found"]), "other");
  assert.equal(entryRoute([]), "other");
});

test("a saved Onboarding flow continues to the Account step only when signed out", () => {
  assert.deepEqual(onboardingExit("today", false), { kind: "accountStep" });
  assert.deepEqual(onboardingExit("today", true), { kind: "redirect", href: "/(tabs)" });
  assert.deepEqual(onboardingExit("settings", false), {
    kind: "redirect",
    href: "/(tabs)/settings",
  });
});
