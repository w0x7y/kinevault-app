import { chromium } from "playwright";

// Date labels follow the browser's default locale, which Chromium takes from the
// system (LANGUAGE first, then LC_ALL and LANG). Pin US English so expectations
// match on any machine, not only CI.
//
// Contexts default to reduced motion so layout and value assertions read settled UI rather than
// a frame mid-animation. Tests that exercise motion opt back in with `reducedMotion` or
// `page.emulateMedia`.
export async function launchBrowser() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--lang=en-US"],
    env: { ...process.env, LANGUAGE: "en_US", LC_ALL: "en_US.UTF-8", LANG: "en_US.UTF-8" },
  });
  const newContext = browser.newContext.bind(browser);
  const newPage = browser.newPage.bind(browser);
  browser.newContext = (options = {}) => newContext({ reducedMotion: "reduce", ...options });
  browser.newPage = (options = {}) => newPage({ reducedMotion: "reduce", ...options });
  return browser;
}
