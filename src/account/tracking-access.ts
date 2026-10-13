type ProfileState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; document: { kind: "draft" | "complete" } };

export type TrackingAccess =
  | { kind: "open" }
  /** The Profile is loading, or the root layout is offering Profile recovery. */
  | { kind: "wait" }
  | { kind: "redirect"; href: "/auth/reset-password" | "/onboarding" | "/account" };

/**
 * When the tracking tabs can open. Password recovery comes first, then tracking
 * needs a ready Profile, a signed-in Account and finished setup. Signed out, an
 * unfinished setup resumes onboarding before sign-in.
 */
export function trackingAccess({
  recovery,
  signedIn,
  profile,
}: {
  recovery: boolean;
  signedIn: boolean;
  profile: ProfileState;
}): TrackingAccess {
  if (recovery) return { kind: "redirect", href: "/auth/reset-password" };
  if (profile.kind !== "ready") return { kind: "wait" };
  if (profile.document.kind === "draft") return { kind: "redirect", href: "/onboarding" };
  if (!signedIn) return { kind: "redirect", href: "/account" };
  return { kind: "open" };
}
