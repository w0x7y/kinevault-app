// Signing in and following an email link must work even when the local Profile
// or the account's first cloud download needs recovery. Tracking routes still
// require both the authenticated account and a ready Profile.
export function isPublicAccountRoute(segments: readonly string[]): boolean {
  return segments[0] === "account" || segments[0] === "auth";
}
