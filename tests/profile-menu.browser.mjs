import { installAccountFixture } from "./helpers/account-fixture.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { launchBrowser } from "./helpers/browser.mjs";

const baseURL = process.env.KINE_PREVIEW_URL || "http://localhost:8081";
const names = ["Profile", "Friends", "Messages", "KineVault", "Support", "Feedback"];
const entryLabel = (name) => (name === "Profile" ? name : `${name} · Upcoming`);
const button = (page, name) => page.getByRole("button", { name, exact: true });
const trigger = (page) => button(page, "Profile menu");
const menu = (page) => page.getByRole("menu", { name: "Profile menu", exact: true });

async function open(t, viewport = { width: 390, height: 844 }) {
  const browser = await launchBrowser();
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport });
  await context.addInitScript(() => {
    localStorage.setItem(
      "kinevault-track.profile.v1",
      JSON.stringify({
        version: 1,
        kind: "complete",
        answers: {
          name: "Menu fixture",
          goal: "maintain",
          activity: "moderate",
          age: "30",
          height: "180",
          weight: "80",
          sex: "male",
          estimateEnabled: true,
          eligible: true,
          customCalories: "",
        },
      }),
    );
  });
  await installAccountFixture(context);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  await page.goto(baseURL);
  await trigger(page).waitFor();
  return page;
}

test("profile menu is accessible, exclusive with the calendar, disables upcoming entries and marks Profile current; Home and Settings show steps and formats", async (t) => {
  const page = await open(t);
  assert.equal(await trigger(page).getAttribute("aria-expanded"), "false");
  const hit = await trigger(page).boundingBox();
  assert.ok(hit.width >= 44 && hit.height >= 44);
  await button(page, "Expand calendar").click();
  await button(page, "Select today").waitFor();
  await trigger(page).click();
  await menu(page).waitFor();
  assert.equal(await trigger(page).getAttribute("aria-expanded"), "true");
  assert.equal(await button(page, "Select today").count(), 0);
  assert.deepEqual(
    await menu(page)
      .getByRole("menuitem")
      .evaluateAll((entries) => entries.map((entry) => entry.getAttribute("aria-label"))),
    names.map(entryLabel),
  );
  assert.equal(await menu(page).getByRole("separator").count(), 1);
  for (const entry of await menu(page).getByRole("menuitem").all()) {
    assert.ok((await entry.boundingBox()).height >= 44);
  }
  await trigger(page).click();
  await menu(page).waitFor({ state: "detached" });
  await trigger(page).click();
  await button(page, "Expand calendar").click();
  await menu(page).waitFor({ state: "detached" });
  await button(page, "Select today").waitFor();
  // Upcoming entries are labelled and disabled without changing routes or data.
  const originalURL = page.url();
  const initialProfile = await page.evaluate(() =>
    window.accountFixture.getItem("kinevault-track.profile.v1"),
  );
  await trigger(page).click();
  for (const name of names.filter((name) => name !== "Profile")) {
    const entry = menu(page).getByRole("menuitem", { name: entryLabel(name), exact: true });
    assert.equal(await entry.isDisabled(), true);
    assert.equal(await entry.getAttribute("aria-disabled"), "true");
    assert.equal(await entry.getByText("Upcoming", { exact: true }).count(), 1);
    // Exercise a synthetic activation as well as the browser's disabled state.
    await entry.evaluate((element) => element.click());
    assert.equal(await menu(page).count(), 1);
    assert.equal(await page.getByRole("dialog").count(), 0);
    assert.equal(page.url(), originalURL);
  }
  assert.equal(
    await page.evaluate(() => window.accountFixture.getItem("kinevault-track.profile.v1")),
    initialProfile,
  );
  await trigger(page).click();
  await menu(page).waitFor({ state: "detached" });
  // Pointer opening keeps Profile neutral on Home and marks it current only on Profile.
  await trigger(page).click();
  const profile = menu(page).getByRole("menuitem", { name: "Profile", exact: true });
  const friends = menu(page).getByRole("menuitem", { name: entryLabel("Friends"), exact: true });
  assert.equal(await profile.getAttribute("aria-current"), null);
  assert.equal(await profile.evaluate((node) => node === document.activeElement), false);
  assert.equal(
    await profile.evaluate((node) => getComputedStyle(node).backgroundColor),
    await friends.evaluate((node) => getComputedStyle(node).backgroundColor),
  );
  assert.equal(
    await profile.evaluate((node) => getComputedStyle(node).borderTopColor),
    "rgba(0, 0, 0, 0)",
  );
  await page.keyboard.press("ArrowDown");
  assert.equal(await profile.evaluate((node) => node === document.activeElement), true);
  assert.equal(await profile.getAttribute("aria-current"), null);
  await page.keyboard.press("Escape");
  await trigger(page).click();
  await profile.click();
  await page.waitForURL("**/profile");
  await trigger(page).click();
  await profile.waitFor();
  assert.equal(await profile.getAttribute("aria-current"), "page");
  assert.equal(await profile.evaluate((node) => node === document.activeElement), false);
  assert.notEqual(
    await profile.evaluate((node) => getComputedStyle(node).backgroundColor),
    await friends.evaluate((node) => getComputedStyle(node).backgroundColor),
  );
  await page.keyboard.press("Escape");
  await button(page, "Back from Profile").click();
  await trigger(page).click();
  assert.equal(await profile.getAttribute("aria-current"), null);
  assert.equal(
    await profile.evaluate((node) => getComputedStyle(node).backgroundColor),
    await friends.evaluate((node) => getComputedStyle(node).backgroundColor),
  );
  await page.keyboard.press("Escape");
  // Home offers to log steps the web build can't count, and Settings states the supported
  // app formats.
  const steps = page.getByTestId("home-steps");
  await steps.waitFor();
  assert.equal(await steps.getByText("Tap to log steps", { exact: true }).count(), 1);
  assert.equal(await steps.getByText("—", { exact: true }).count(), 1);
  assert.equal(await steps.getByText("0", { exact: true }).count(), 0);
  assert.equal(await steps.getAttribute("role"), "button");
  await page.getByRole("tab", { name: "Settings", exact: true }).click();
  // The supported formats are a footer line rather than a settings group.
  await page
    .getByText("English · Metric (kg, cm, km, ml) · Version 1.0.0", { exact: true })
    .waitFor();
  assert.equal(await page.getByRole("radiogroup", { name: "Appearance", exact: true }).count(), 1);
});

