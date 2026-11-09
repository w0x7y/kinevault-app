import assert from "node:assert/strict";
import test from "node:test";
import { journalTab, trackTabs } from "../src/navigation/track-tabs.ts";
import { bubblePlacement, spotlight } from "../src/tour/layout.ts";
import { tourSteps, type TourTargetId } from "../src/tour/steps.ts";

test("the App tour visits every screen once, and moves on only from the way there", () => {
  const steps = tourSteps("ios");
  const screens = steps.map((step) => step.path).filter((path, i, all) => path !== all[i - 1]);
  const bar = trackTabs.map((tab) => tab.path);
  assert.deepEqual(screens, [...bar.slice(0, -1), journalTab.path, bar.at(-1)]);
  const wayTo: Record<string, TourTargetId> = {
    "/food": "tab.food",
    "/exercise": "tab.exercise",
    "/profile": "header.avatar",
    "/settings": "tab.settings",
  };
  steps.forEach((step, i) => {
    if (i > 0 && step.path !== steps[i - 1]!.path)
      assert.equal(steps[i - 1]!.target, wayTo[step.path], `the step before ${step.path}`);
  });
  assert.equal(new Set(steps.map((step) => step.target)).size, steps.length);
});

test("the App tour mentions phone steps, reminders and health saving only on phones", () => {
  const text = (platform: string) =>
    tourSteps(platform)
      .map((step) => step.text)
      .join(" ");
  for (const platform of ["ios", "android"]) {
    assert.match(text(platform), /Steps count from your phone/);
    assert.match(text(platform), /Reminders, health saving/);
  }
  assert.doesNotMatch(text("web"), /phone|Reminders|health/);
});

const screen = { width: 390, height: 844 };

test("a highlight is padded and cut to the band its view scrolls in", () => {
  const band = { top: 100, bottom: 750, width: 390 };
  assert.deepEqual(spotlight({ x: 20, y: 200, width: 350, height: 60 }, 6, band), {
    x: 14,
    y: 194,
    width: 362,
    height: 72,
  });
  // A long list under the tab bar is cut at its top; one hidden under the header is skipped.
  assert.deepEqual(spotlight({ x: 20, y: 600, width: 350, height: 900 }, 6, band), {
    x: 14,
    y: 594,
    width: 362,
    height: 156,
  });
  assert.equal(spotlight({ x: 20, y: 40, width: 350, height: 70 }, 6, band), null);
  assert.equal(spotlight({ x: 20, y: 300, width: 0, height: 0 }, 0, band), null);
});

test("the bubble sits on the roomier side of the highlight, on screen, pointing at it", () => {
  // A tab near the bottom: the bubble sits above, kept in from the right edge.
  const tab = bubblePlacement({ x: 290, y: 760, width: 90, height: 56 }, screen);
  assert.deepEqual(tab, { left: 34, width: 340, bottom: 98, arrow: 301 });
  // The header's calendar near the top: below, kept in from the left edge, the arrow clamped.
  const day = bubblePlacement({ x: 10, y: 50, width: 48, height: 48 }, screen);
  assert.deepEqual(day, { left: 16, width: 340, top: 112, arrow: 24 });
  // Nothing to point at: centered a third of the way down, without a pointer.
  assert.deepEqual(bubblePlacement(null, { width: 320, height: 640 }), {
    left: 16,
    width: 288,
    top: 640 / 3,
  });
});
