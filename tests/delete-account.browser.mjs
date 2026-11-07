import assert from "node:assert/strict";
import test from "node:test";
import { installAccountFixture } from "./helpers/account-fixture.mjs";
import { launchBrowser } from "./helpers/browser.mjs";

const baseURL = process.env.KINE_PREVIEW_URL || "http://localhost:8081";
const profileKey = "kinevault-track.profile.v1";
const answers = {
  name: "Deletion fixture",
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
const link = (page, name) => page.getByRole("link", { name, exact: true });

async function open(t, { signedIn, profile = null }) {
  const browser = await launchBrowser();
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 320, height: 844 } });
  if (profile)
    await context.addInitScript(
      ({ key, profile }) => {
        if (!sessionStorage.getItem("deletion-test-seeded")) {
          localStorage.setItem(key, JSON.stringify(profile));
          sessionStorage.setItem("deletion-test-seeded", "1");
        }
      },
      { key: profileKey, profile },
    );
  await installAccountFixture(context, { signedIn });
  return context.newPage();
}

async function expectPage(page) {
  await heading(page, "Delete your account");
  for (const section of ["In the app", "On the web", "What's deleted", "What isn't deleted"])
    await heading(page, section);
  // The operator's details stay visible placeholders until they're filled in.
  assert.ok((await page.getByText("[Contact email]", { exact: false }).count()) > 0);
  assert.equal(new URL(page.url()).pathname, "/delete-account");
}

test("the account deletion page opens signed out before setup and leads to sign-in", async (t) => {
  const page = await open(t, { signedIn: false });
  await page.goto(new URL("/delete-account", baseURL).href);
  await expectPage(page);
  assert.equal(await page.title(), "Delete your account · KineVault Track");
  assert.ok(
    (await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0,
    "no sideways scroll at 320px",
  );

  await link(page, "Sign in to delete your account").click();
  await heading(page, "Welcome back");
  assert.equal(new URL(page.url()).pathname, "/account");
});

test("signed in, the account deletion page opens Settings with Delete account", async (t) => {
  const page = await open(t, {
    signedIn: true,
    profile: { version: 1, kind: "complete", answers },
  });
  await page.goto(new URL("/delete-account", baseURL).href);
  await expectPage(page);
  assert.equal(await link(page, "Sign in to delete your account").count(), 0);

  await link(page, "Open Settings").click();
  await page.getByRole("button", { name: "Delete account", exact: true }).waitFor();
  assert.equal(new URL(page.url()).pathname, "/settings");
});

test("the privacy policy links to the account deletion page", async (t) => {
  const page = await open(t, { signedIn: false });
  await page.goto(new URL("/privacy", baseURL).href);
  await heading(page, "Export and deletion");
  await link(page, "How to delete your account").click();
  await expectPage(page);
});
