import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  TabRouter,
  type BackBehavior,
} from "../node_modules/expo-router/build/react-navigation/routers/TabRouter.js";

// Exercise the installed router using the route order and options the app supplies.
const layout = readFileSync(
  new URL("../src/app/(tabs)/_layout.tsx", import.meta.url),
  "utf8",
);
const routeNames = [...layout.matchAll(/<Tabs\.Screen\s+name="([^"]+)"/g)].map(
  (match) => match[1],
);
const options = { routeNames, routeParamList: {}, routeGetIdList: {} };
const router = TabRouter({
  initialRouteName: layout.match(/initialRouteName="([^"]+)"/)?.[1],
  backBehavior: layout.match(
    /backBehavior="(firstRoute|initialRoute|order|history|fullHistory|none)"/,
  )?.[1] as BackBehavior | undefined,
});
const fresh = () => router.getInitialState(options);
function jump(state: ReturnType<typeof fresh>, name: string) {
  const next = router.getStateForAction(
    state,
    { type: "JUMP_TO", payload: { name } },
    options,
  );
  assert.ok(next);
  return router.getRehydratedState(next, options);
}
function back(state: ReturnType<typeof fresh>) {
  const next = router.getStateForAction(state, { type: "GO_BACK" }, options);
  return next ? router.getRehydratedState(next, options) : null;
}
const active = (state: ReturnType<typeof fresh>) =>
  state.routes[state.index].name;

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
      assert.equal(
        active(result),
        "index",
        `${source} Back must not select hidden Profile`,
      );
    }
  }
});
test("Home Back never selects hidden Profile even after a Profile visit", () => {
  assert.equal(back(jump(fresh(), "index")), null);
  assert.equal(back(jump(jump(fresh(), "profile"), "index")), null);
});
test("direct Profile entry has a Home fallback without earlier navigation history", () => {
  const direct = router.getRehydratedState(
    { stale: true, index: 0, routes: [{ name: "profile" }] },
    options,
  );
  assert.equal(active(direct), "profile");
  const result = back(direct);
  assert.ok(result);
  assert.equal(active(result), "index");
});
