import { installAccountFixture } from "./helpers/account-fixture.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { launchBrowser } from "./helpers/browser.mjs";

const baseURL = process.env.KINE_PREVIEW_URL || "http://localhost:8081";
const answers = {
  name: "Steps fixture",
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
const button = (page, name) => page.getByRole("button", { name, exact: true });
const dialog = (page) => page.getByRole("dialog", { name: "Log steps", exact: true });
const field = (page) => dialog(page).getByRole("textbox", { name: "Logged steps", exact: true });

test("the Steps tile logs steps for the selected day on this device, with ±500 steppers", async (t) => {
  const browser = await launchBrowser();
  t.after(() => browser.close());
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    timezoneId: "Asia/Jerusalem",
  });
  await context.addInitScript((answers) => {
    if (!sessionStorage.getItem("steps-fixture-seeded")) {
      localStorage.setItem(
        "kinevault-track.profile.v1",
        JSON.stringify({ version: 1, kind: "complete", answers }),
      );
      sessionStorage.setItem("steps-fixture-seeded", "true");
    }
  }, answers);
  await installAccountFixture(context);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  await page.clock.install({ time: new Date("2026-10-01T12:00:00+03:00") });
  await page.goto(baseURL);
  const tile = page.getByTestId("home-steps");
  await tile.getByText("Tap to log steps", { exact: true }).waitFor();
  await tile.click();
  // The web build can't count steps, and says so.
  await dialog(page)
    .getByText("Phone step counting isn't available on this device.", { exact: true })
    .waitFor();
  assert.equal(await field(page).inputValue(), "0");
  await button(dialog(page), "+500 steps").click();
  await button(dialog(page), "+500 steps").click();
  assert.equal(await field(page).inputValue(), "1000");
  await button(dialog(page), "-500 steps").click();
  assert.equal(await field(page).inputValue(), "500");
  await field(page).fill("1500");
  await button(dialog(page), "Save steps").click();
  await dialog(page).waitFor({ state: "detached" });
  const total = tile.getByTestId("home-steps-total");
  assert.equal(await total.innerText(), "1,500");
  await tile.getByText("Logged manually", { exact: true }).waitFor();
  assert.match(await tile.getAttribute("aria-label"), /^Log steps\. 1,500 steps for /);
  // Logged steps stay on this device, scoped to the signed-in account.
  const keys = await page.evaluate(() =>
    Object.keys(localStorage).filter((key) => key.endsWith("kinevault-track.steps-log.v1")),
  );
  assert.equal(keys.length, 1);
  assert.match(keys[0], /^kinevault-track\.account\./);
  await page.reload();
  await total.waitFor();
  assert.equal(await total.innerText(), "1,500");
  await tile.click();
  await field(page).waitFor();
  assert.equal(await field(page).inputValue(), "1500");
  // Another day has its own count.
  await button(dialog(page), "Cancel").click();
  await dialog(page).waitFor({ state: "detached" });
  await button(page, "Expand calendar").click();
  await page.getByRole("button", { name: /^Wednesday, September 30, 2026/ }).click();
  await button(page, "Collapse calendar").click();
  await tile.getByText("Tap to log steps", { exact: true }).waitFor();
  assert.equal(await total.innerText(), "—");
});
