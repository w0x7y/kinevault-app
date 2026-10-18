import assert from "node:assert/strict";
import test from "node:test";
import { launchBrowser } from "./helpers/browser.mjs";

const baseURL = process.env.KINE_PREVIEW_URL || "http://localhost:8081";

test("a document provider's readers re-render for document changes, not for its parent", async (t) => {
  const browser = await launchBrowser();
  t.after(() => browser.close());
  const page = await browser.newPage();
  const fixturePath =
    "/tests/document-provider-fixture.bundle?platform=web&dev=true&hot=false&minify=false";
  if (process.env.KINE_DEV_PREVIEW_URL) {
    await page.route("**/tests/document-provider-fixture.bundle?*", async (route) => {
      const response = await route.fetch({
        url: new URL(fixturePath, process.env.KINE_DEV_PREVIEW_URL).href,
      });
      await route.fulfill({ response });
    });
  }
  await page.route("**/__test-document-provider", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html><body style="margin:0"><div id="root"></div><script src="${fixturePath}"></script></body></html>`,
    }),
  );
  await page.goto(`${baseURL}/__test-document-provider`);
  const reader = page.getByTestId("reader");
  await page.getByText(/^Count 0, reader render \d+$/).waitFor();
  const before = await reader.textContent();
  // Navigation re-renders the layouts above every provider; an unchanged document stays quiet.
  for (let renders = 1; renders <= 3; renders++) {
    await page.getByRole("button", { name: "Re-render parent", exact: true }).click();
    await page.getByText(`Parent renders: ${renders}`, { exact: true }).waitFor();
  }
  assert.equal(await reader.textContent(), before);
  await page.getByRole("button", { name: "Change document", exact: true }).click();
  await page.getByText(/^Count 1, reader render \d+$/).waitFor();
});
