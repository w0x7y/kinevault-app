import assert from "node:assert/strict";
import test from "node:test";
import { createInitialState } from "../node_modules/expo-router/build/react-navigation/core/createInitialState.js";
import {
  TabRouter,
  type TabNavigationState,
} from "../node_modules/expo-router/build/react-navigation/routers/TabRouter.js";
import type { ParamListBase } from "../node_modules/expo-router/build/react-navigation/routers/types.js";
import { isActionHandled } from "../node_modules/expo-router/build/react-navigation/routers/utils.js";
import {
  headerPage,
  isJournal,
  journalHandlesBack,
  originatingTab,
  parseRouteRequest,
  popoverAfterNavigation,
  routeRequest,
  tabAnchor,
  tabNavigator,
  tabRouteNames,
  type TabPath,
} from "../src/navigation/track-tabs.ts";

// Exercise the installed router with the route order and options the tab layout supplies.
// Expo Router passes the layout's anchor to the router as its initial route.
const options = { routeNames: tabRouteNames, routeGetIdList: {} };
const router = TabRouter({ ...tabNavigator, initialRouteName: tabAnchor });
const open = (initialRouteName: string) =>
  createInitialState<TabNavigationState<ParamListBase>>({
    routeNames: tabRouteNames,
    initialRouteName,
    parentChain: "tabs",
  });
const fresh = () => open(tabAnchor);
function jump(state: ReturnType<typeof fresh>, name: string) {
  const next = router.getStateForAction(state, { type: "JUMP_TO", payload: { name } }, options);
  assert.ok(isActionHandled(next));
  return next.state;
}
function back(state: ReturnType<typeof fresh>) {
  const next = router.getStateForAction(state, { type: "GO_BACK" }, options);
  return isActionHandled(next) ? next.state : null;
}
const active = (state: ReturnType<typeof fresh>) => state.routes[state.index].name;

test("ordinary tab initial destination is Home", () => {
  assert.equal(active(fresh()), "index");
});
test("ordinary tab Back returns Home before and after visiting hidden Profile", () => {
  for (const source of ["food", "exercise", "settings"]) {
    for (const visitedProfile of [false, true]) {
      let state = jump(fresh(), "index");
      if (visitedProfile) state = jump(jump(state, "profile"), "index");
      const result = back(jump(state, source));
      assert.ok(result);
      assert.equal(active(result), "index", `${source} Back must not select hidden Profile`);
    }
  }
});
test("Home Back never selects hidden Profile even after a Profile visit", () => {
  assert.equal(back(jump(fresh(), "index")), null);
  assert.equal(back(jump(jump(fresh(), "profile"), "index")), null);
});
test("direct Profile entry has a Home fallback without earlier navigation history", () => {
  const direct = open("profile");
  assert.equal(active(direct), "profile");
  const result = back(direct);
  assert.ok(result);
  assert.equal(active(result), "index");
});

// d85ba65: the journal's Back returns to the tab it was opened from, keeping the Selected day.
test("the Personal journal returns to the last bar tab shown before it", () => {
  const visit = (paths: string[]) =>
    paths.reduce<TabPath>((previous, path) => originatingTab(previous, path), "/");
  assert.equal(visit(["/profile"]), "/");
  assert.equal(visit(["/food", "/profile"]), "/food");
  assert.equal(visit(["/exercise", "/settings", "/profile"]), "/settings");
  assert.equal(visit(["/food", "/profile", "/+not-found", "/profile"]), "/food");
});

test("Android Back leaves the journal only once header popovers have closed", () => {
  assert.equal(journalHandlesBack("/profile", null), true);
  assert.equal(journalHandlesBack("/profile", "profile"), false);
  assert.equal(journalHandlesBack("/food", null), false);
});

test("the calendar survives tab changes but closes on the journal; the menu always closes", () => {
  assert.equal(popoverAfterNavigation("calendar", "/food"), "calendar");
  assert.equal(popoverAfterNavigation("calendar", "/settings"), "calendar");
  assert.equal(popoverAfterNavigation("calendar", "/profile"), null);
  assert.equal(popoverAfterNavigation("profile", "/food"), null);
  assert.equal(popoverAfterNavigation(null, "/profile"), null);
});

test("only day screens show the Selected day and calendar", () => {
  for (const path of ["/", "/food", "/exercise"]) assert.equal(headerPage(path), null);
  assert.equal(headerPage("/profile"), "Profile");
  assert.equal(headerPage("/settings"), "Settings");
});

// a49352e: the avatar menu marks Profile as the current page only on the journal.
test("the Profile menu entry is current only on the journal", () => {
  assert.equal(isJournal("/profile"), true);
  for (const path of ["/", "/food", "/exercise", "/settings"]) assert.equal(isJournal(path), false);
});

test("route requests build the params their screens parse", () => {
  assert.deepEqual(routeRequest("workoutMenu", "2026-10-18"), {
    pathname: "/exercise",
    params: { workoutMenu: "2026-10-18" },
  });
  assert.deepEqual(routeRequest("liveWorkout", "w1"), {
    pathname: "/exercise",
    params: { liveWorkout: "w1" },
  });
  assert.deepEqual(routeRequest("workoutImport", "tracked"), {
    pathname: "/exercise",
    params: { workoutImport: "tracked" },
  });
  assert.deepEqual(routeRequest("section", "Photos"), {
    pathname: "/profile",
    params: { section: "photos" },
  });
  assert.equal(parseRouteRequest("workoutMenu", "2026-10-18"), "2026-10-18");
  assert.equal(parseRouteRequest("workoutMenu", "2026-02-30"), null);
  assert.equal(parseRouteRequest("section", "photos"), "Photos");
  assert.equal(parseRouteRequest("section", "overview"), "Overview");
  assert.equal(parseRouteRequest("section", "goals"), "Goals");
  assert.equal(parseRouteRequest("section", "Photos"), null);
  assert.equal(parseRouteRequest("section", "constructor"), null);
  assert.equal(parseRouteRequest("liveWorkout", "w1"), "w1");
});
