export type AuthLink =
  | { kind: "code"; code: string; recovery: boolean }
  | { kind: "token-hash"; tokenHash: string; type: "email" | "recovery"; recovery: boolean }
  | { kind: "tokens"; accessToken: string; refreshToken: string; recovery: boolean }
  | { kind: "error"; message: string }
  | { kind: "invalid" };

function callbackPath(url: URL): string | null {
  if (!["https:", "http:", "kinevaulttrack:", "exp:", "exps:"].includes(url.protocol)) return null;
  const native = url.protocol === "kinevaulttrack:";
  const path = native ? `/${url.hostname}${url.pathname}` : url.pathname.replace(/^\/--\//, "/");
  return path === "/auth/callback" || path === "/auth/reset-password" ? path : null;
}

export function sanitizedAuthPath(value: string): string | null {
  try {
    return callbackPath(new URL(value));
  } catch {
    return null;
  }
}

export function parseAuthLink(value: string): AuthLink {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { kind: "invalid" };
  }
  const path = callbackPath(url);
  if (!path) return { kind: "invalid" };
  const params = new URLSearchParams(url.search);
  new URLSearchParams(url.hash.slice(1)).forEach((item, key) => params.append(key, item));
  for (const key of [
    "code",
    "token_hash",
    "type",
    "flow",
    "access_token",
    "refresh_token",
    "error",
    "error_code",
  ])
    if (params.getAll(key).length > 1) return { kind: "invalid" };
  if (params.has("error") || params.has("error_code")) {
    return {
      kind: "error",
      message:
        params.get("error_code") === "otp_expired"
          ? "This email link has expired or already been used. Request a new one."
          : "This email link couldn't be verified. Request a new one and try again.",
    };
  }
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  const type = params.get("type");
  const recovery =
    type === "recovery" || params.get("flow") === "recovery" || path === "/auth/reset-password";
  const formats =
    Number(Boolean(code)) +
    Number(Boolean(tokenHash)) +
    Number(Boolean(accessToken || refreshToken));
  if (formats !== 1) return { kind: "invalid" };
  if (code) return { kind: "code", code, recovery };
  if (tokenHash && (type === "email" || type === "recovery"))
    return { kind: "token-hash", tokenHash, type, recovery };
  if (accessToken && refreshToken) return { kind: "tokens", accessToken, refreshToken, recovery };
  return { kind: "invalid" };
}
