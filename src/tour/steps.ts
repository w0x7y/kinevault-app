import { journalTab, type TabPath, type trackTabs } from "../navigation/track-tabs.ts";

/** The things the App tour can highlight. Each one is tagged where it renders. */
export type TourTargetId =
  | "header.day"
  | "header.avatar"
  | `tab.${(typeof trackTabs)[number]["name"]}`
  | "home.calories"
  | "home.activity"
  | `${"food" | "exercise"}.${"search" | "actions"}`
  | "food.meals"
  | "profile.sections"
  | "settings.account";

export type TourStep = {
  /** The screen the step shows. */
  path: TabPath | typeof journalTab.path;
  target: TourTargetId;
  title: string;
  text: string;
};

/** The header and tab bar sit over the screens; everything else scrolls between them. */
export function isChrome(target: TourTargetId): boolean {
  return target.startsWith("header.") || target.startsWith("tab.");
}

/**
 * The App tour, one highlight at a time. A step that moves to another screen highlights the way
 * there, a tab or the avatar, so tapping it feels like opening that screen. Phone steps,
 * Reminders and Health saving don't exist in the web preview, so it doesn't mention them.
 */
export function tourSteps(platform: string): TourStep[] {
  const phone = platform === "ios" || platform === "android";
  return [
    {
      path: "/",
      target: "header.day",
      title: "Pick a day",
      text: "Tap the calendar to look back at any day. Home, Food and Exercise all follow it.",
    },
    {
      path: "/",
      target: "home.calories",
      title: "Calories and macros",
      text: "The ring shows the calories you have left, with carbs, protein and fat beside it.",
    },
    {
      path: "/",
      target: "home.activity",
      title: "Steps and water",
      text: phone
        ? "Steps count from your phone. Tap a tile to add steps or water by hand."
        : "Tap a tile to log steps or add water.",
    },
    {
      path: "/",
      target: "tab.food",
      title: "Food",
      text: "Tap Food to open your food log.",
    },
    {
      path: "/food",
      target: "food.search",
      title: "Search foods",
      text: "Find foods offline, along with the foods and meals you save.",
    },
    {
      path: "/food",
      target: "food.actions",
      title: "Shortcuts",
      text: "Scan a barcode, create your own food or meal, or see the day's full nutrition.",
    },
    {
      path: "/food",
      target: "food.meals",
      title: "Your meals",
      text: "Breakfast, Lunch, Dinner, Snacks and Drinks. Edit or remove any entry, or copy food from another day.",
    },
    {
      path: "/food",
      target: "tab.exercise",
      title: "Exercise",
      text: "Tap Exercise to open your workout log.",
    },
    {
      path: "/exercise",
      target: "exercise.search",
      title: "Search exercises",
      text: "Find your exercises by name, muscle group, equipment or notes.",
    },
    {
      path: "/exercise",
      target: "exercise.actions",
      title: "Workouts",
      text: "Start a saved workout or create your own. Live workouts have a rest timer, plates per side and last time's numbers.",
    },
    {
      path: "/exercise",
      target: "header.avatar",
      title: "Your journal",
      text: "Tap your avatar to open your personal journal.",
    },
    {
      path: journalTab.path,
      target: "profile.sections",
      title: "Overview, Goals and Photos",
      text: "Your streak, workout graph, weight and measurements, your targets, and progress photos that stay on this device.",
    },
    {
      path: journalTab.path,
      target: "tab.settings",
      title: "Settings",
      text: "Tap Settings for your account and preferences.",
    },
    {
      path: "/settings",
      target: "settings.account",
      title: "Your account",
      text: phone
        ? "Everything syncs to your account. Reminders, health saving, units and more are below, and Help replays this tour."
        : "Everything syncs to your account. Units, appearance and more are below, and Help replays this tour.",
    },
  ];
}
