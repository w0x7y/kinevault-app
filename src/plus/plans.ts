import type { IconName } from "../components/icon.tsx";
import { freeLimits, type PlusFeature } from "./gate.ts";

/**
 * Plus prices in US dollars, the one place they live. Store billing will read the store's own
 * localized prices instead.
 */
export const plusPrices = { yearly: 34.99, monthly: 4.99, trialDays: 7 } as const;
export type PlusPlan = "yearly" | "monthly";

const dollars = (amount: number) => `$${amount.toFixed(2)}`;

/** The two plan cards, Yearly first. Savings round down so they never overstate. */
export function plusPlanCards() {
  const { yearly, monthly, trialDays } = plusPrices;
  return [
    {
      plan: "yearly" as const,
      name: "Yearly",
      caption: `${trialDays} days free, then billed yearly`,
      price: dollars(yearly),
      per: `${dollars(Math.round((yearly / 12) * 100) / 100)} a month`,
      badge: `Save ${Math.floor((1 - yearly / (monthly * 12)) * 100)}%`,
    },
    {
      plan: "monthly" as const,
      name: "Monthly",
      caption: "Cancel anytime",
      price: dollars(monthly),
      per: "a month",
      badge: null,
    },
  ];
}

/** The store that bills Plus. The web preview can't buy, so it shows the iPhone copy. */
export function plusStore(os: string) {
  return os === "android"
    ? {
        name: "Google Play",
        health: "Health Connect",
        subscriptionsUrl: "https://play.google.com/store/account/subscriptions",
        termsUrl: "https://play.google.com/about/play-terms/",
      }
    : {
        name: "App Store",
        health: "Apple Health",
        subscriptionsUrl: "https://apps.apple.com/account/subscriptions",
        termsUrl: "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/",
      };
}
export type PlusStore = ReturnType<typeof plusStore>;

/** The pinned button and the renewal terms under it, for the chosen plan. */
export function plusCheckout(plan: PlusPlan, store: PlusStore) {
  const { yearly, monthly, trialDays } = plusPrices;
  const renewal = `Renews automatically until you cancel in ${store.name} settings, at least 24 hours before the renewal date.`;
  return plan === "yearly"
    ? {
        action: `Start ${trialDays}-day free trial`,
        terms: `Free for ${trialDays} days, then ${dollars(yearly)} a year. ${renewal}`,
      }
    : {
        action: `Subscribe for ${dollars(monthly)} a month`,
        terms: `${dollars(monthly)} a month. ${renewal}`,
      };
}

type RowKey = "trends" | "nutrients" | "plates" | "progress" | "demos" | "health" | "limits";
export type PaywallRow = {
  key: RowKey;
  icon: IconName;
  title: string;
  caption: string;
  /** Where it waits after buying, on the Welcome to Plus step. */
  ready: string;
};

/** What Plus adds, in the paywall's order. */
export function paywallRows(store: PlusStore): PaywallRow[] {
  return [
    {
      key: "trends",
      icon: "chart-simple",
      title: "Long-range trends",
      caption: "12 and 52-week workout graphs and cardio distance totals.",
      ready: "On Profile, from your first workout",
    },
    {
      key: "nutrients",
      icon: "apple-whole",
      title: "Detailed nutrients",
      caption: "Fiber, sugars, fat types, minerals, vitamin D, caffeine and alcohol.",
      ready: "In Daily macros and your custom foods",
    },
    {
      key: "plates",
      icon: "calculator",
      title: "Plate calculator",
      caption: "The plates for each side of every set, for any bar.",
      ready: "Ready on every weighted set",
    },
    {
      key: "progress",
      icon: "person",
      title: "Body and photo progress",
      caption: "Measurement charts, unlimited progress photos and side-by-side comparisons.",
      ready: "On Profile, with every photo you add",
    },
    {
      key: "demos",
      icon: "circle-play",
      title: "Every exercise demo",
      caption: "The full KineVault video library in workouts and search.",
      ready: "In workouts and the demo search",
    },
    {
      key: "health",
      icon: "heart",
      title: `Save to ${store.health}`,
      caption: "Completed workouts, body weight and daily water.",
      ready: "Turn it on in Settings",
    },
    {
      key: "limits",
      icon: "layer-group",
      title: "No limits",
      caption: "Unlimited custom foods, meals and saved workouts.",
      ready: "Create as many as you need",
    },
  ];
}

/** Where the paywall opened: a locked feature, or Settings. */
export type PaywallSource = PlusFeature | "settings";

const sources: Record<
  PlusFeature,
  { row: RowKey; context: (store: PlusStore) => string; back: string }
> = {
  trends: { row: "trends", context: () => "Long-range trends are part of Plus.", back: "Profile" },
  distance: {
    row: "trends",
    context: () => "Cardio distance totals are part of Plus.",
    back: "your workout",
  },
  nutrients: {
    row: "nutrients",
    context: () => "Detailed nutrients are part of Plus.",
    back: "nutrients",
  },
  plates: { row: "plates", context: () => "The Plate calculator is part of Plus.", back: "Plates" },
  measurements: {
    row: "progress",
    context: () => "The measurement chart is part of Plus.",
    back: "Profile",
  },
  comparison: {
    row: "progress",
    context: () => "Photo comparisons are part of Plus.",
    back: "Profile",
  },
  photos: {
    row: "progress",
    context: () => `More than ${freeLimits.photos} progress photos are part of Plus.`,
    back: "photos",
  },
  demos: {
    row: "demos",
    context: () => "Every exercise demo is part of Plus.",
    back: "your workout",
  },
  health: {
    row: "health",
    context: (store) => `Save to ${store.health} is part of Plus.`,
    back: "Settings",
  },
  workouts: {
    row: "limits",
    context: () => `More than ${freeLimits.workouts} saved workouts are part of Plus.`,
    back: "your workouts",
  },
  foods: {
    row: "limits",
    context: () => `More than ${freeLimits.foods} custom foods are part of Plus.`,
    back: "your food",
  },
  meals: {
    row: "limits",
    context: () => `More than ${freeLimits.meals} saved meals are part of Plus.`,
    back: "your meal",
  },
};

/** The strip that names the locked feature, the Welcome step's rows and its way back. */
export function paywallSource(source: PaywallSource, store: PlusStore) {
  const rows = paywallRows(store);
  const opened = source === "settings" ? null : sources[source];
  // The feature it opened from leads, then the first rows, two in all.
  const welcome = [
    ...rows.filter((row) => row.key === opened?.row),
    ...rows.filter((row) => row.key !== opened?.row),
  ].slice(0, 2);
  return {
    context: opened?.context(store) ?? null,
    welcome,
    back: `Back to ${opened?.back ?? "Settings"}`,
  };
}
