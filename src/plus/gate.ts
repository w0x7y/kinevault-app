import type { Membership } from "../account/membership.ts";
import type { WorkoutRange } from "../profile/activity.ts";

/**
 * The one switch for KineVault Plus. Off, every feature stays unlocked and no Plus entry point
 * shows, so the app behaves as it did before Plus. Turn it on once store billing ships.
 */
export const plusGatesEnabled = false;

const plans: readonly string[] = ["free", "plus", "pro"];
const statuses: readonly string[] = ["active", "trialing", "past_due", "canceled", "inactive"];

/** A plan and status the server can return. */
export function isMembership(value: { plan: unknown; status: unknown }): value is Membership {
  return (
    typeof value.plan === "string" &&
    plans.includes(value.plan) &&
    typeof value.status === "string" &&
    statuses.includes(value.status)
  );
}

/** Plus or Pro that the store still bills: active, in a free trial or retrying a payment. */
export function hasPlus(membership: Membership | null): boolean {
  return (
    membership !== null &&
    (membership.plan === "plus" || membership.plan === "pro") &&
    (membership.status === "active" ||
      membership.status === "trialing" ||
      membership.status === "past_due")
  );
}

export type PlusAccess = {
  /** Every Plus feature works. Always true while the gates are off. */
  unlocked: boolean;
  /** Plus entry points show: the Settings Membership group and the paywall. */
  offered: boolean;
};

export function plusAccess(membership: Membership | null, enabled = plusGatesEnabled): PlusAccess {
  return enabled
    ? { unlocked: hasPlus(membership), offered: true }
    : { unlocked: true, offered: false };
}

/**
 * The last membership read on this device. Account storage keeps it for the signed-in account
 * and never uploads it; it isn't an Account tracking document.
 */
export const membershipCacheKey = "kinevault-track.membership.v1";
/** How long the cache stands in for a read that failed or couldn't run offline. */
export const membershipCacheDays = 7;
const dayMs = 24 * 60 * 60 * 1000;

function membershipCacheEntry(membership: Membership, now: number): string {
  return JSON.stringify({
    version: 1,
    plan: membership.plan,
    status: membership.status,
    readAt: now,
  });
}

/** A cache entry's membership and its age, or null for a damaged or future-dated entry. */
function readCacheEntry(raw: string | null, now: number) {
  if (raw === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const entry = value as { version?: unknown; plan: unknown; status: unknown; readAt?: unknown };
  const { readAt } = entry;
  if (entry.version !== 1 || typeof readAt !== "number" || !isMembership(entry)) return null;
  // A read dated in the future came from a clock that moved; it proves nothing.
  const age = now - readAt;
  return age >= 0 ? { membership: { plan: entry.plan, status: entry.status }, age } : null;
}

/** The cached membership while it's at most 7 days old. Anything else counts as none: Free. */
export function cachedMembership(raw: string | null, now: number): Membership | null {
  const entry = readCacheEntry(raw, now);
  return entry && entry.age <= membershipCacheDays * dayMs ? entry.membership : null;
}

/**
 * The entry to save after a successful read, or null to leave the cache as it is. Nothing is
 * cached while the gates are off. An unchanged membership is saved again at most once a day,
 * so the 7 days count from a read no more than a day before the latest.
 */
export function membershipCacheWrite(
  raw: string | null,
  membership: Membership,
  now: number,
  enabled = plusGatesEnabled,
): string | null {
  if (!enabled) return null;
  const entry = readCacheEntry(raw, now);
  const unchanged =
    entry !== null &&
    entry.membership.plan === membership.plan &&
    entry.membership.status === membership.status &&
    entry.age < dayMs;
  return unchanged ? null : membershipCacheEntry(membership, now);
}

/** What Free can create. Items already past a limit, say after Plus ends, stay usable. */
export const freeLimits = { workouts: 5, foods: 10, meals: 10, photos: 3 } as const;
export type PlusLimit = keyof typeof freeLimits;
const limitNouns: Record<PlusLimit, string> = {
  workouts: "saved workouts",
  foods: "custom foods",
  meals: "saved meals",
  photos: "progress photos",
};

/** Creating one more item would pass Free's limit. */
export function limitReached(limit: PlusLimit, count: number, unlocked: boolean): boolean {
  return !unlocked && count >= freeLimits[limit];
}

/** The notice a list shows from one item before Free's limit, so the limit never comes as an error. */
export function limitNotice(
  limit: PlusLimit,
  count: number,
  unlocked: boolean,
): { lead: string; detail: string; full: boolean } | null {
  const max = freeLimits[limit];
  if (unlocked || count < max - 1) return null;
  const full = count >= max;
  return {
    lead: `${count > max ? count : `${count} of ${max}`} ${limitNouns[limit]}.`,
    detail: full
      ? `Free keeps ${max}. Edit or delete one to make room, or get Plus for unlimited.`
      : `Free keeps ${max}. Plus has no limit.`,
    full,
  };
}

/** Free's Workout graph range. 12 and 52 weeks are Plus. */
export const freeWorkoutWeeks = 4;

export function workoutWeeksLocked(weeks: WorkoutRange, unlocked: boolean): boolean {
  return !unlocked && weeks > freeWorkoutWeeks;
}

/** The range the Workout graph opens on: 12 weeks, or Free's 4. */
export function defaultWorkoutWeeks(unlocked: boolean): WorkoutRange {
  return unlocked ? 12 : freeWorkoutWeeks;
}

/**
 * The KineVault demos Free plays: the first three published, on 2026-10-14. Catalog IDs don't
 * change when a demo is rendered again.
 */
export const starterDemoIds: readonly string[] = [
  "245cd431-cd75-43b5-8829-5ced8354e9a1", // dumbbell-curl
  "c8b1efb7-281c-4054-b25e-38f6a0a4d76d", // dumbbell-lateral-raise
  "225741c8-d463-4a1b-9ac2-8cefcfcd4501", // dumbbell-shoulder-press
];

export function demoLocked(catalogId: string, unlocked: boolean): boolean {
  return !unlocked && !starterDemoIds.includes(catalogId);
}

/** Where a person meets Plus; the paywall names the feature it opened from. */
export type PlusFeature =
  | "trends"
  | "distance"
  | "nutrients"
  | "plates"
  | "measurements"
  | "comparison"
  | "demos"
  | "health"
  | PlusLimit;
