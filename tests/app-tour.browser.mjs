import { installAccountFixture } from "./helpers/account-fixture.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { launchBrowser } from "./helpers/browser.mjs";

const baseURL = process.env.KINE_PREVIEW_URL || "http://localhost:8081";
const answers = {
  name: "Tour fixture",
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
const bubble = (page, name) => page.getByRole("dialog", { name, exact: true });
const button = (scope, name) => scope.getByRole("button", { name, exact: true });
const at = (page, path) => page.waitForURL((url) => url.pathname === path);
const highlight = (page) => page.getByTestId("app-tour-highlight");

/** Whether the highlight surrounds the element, give or take its padding. */
async function surrounds(page, element) {
  const [outer, inner] = await Promise.all([highlight(page).boundingBox(), element.boundingBox()]);
  return (
    outer.x <= inner.x &&
    outer.y <= inner.y &&
    outer.x + outer.width >= inner.x + inner.width &&
    outer.y + outer.height >= inner.y + inner.height &&
    outer.width - inner.width <= 16 &&
    outer.height - inner.height <= 16
  );
}

test("the App tour spotlights each feature, moves on from the highlight and can be replayed", async (t) => {
  const browser = await launchBrowser();
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript((answers) => {
    if (!sessionStorage.getItem("tour-fixture-seeded")) {
      localStorage.setItem(
        "kinevault-track.profile.v1",
        JSON.stringify({ version: 1, kind: "complete", answers }),
      );
      sessionStorage.setItem("tour-fixture-seeded", "true");
    }
  }, answers);
  await installAccountFixture(context, { appTour: true });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  await page.goto(baseURL);

  // The first launch opens on the header's calendar, with the app behind hidden from assistive tech.
  await bubble(page, "Pick a day").getByText("Tour · 1 of 14", { exact: true }).waitFor();
  assert.ok(await surrounds(page, page.locator('[aria-label="Expand calendar"]')));
  assert.equal(await page.getByRole("tab", { name: "Food", exact: true }).count(), 0);
  assert.equal(await button(page, "Back").count(), 0, "the first step has no Back");

  // Tapping the highlight moves on; so do Next from the keyboard and Back.
  await highlight(page).click();
  await bubble(page, "Calories and macros").waitFor();
  await page.keyboard.press("Enter");
  await bubble(page, "Steps and water").waitFor();
  await button(page, "Back").click();
  await bubble(page, "Calories and macros").waitFor();
  await button(page, "Next").click();
  await button(page, "Next").click();

  // The Food tab is highlighted; tapping it opens Food and spotlights its search. A quick second
  // tap lands before the next bubble shows, so it can't skip that step.
  await bubble(page, "Food").waitFor();
  await highlight(page).dblclick();
  await at(page, "/food");
  await bubble(page, "Search foods").waitFor();
  await page.waitForTimeout(400);
  assert.equal(await bubble(page, "Search foods").count(), 1, "a double tap moves on once");
  const search = page.getByRole("textbox", { name: "Search foods", exact: true });
  const searchBox = page.locator('[data-testid="food-search-box"]');
  assert.ok(await searchBox.count(), "the search box renders");
  assert.ok(await surrounds(page, searchBox), "the highlight surrounds the search box");
  assert.equal(await search.count(), 0, "the app behind stays hidden");

  // Escape ends the tour where it began and it stays finished.
  await page.keyboard.press("Escape");
  await page.getByTestId("app-tour").waitFor({ state: "detached" });
  await at(page, "/");
  assert.equal(await page.evaluate(() => localStorage.getItem("kinevault-track.app-tour")), "seen");
  await page.reload();
  await page.getByTestId("home-greeting").waitFor();
  await page.waitForTimeout(1000);
  assert.equal(await page.getByTestId("app-tour").count(), 0, "a finished tour stays closed");

  // Settings replays it; tapping each highlight walks every screen to the end.
  await page.getByRole("tab", { name: "Settings", exact: true }).click();
  await button(page, "Take the tour").click();
  await bubble(page, "Pick a day").waitFor();
  await at(page, "/");
  const screens = [];
  for (let step = 1; step < 14; step++) {
    await page.getByText(`Tour · ${step} of 14`, { exact: true }).waitFor();
    await highlight(page).click();
    await page.getByText(`Tour · ${step + 1} of 14`, { exact: true }).waitFor();
    const path = new URL(page.url()).pathname;
    if (screens.at(-1) !== path) screens.push(path);
  }
  assert.deepEqual(screens, ["/", "/food", "/exercise", "/profile", "/settings"]);
  await bubble(page, "Your account").waitFor();
  assert.equal(await button(page, "Skip tour").count(), 0, "the last step has no Skip");
  await button(page, "Done").click();
  await page.getByTestId("app-tour").waitFor({ state: "detached" });
  await at(page, "/settings");
});
