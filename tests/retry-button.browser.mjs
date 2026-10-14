import assert from "node:assert/strict";
import test from "node:test";
import { launchBrowser } from "./helpers/browser.mjs";

const baseURL = process.env.KINE_PREVIEW_URL || "http://localhost:8081";

test("a retry that rejects ends busy without an unhandled rejection", async (t) => {
  const browser = await launchBrowser();
  t.after(() => browser.close());
  const page = await browser.newPage();
  const fixturePath =
    "/tests/retry-button-fixture.bundle?platform=web&dev=true&hot=false&minify=false";
  if (process.env.KINE_DEV_PREVIEW_URL) {
    await page.route("**/tests/retry-button-fixture.bundle?*", async (route) => {
      const response = await route.fetch({
        url: new URL(fixturePath, process.env.KINE_DEV_PREVIEW_URL).href,
      });
      await route.fulfill({ response });
    });
  }
  await page.route("**/__test-retry-button", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html><body style="margin:0"><div id="root"></div><script src="${fixturePath}"></script></body></html>`,
    }),
  );
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.addInitScript(() => {
    window.unhandledRejections = [];
    window.addEventListener("unhandledrejection", (event) =>
      window.unhandledRejections.push(String(event.reason?.message ?? event.reason)),
    );
  });
  await page.goto(`${baseURL}/__test-retry-button`);
  const retry = page.getByRole("button", { name: "Retry fixture", exact: true });
  await retry.waitFor();
  await retry.click();
  await page.getByText("Retries started: 1", { exact: true }).waitFor();
  assert.equal(await retry.isDisabled(), true);
  assert.equal(await retry.getAttribute("aria-busy"), "true");
  await page.evaluate(() => window.failPendingRetry());
  await page.waitForFunction(
    () =>
      document.querySelector('[aria-label="Retry fixture"]')?.getAttribute("aria-busy") === null,
  );
  assert.equal(await retry.isDisabled(), false);
  // Unhandled rejections are reported after the microtask that rejected.
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 100)));
  assert.deepEqual(await page.evaluate(() => window.unhandledRejections), []);
  assert.deepEqual(pageErrors, []);
  await retry.click();
  await page.getByText("Retries started: 2", { exact: true }).waitFor();
});
