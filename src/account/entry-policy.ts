/**
 * The entry policy: what a route shows for the current Account, account storage and
 * Profile readings. The app evaluates it in layers, outermost first, because each
 * layer's readings exist only once the layer above renders: the Account session,
 * then account storage, then the navigator (theme, fonts and Profile), then the
 * route itself. `entryDecision` composes the layers into the one rule.
 *
 * Sign-in and email-link routes stay usable while the Profile or the account's
 * first download needs recovery. Password recovery comes first on every guarded
 * route; tracking needs a ready Profile, a signed-in Account and finished setup.
 */

export type EntryRoute = "auth" | "account" | "onboarding" | "tracking" | "other";

export type ProfileReading =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; document: { kind: "draft" | "complete" } };

export type EntryReadings = {
  /** The Account session is still being restored. */
  accountLoading: boolean;
  signedIn: boolean;
  /** A password-recovery session is open. */
  recovery: boolean;
  storage: "loading" | "ready" | "error";
  /** Theme and fonts are ready. */
  appReady: boolean;
  profile: ProfileReading;
  /** The onboarding route's `setupStage` param. */
  setupStage?: string;
};

export type EntryHref = "/auth/reset-password" | "/onboarding" | "/account" | "/(tabs)";

export type EntryDecision =
  | { kind: "render" }
  /** Kine's full-screen loading state. */
  | { kind: "loading" }
  /** Nothing yet: a layer above shows the Profile's state. */
  | { kind: "wait" }
  | { kind: "redirect"; href: EntryHref }
  | { kind: "profileRecovery" }
  | { kind: "storageFailure" };

/** A layer's decision, or null when the next layer decides. */
type Gate = EntryDecision | null;

const loading = { kind: "loading" } as const;
const resetPassword = { kind: "redirect", href: "/auth/reset-password" } as const;

export function entryRoute(segments: readonly string[]): EntryRoute {
  switch (segments[0]) {
    case "auth":
    case "account":
    case "onboarding":
      return segments[0];
    case "(tabs)":
      return "tracking";
    default:
      return "other";
  }
}

/** Sign-in and email-link routes, which work whatever the Profile or storage state. */
export function isPublicAccountRoute(route: EntryRoute): boolean {
  return route === "auth" || route === "account";
}

/** AccountDataProvider: wait for the restored session before choosing its storage. */
export function sessionGate({ accountLoading }: Pick<EntryReadings, "accountLoading">): Gate {
  return accountLoading ? loading : null;
}

/** The account scope: its saved data must load before guarded routes mount. A signed-in
 * sign-in screen waits too: before the download it would read the new account's empty
 * Profile and send the user into setup ahead of their imported answers. */
export function storageGate(
  route: EntryRoute,
  { storage, signedIn }: Pick<EntryReadings, "storage" | "signedIn">,
): Gate {
  if (route === "auth" || (route === "account" && !signedIn) || storage === "ready") return null;
  return storage === "error" ? { kind: "storageFailure" } : loading;
}

/** The root navigator: theme and fonts, then a loading or damaged Profile. */
export function navigatorGate(
  route: EntryRoute,
  { appReady, profile }: Pick<EntryReadings, "appReady" | "profile">,
): Gate {
  if (!appReady) return loading;
  if (isPublicAccountRoute(route)) return null;
  if (profile.kind === "loading") return loading;
  if (profile.kind === "error") return { kind: "profileRecovery" };
  return null;
}

/** What the route itself shows once the layers above it render. */
export function routeDecision(
  route: EntryRoute,
  {
    recovery,
    signedIn,
    profile,
    setupStage,
  }: Pick<EntryReadings, "recovery" | "signedIn" | "profile" | "setupStage">,
): EntryDecision {
  if (route === "auth" || route === "other") return { kind: "render" };
  if (recovery) return resetPassword;
  if (route === "account") {
    // Signed out, the sign-in screen shows whatever the Profile state.
    if (!signedIn) return { kind: "render" };
    if (profile.kind === "loading") return loading;
    if (profile.kind === "error") return { kind: "profileRecovery" };
    return {
      kind: "redirect",
      href: profile.document.kind === "complete" ? "/(tabs)" : "/onboarding",
    };
  }
  if (profile.kind !== "ready") return { kind: "wait" };
  if (route === "onboarding")
    return signedIn && profile.document.kind === "complete" && setupStage === "account"
      ? { kind: "redirect", href: "/(tabs)" }
      : { kind: "render" };
  // Signed out, an unfinished setup resumes onboarding before sign-in.
  if (profile.document.kind === "draft") return { kind: "redirect", href: "/onboarding" };
  if (!signedIn) return { kind: "redirect", href: "/account" };
  return { kind: "render" };
}

/** The whole rule: the first layer that decides. */
export function entryDecision(route: EntryRoute, readings: EntryReadings): EntryDecision {
  return (
    sessionGate(readings) ??
    storageGate(route, readings) ??
    navigatorGate(route, readings) ??
    routeDecision(route, readings)
  );
}

/**
 * Reminder taps, evaluated by the root navigator on the current route: hold the tap
 * while startup finishes, then open tracking only where the tab layout would render.
 */
export function reminderTapAccess(
  route: EntryRoute,
  readings: Pick<EntryReadings, "appReady" | "recovery" | "signedIn" | "profile">,
): "wait" | "open" | "ignore" {
  if (!readings.appReady || readings.profile.kind === "loading") return "wait";
  if (isPublicAccountRoute(route)) return "ignore";
  return routeDecision("tracking", readings).kind === "render" ? "open" : "ignore";
}

/** Where a saved Onboarding flow goes. Signed out, setup continues to the Account step. */
export function onboardingExit(
  destination: "today" | "settings",
  signedIn: boolean,
): { kind: "accountStep" } | { kind: "redirect"; href: "/(tabs)" | "/(tabs)/settings" } {
  if (destination === "today" && !signedIn) return { kind: "accountStep" };
  return { kind: "redirect", href: destination === "settings" ? "/(tabs)/settings" : "/(tabs)" };
}
