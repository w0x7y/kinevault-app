import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";

const baseURL = process.env.KINE_PREVIEW_URL || "http://localhost:8081";

test("successful child commits reset recovery attempts while immediate crashes still escalate", async (t) => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  const fixturePath =
    "/tests/error-boundary-fixture.bundle?platform=web&dev=true&hot=false&minify=false";
  if (process.env.KINE_DEV_PREVIEW_URL) {
    await page.route("**/tests/error-boundary-fixture.bundle?*", async (route) => {
      const response = await route.fetch({
        url: new URL(fixturePath, process.env.KINE_DEV_PREVIEW_URL).href,
      });
      await route.fulfill({ response });
    });
  }
  await page.route("**/__test-error-boundary", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html><body style="margin:0"><div id="root"></div><script src="${fixturePath}"></script></body></html>`,
    }),
  );
  await page.goto(`${baseURL}/__test-error-boundary`);
  const healthy = page.getByText("Healthy child committed", { exact: true });
  const crash = page.getByRole("button", { name: "Crash child", exact: true });
  const allow = page.getByRole("button", { name: "Allow recovery", exact: true });
  const reload = page.getByRole("button", { name: "Reload", exact: true });
  let navigations = 0;
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) navigations++;
  });
  // Separate successful recoveries must never exhaust the web retry budget.
  for (let attempt = 0; attempt < 4; attempt++) {
    await healthy.waitFor();
    await crash.click();
    await reload.waitFor();
    assert.equal(await page.getByText("Private fixture health record", { exact: true }).count(), 0);
    await allow.click();
    await reload.click();
    await healthy.waitFor();
    assert.equal(navigations, 0);
  }
  await crash.click();
  for (let retry = 0; retry < 2; retry++) {
    await reload.click();
    await reload.waitFor();
    assert.equal(navigations, 0);
  }
  await reload.click();
  await page.waitForFunction(() => document.body.textContent?.includes("Healthy child committed"));
  assert.equal(navigations, 1);
});
