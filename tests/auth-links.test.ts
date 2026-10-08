import assert from "node:assert/strict";
import test from "node:test";
import { parseAuthLink, sanitizedAuthPath } from "../src/account/auth-links.ts";

test("PKCE callbacks work with native, web, and Expo Go paths", () => {
  for (const url of [
    "kinevaulttrack://auth/callback?code=one-use",
    "https://track.example/auth/callback?code=one-use",
    "exp://192.168.1.2:8081/--/auth/callback?code=one-use",
  ])
    assert.deepEqual(parseAuthLink(url), { kind: "code", code: "one-use", recovery: false });
});
test("recovery callbacks preserve their purpose", () => {
  assert.deepEqual(parseAuthLink("kinevaulttrack://auth/callback?code=one-use&flow=recovery"), {
    kind: "code",
    code: "one-use",
    recovery: true,
  });
});
test("email token hashes only allow email confirmation and recovery types", () => {
  assert.deepEqual(parseAuthLink("kinevaulttrack://auth/callback?token_hash=hash&type=recovery"), {
    kind: "token-hash",
    tokenHash: "hash",
    type: "recovery",
    recovery: true,
  });
  assert.deepEqual(
    parseAuthLink("https://track.example/auth/callback?token_hash=hash&type=email"),
    { kind: "token-hash", tokenHash: "hash", type: "email", recovery: false },
  );
  assert.equal(
    parseAuthLink("kinevaulttrack://auth/callback?token_hash=hash&type=invite").kind,
    "invalid",
  );
});
test("implicit callbacks need both tokens and recognize recovery in the hash", () => {
  assert.deepEqual(
    parseAuthLink(
      "kinevaulttrack://auth/callback#access_token=access&refresh_token=refresh&type=recovery",
    ),
    { kind: "tokens", accessToken: "access", refreshToken: "refresh", recovery: true },
  );
  assert.equal(parseAuthLink("kinevaulttrack://auth/callback#access_token=access").kind, "invalid");
});
test("unrelated URLs and ambiguous credentials are rejected", () => {
  for (const url of [
    "not a URL",
    "https://track.example/food?code=secret",
    "javascript://auth/callback?code=secret",
    "kinevaulttrack://auth/callback?code=a&code=b",
    "kinevaulttrack://auth/callback?code=a&token_hash=b&type=email",
  ])
    assert.equal(parseAuthLink(url).kind, "invalid");
});
test("callback errors show safe actionable messages rather than arbitrary URL content", () => {
  assert.deepEqual(
    parseAuthLink(
      "kinevaulttrack://auth/callback?error=access_denied&error_code=otp_expired&error_description=%3Cscript%3E",
    ),
    {
      kind: "error",
      message: "This email link has expired or already been used. Request a new one.",
    },
  );
});
test("sanitized paths remove all callback secrets", () => {
  assert.equal(
    sanitizedAuthPath("https://track.example/auth/callback?code=secret#refresh_token=secret"),
    "/auth/callback",
  );
  assert.equal(sanitizedAuthPath("https://track.example/evil?code=secret"), null);
});
