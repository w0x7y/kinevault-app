import assert from "node:assert/strict";
import test from "node:test";
import { installAccountFixture } from "./helpers/account-fixture.mjs";
import { launchBrowser } from "./helpers/browser.mjs";

const baseURL = process.env.KINE_PREVIEW_URL || "http://localhost:8081";
const profileKey = "kinevault-track.profile.v1";
const answers = {
  name: "Privacy fixture",
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
const heading = (page, name) =>
  page.getByRole("heading", { name, exact: true }).waitFor({ timeout: 10000 });
const button = (page, name) => page.getByRole("button", { name, exact: true });

async function open(t, { signedIn, profile = null, viewport = { width: 320, height: 844 } }) {
  const browser = await launchBrowser();
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport });
  if (profile)
    await context.addInitScript(
      ({ key, profile }) => {
        if (!sessionStorage.getItem("privacy-test-seeded")) {
          localStorage.setItem(key, JSON.stringify(profile));
          sessionStorage.setItem("privacy-test-seeded", "1");
        }
      },
      { key: profileKey, profile },
    );
  const accountFixture = await installAccountFixture(context, { signedIn });
  const page = await context.newPage();
  page.accountFixture = accountFixture;
  return page;
}

async function expectPolicy(page) {
  await heading(page, "Privacy policy");
  await heading(page, "Apple Health and Health Connect");
  await heading(page, "Export and deletion");
  // The operator's details stay visible placeholders until they're filled in.
  for (const placeholder of [
    "[Operator name]",
    "[Contact email]",
    "[Effective date]",
    "[Retention period]",
  ])
    assert.ok((await page.getByText(placeholder, { exact: false }).count()) > 0, placeholder);
  assert.equal(new URL(page.url()).pathname, "/privacy");
}

test("the privacy policy opens signed out before setup and fits phone and desktop widths", async (t) => {
  const page = await open(t, { signedIn: false });
  await page.goto(new URL("/privacy", baseURL).href);
  await expectPolicy(page);
  assert.equal(await page.title(), "Privacy policy · KineVault Track");
  const overflow = () =>
    page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok((await overflow()) <= 0, "no sideways scroll at 320px");

  await page.setViewportSize({ width: 1280, height: 900 });
  const title = page.getByRole("heading", { name: "Privacy policy", exact: true });
  const box = await title.boundingBox();
  // The text column stays a readable width and centered on a wide screen.
  assert.ok(box && box.x > 250 && box.x < 330, `column starts at ${box?.x}`);
  assert.ok((await overflow()) <= 0, "no sideways scroll at 1280px");

  // With no history, Back leaves for the app's start, which is setup when signed out.
  await button(page, "Back").click();
  await button(page, "Let's go").waitFor();
});

test("the privacy policy shows past a damaged Profile and a failed cloud download", async (t) => {
  const page = await open(t, {
    signedIn: true,
    profile: { version: 1, kind: "complete", answers },
  });
  await page.goto(baseURL);
  await heading(page, "Calories");
  await page.evaluate((key) => window.accountFixture.setItem(key, "{damaged"), profileKey);
  await page.goto(new URL("/privacy", baseURL).href);
  await expectPolicy(page);
  assert.equal(
    await page.getByRole("heading", { name: "Couldn't load your profile", exact: true }).count(),
    0,
  );

  page.accountFixture.cloudError = true;
  await page.reload();
  await expectPolicy(page);
  assert.equal(await page.getByText("Couldn't load this account's saved data.").count(), 0);
});

test("Settings and the sign-in screen link to the privacy policy, and Back returns", async (t) => {
  const page = await open(t, {
    signedIn: true,
    profile: { version: 1, kind: "complete", answers },
  });
  await page.goto(new URL("/settings", baseURL).href);
  await page.getByRole("link", { name: /^Privacy policy/ }).click();
  await expectPolicy(page);
  await button(page, "Back").click();
  await page.getByRole("link", { name: /^Privacy policy/ }).waitFor();
  assert.equal(new URL(page.url()).pathname, "/settings");

  await button(page, "Log out").click();
  await heading(page, "Welcome back");
  await button(page, "Privacy policy").click();
  await expectPolicy(page);
  await button(page, "Back").click();
  await heading(page, "Welcome back");
});
