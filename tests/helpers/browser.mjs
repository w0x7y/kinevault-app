import { chromium } from "playwright";

// Date labels follow the browser's default locale, which Chromium takes from the
// system (LANGUAGE first, then LC_ALL and LANG). Pin US English so expectations
// match on any machine, not only CI.
export function launchBrowser() {
  return chromium.launch({
    headless: true,
    args: ["--lang=en-US"],
    env: { ...process.env, LANGUAGE: "en_US", LC_ALL: "en_US.UTF-8", LANG: "en_US.UTF-8" },
  });
}
