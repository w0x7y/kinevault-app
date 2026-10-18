import {
  jsonReply as reply,
  preflightReply,
  readJsonRequest,
  type RejectedRequest,
} from "../_shared/request.ts";

type Identity = { id: string; email: string | null };
export type DeletionPort = {
  authenticate(token: string): Promise<Identity | null>;
  reauthenticate(
    email: string,
    password: string,
  ): Promise<{ id: string; accessToken: string } | null>;
  revokeSessions(token: string): Promise<void>;
  deleteUser(id: string): Promise<void>;
};
const rejections = {
  method: [405, "Method not allowed"],
  unauthenticated: [401, "Authentication required"],
  "too-large": [413, "Request too large"],
  invalid: [400, "Invalid request"],
} as const satisfies Record<RejectedRequest, readonly [number, string]>;
/** How long a Google sign-in confirms deletion. Settings shows the same window. */
const recentSignInSeconds = 10 * 60;

/** True when the `amr` claim of a token Auth already verified records an OAuth sign-in within the window. */
function signedInWithOAuthRecently(token: string): boolean {
  try {
    const part = token.split(".")[1].replaceAll("-", "+").replaceAll("_", "/");
    const { amr } = JSON.parse(atob(part));
    const now = Date.now() / 1000;
    return (
      Array.isArray(amr) &&
      amr.some(
        (entry) =>
          entry?.method === "oauth" &&
          typeof entry.timestamp === "number" &&
          now - entry.timestamp <= recentSignInSeconds,
      )
    );
  } catch {
    return false;
  }
}

export function createDeleteAccountHandler(port: DeletionPort) {
  return async (request: Request): Promise<Response> => {
    const read = await readJsonRequest(request, { byteLimit: 2048 });
    if (read.kind === "preflight") return preflightReply();
    if (read.kind === "rejected") {
      const [status, error] = rejections[read.reason];
      return reply(status, { error });
    }
    const { token, body: value } = read;
    if (
      Object.keys(value).some((key) => !["password", "confirmation"].includes(key)) ||
      value.confirmation !== "DELETE" ||
      (value.password !== undefined &&
        (typeof value.password !== "string" || !value.password || value.password.length > 128))
    )
      return reply(400, { error: "DELETE confirmation required" });
    try {
      const owner = await port.authenticate(token);
      if (!owner) return reply(401, { error: "Authentication required" });
      if (value.password === undefined) {
        // Accounts created with Google have no password. This session's own
        // sign-in must be a fresh one, so an older stolen session can't delete.
        if (!signedInWithOAuthRecently(token))
          return reply(403, { error: "Recent Google sign-in required" });
        await port.revokeSessions(token);
      } else {
        if (!owner.email) return reply(401, { error: "Authentication required" });
        // Email comes from Auth, never from client input or editable metadata.
        const verified = await port.reauthenticate(owner.email, value.password);
        if (!verified || verified.id !== owner.id)
          return reply(403, { error: "Password verification failed" });
        await port.revokeSessions(verified.accessToken);
      }
      await port.deleteUser(owner.id);
      return reply(200, { deleted: true });
    } catch {
      return reply(503, { error: "Account deletion could not be confirmed. Retry." });
    }
  };
}
