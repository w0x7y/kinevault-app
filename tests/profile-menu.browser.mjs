import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";

const baseURL = process.env.KINE_PREVIEW_URL || "http://localhost:8081";
const names = ["Profile", "Friends", "Messages", "KineVault", "Support", "Feedback"];
const button = (page, name) => page.getByRole("button", { name, exact: true });
const trigger = page => button(page, "Profile menu");
const menu = page => page.getByRole("menu", { name: "Profile menu", exact: true });

async function open(t, viewport = { width: 390, height: 844 }) {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport });
  await context.addInitScript(() => {
    localStorage.setItem("kinevault-track.profile.v1", JSON.stringify({ version: 1, kind: "complete", answers: {
      name: "Menu fixture", goal: "maintain", activity: "moderate", age: "30", height: "180", weight: "80",
      sex: "male", estimateEnabled: true, eligible: true, customCalories: "",
    } }));
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  await page.goto(baseURL);
  await trigger(page).waitFor();
  return page;
}

test("profile trigger is accessible, toggles the ordered dropdown, and is mutually exclusive with calendar", async t => {
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
  assert.deepEqual(await menu(page).getByRole("menuitem").evaluateAll(entries => entries.map(entry => entry.getAttribute("aria-label"))), names);
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
});

test("other menu entries open honest coming-soon panels, closes the menu, and dismisses without changing routes or data", async t => {
  const page = await open(t);
  const originalURL = page.url();
  const initialProfile = await page.evaluate(() => localStorage.getItem("kinevault-track.profile.v1"));
  for (const name of names.filter(name => name !== "Profile")) {
    await trigger(page).click();
    await menu(page).getByRole("menuitem", { name, exact: true }).click();
    await menu(page).waitFor({ state: "detached" });
    const panel = page.getByRole("dialog", { name: `${name} coming soon`, exact: true });
    await panel.waitFor();
    assert.equal(await panel.evaluate(() => document.activeElement.getAttribute("aria-label")), "Dismiss");
    for (const key of ["Tab", "Tab", "Tab", "Shift+Tab", "Shift+Tab", "Shift+Tab"]) {
      await page.keyboard.press(key);
      assert.equal(await panel.evaluate(element => {
        const focused = document.activeElement;
        return element.contains(focused) && !focused.closest('[aria-hidden="true"]') &&
          focused.getBoundingClientRect().height > 0;
      }), true, `${name} focus stays on visible content after ${key}`);
    }
    await panel.getByRole("heading", { name, exact: true }).waitFor();
    await panel.getByText("Coming soon", { exact: true }).waitFor();
    assert.match(await panel.innerText(), /isn't available yet/);
    assert.equal(await panel.getByRole("textbox").count(), 0);
    assert.equal(page.url(), originalURL);
    await button(panel, "Dismiss").click();
    await panel.waitFor({ state: "detached" });
    assert.equal(await trigger(page).getAttribute("aria-expanded"), "false");
  }
  assert.equal(await page.evaluate(() => localStorage.getItem("kinevault-track.profile.v1")), initialProfile);
});

test("keyboard opens the menu, moves through entries, selects and dismisses with Escape, and restores trigger focus", async t => {
  const page = await open(t);
  await trigger(page).focus();
  await page.keyboard.press("Enter");
  await menu(page).waitFor();
  const focusedName = () => page.evaluate(() => document.activeElement.getAttribute("aria-label"));
  assert.equal(await focusedName(), "Profile");
  await page.keyboard.press("ArrowDown");
  assert.equal(await focusedName(), "Friends");
  await page.keyboard.press("End");
  assert.equal(await focusedName(), "Feedback");
  await page.keyboard.press("ArrowDown");
  assert.equal(await focusedName(), "Profile");
  await page.keyboard.press("ArrowUp");
  assert.equal(await focusedName(), "Feedback");
  await page.keyboard.press("Home");
  assert.equal(await focusedName(), "Profile");
  for (const name of ["Friends", "Messages", "KineVault"]) {
    await page.keyboard.press("ArrowDown");
    assert.equal(await focusedName(), name);
  }
  await page.keyboard.press("Enter");
  const panel = page.getByRole("dialog", { name: "KineVault coming soon", exact: true });
  await panel.waitFor();
  await page.keyboard.press("Escape");
  await panel.waitFor({ state: "detached" });
  assert.equal(await focusedName(), "Profile menu");
  await page.keyboard.press("Space");
  await menu(page).waitFor();
  await page.keyboard.press("Escape");
  await menu(page).waitFor({ state: "detached" });
  assert.equal(await focusedName(), "Profile menu");
});

test("pointer opening keeps Profile neutral on Home and marks it current only on Profile", async t => {
  const page = await open(t);
  await trigger(page).click();
  const profile = menu(page).getByRole("menuitem", { name: "Profile", exact: true });
  const friends = menu(page).getByRole("menuitem", { name: "Friends", exact: true });
  assert.equal(await profile.getAttribute("aria-current"), null);
  assert.equal(await profile.evaluate(node => node === document.activeElement), false);
  assert.equal(await profile.evaluate(node => getComputedStyle(node).backgroundColor), await friends.evaluate(node => getComputedStyle(node).backgroundColor));
  assert.equal(await profile.evaluate(node => getComputedStyle(node).borderTopColor), "rgba(0, 0, 0, 0)");
  await page.keyboard.press("ArrowDown");
  assert.equal(await profile.evaluate(node => node === document.activeElement), true);
  assert.equal(await profile.getAttribute("aria-current"), null);
  await page.keyboard.press("Escape");
  await trigger(page).click();
  await profile.click();
  await page.waitForURL("**/profile");
  await trigger(page).click();
  await profile.waitFor();
  assert.equal(await profile.getAttribute("aria-current"), "page");
  assert.equal(await profile.evaluate(node => node === document.activeElement), false);
  assert.notEqual(await profile.evaluate(node => getComputedStyle(node).backgroundColor), await friends.evaluate(node => getComputedStyle(node).backgroundColor));
  await page.keyboard.press("Escape");
  await button(page, "Back from Profile").click();
  await trigger(page).click();
  assert.equal(await profile.getAttribute("aria-current"), null);
  assert.equal(await profile.evaluate(node => getComputedStyle(node).backgroundColor), await friends.evaluate(node => getComputedStyle(node).backgroundColor));
});

test("outside click, keyboard focus leaving, and route changes close the dropdown; it fits small and wide screens", async t => {
  const page = await open(t, { width: 320, height: 568 });
  for (const viewport of [{ width: 320, height: 568 }, { width: 1280, height: 800 }, { width: 320, height: 240 }]) {
    await page.setViewportSize(viewport);
    await trigger(page).click();
    const bounds = await menu(page).boundingBox();
    const hit = await trigger(page).boundingBox();
    assert.ok(Math.abs(bounds.y - (hit.y + hit.height + 4)) < 2, "menu starts immediately beneath the header");
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= viewport.width);
    assert.ok(bounds.y + bounds.height <= viewport.height);
    assert.ok(Math.abs(bounds.x + bounds.width - (hit.x + hit.width)) < 2);
    await menu(page).getByRole("menuitem", { name: "Feedback", exact: true }).scrollIntoViewIfNeeded();
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
  await page.getByRole("tab", { name: /Food/ }).evaluate(element => element.click());
  await page.waitForURL("**/food");
  await menu(page).waitFor({ state: "detached" });
  assert.equal(await trigger(page).getAttribute("aria-expanded"), "false");
  await trigger(page).click();
  await menu(page).getByRole("menuitem", { name: "Support", exact: true }).click();
  await page.getByRole("dialog", { name: "Support coming soon", exact: true }).waitFor();
  await page.mouse.click(3, 100);
  await page.getByRole("dialog").waitFor({ state: "detached" });
});

 test("Profile menu navigates to the journal and returns to the previous tab", async t => {
  const page = await open(t);
  await page.getByRole("tab", { name: "Food", exact: true }).click();
  await trigger(page).click();
  await menu(page).getByRole("menuitem", { name: "Profile", exact: true }).click();
  await page.waitForURL("**/profile");
  await button(page, "Overview").waitFor();
  assert.equal(await page.getByRole("tab").count(), 4);
  assert.equal(await button(page, "Expand calendar").count(), 0);
  await button(page, "Back from Profile").click();
  await page.waitForURL("**/food");
 });