test("keyboard opens the menu, skips disabled entries, selects Profile, and dismisses with Escape", async (t) => {
  const page = await open(t);
  await trigger(page).focus();
  await page.keyboard.press("Enter");
  await menu(page).waitFor();
  const focusedName = () => page.evaluate(() => document.activeElement.getAttribute("aria-label"));
  assert.equal(await focusedName(), "Profile");
  for (const key of ["ArrowDown", "End", "ArrowDown", "ArrowUp", "Home"]) {
    await page.keyboard.press(key);
    assert.equal(await focusedName(), "Profile");
  }
  await page.keyboard.press("Escape");
  await menu(page).waitFor({ state: "detached" });
  assert.equal(await focusedName(), "Profile menu");
  await page.keyboard.press("Space");
  await menu(page).waitFor();
  await page.keyboard.press("Enter");
  await page.waitForURL("**/profile");
  await menu(page).waitFor({ state: "detached" });
});

test("outside click, keyboard focus leaving, and route changes close the dropdown; it fits small and wide screens", async (t) => {
  const page = await open(t, { width: 320, height: 568 });
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 1280, height: 800 },
    { width: 320, height: 240 },
  ]) {
    await page.setViewportSize(viewport);
    await trigger(page).click();
    const bounds = await menu(page).boundingBox();
    const hit = await trigger(page).boundingBox();
    assert.ok(
      Math.abs(bounds.y - (hit.y + hit.height + 4)) < 2,
      "menu starts immediately beneath the header",
    );
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= viewport.width);
    assert.ok(bounds.y + bounds.height <= viewport.height);
    assert.ok(Math.abs(bounds.x + bounds.width - (hit.x + hit.width)) < 2);
    await menu(page)
      .getByRole("menuitem", { name: entryLabel("Feedback"), exact: true })
      .scrollIntoViewIfNeeded();
    await page.mouse.click(3, viewport.height - 100);
    await menu(page).waitFor({ state: "detached" });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await trigger(page).click();
  await page.mouse.click(195, 25);
  await menu(page).waitFor({ state: "detached" });
  await trigger(page).click();
  await button(page, "Expand calendar").focus();
  await menu(page).waitFor({ state: "detached" });
  await trigger(page).click();
  // Exercise a navigation event while the dropdown is open, bypassing its dismiss backdrop.
  await page.getByRole("tab", { name: /Food/ }).evaluate((element) => element.click());
  await page.waitForURL("**/food");
  await menu(page).waitFor({ state: "detached" });
  assert.equal(await trigger(page).getAttribute("aria-expanded"), "false");
  await trigger(page).click();
  assert.equal(
    await menu(page)
      .getByRole("menuitem", { name: entryLabel("Support"), exact: true })
      .isDisabled(),
    true,
  );
  await page.keyboard.press("Escape");
  await menu(page).waitFor({ state: "detached" });
});

test("a tab opens at the top after another tab, but keeps its place under a pushed page", async (t) => {
  const page = await open(t, { width: 390, height: 560 });
  // The visible screen's scroller; a hidden tab's sits under aria-hidden or display: none.
  const scrolled = (top) =>
    page.evaluate((top) => {
      const scroller = [...document.querySelectorAll("div")].find(
        (node) =>
          node.offsetParent !== null &&
          !node.closest('[aria-hidden="true"]') &&
          /auto|scroll/.test(getComputedStyle(node).overflowY) &&
          node.scrollHeight > node.clientHeight + 100,
      );
      if (top !== undefined) scroller.scrollTop = top;
      return scroller.scrollTop;
    }, top);
  // A hidden tab stays in the DOM, so wait for the route instead of its text.
  const tab = async (name, path) => {
    await page.getByRole("tab", { name, exact: true }).click();
    await page.waitForURL((url) => url.pathname === path);
  };
  await tab("Settings", "/settings");
  assert.ok((await scrolled(200)) > 0);
  await tab("Home", "/");
  await tab("Settings", "/settings");
  assert.equal(await scrolled(), 0);
  // Edit profile slides over the tabs; going back doesn't jump Settings to the top.
  assert.ok((await scrolled(200)) > 0);
  await page.getByText("Edit profile", { exact: true }).click();
  await page.waitForURL(/onboarding/);
  await page.goBack();
  await page.getByText("Edit profile", { exact: true }).waitFor();
  assert.ok((await scrolled()) > 0);
});
