import assert from "node:assert/strict";
import test from "node:test";
import { trackingAccess } from "../src/account/tracking-access.ts";

const complete = { kind: "ready", document: { kind: "complete" } } as const;
const draft = { kind: "ready", document: { kind: "draft" } } as const;

test("tracking opens only for a signed-in Account with a complete Profile", () => {
  assert.deepEqual(trackingAccess({ recovery: false, signedIn: true, profile: complete }), {
    kind: "open",
  });
});

test("password recovery comes before every other rule", () => {
  for (const profile of [complete, draft, { kind: "loading" }, { kind: "error" }] as const)
    for (const signedIn of [true, false])
      assert.deepEqual(trackingAccess({ recovery: true, signedIn, profile }), {
        kind: "redirect",
        href: "/auth/reset-password",
      });
});

test("tracking waits while the Profile loads or needs recovery", () => {
  for (const profile of [{ kind: "loading" }, { kind: "error" }] as const)
    for (const signedIn of [true, false])
      assert.deepEqual(trackingAccess({ recovery: false, signedIn, profile }), { kind: "wait" });
});

test("unfinished setup resumes onboarding, and a signed-out setup signs in", () => {
  for (const signedIn of [true, false])
    assert.deepEqual(trackingAccess({ recovery: false, signedIn, profile: draft }), {
      kind: "redirect",
      href: "/onboarding",
    });
  assert.deepEqual(trackingAccess({ recovery: false, signedIn: false, profile: complete }), {
    kind: "redirect",
    href: "/account",
  });
});
