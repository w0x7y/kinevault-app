import assert from "node:assert/strict";
import test from "node:test";
import type { Session } from "@supabase/supabase-js";
import { createAccountController, type AccountAuthPort } from "../src/account/controller.ts";
import { createSecureSessionStorage } from "../src/account/secure-storage.ts";

const session: Session = {
  user: {
    id: "owner",
    email: "alex@example.com",
    aud: "authenticated",
    app_metadata: {},
    user_metadata: {},
    created_at: "2026-10-05T00:00:00Z",
  },
  access_token: "access",
  refresh_token: "refresh",
  expires_in: 3600,
  expires_at: 1800000000,
  token_type: "bearer",
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function harness() {
  let callback: Parameters<AccountAuthPort["onAuthStateChange"]>[0] | undefined;
  let subscriptionActive = false;
  let initial = Promise.resolve({
    data: { session: null as Session | null },
    error: null as { message: string } | null,
  });
  let result = {
    data: { session: session as Session | null },
    error: null as { message: string; code?: string } | null,
  };
  let submitted = 0;
  const auth: AccountAuthPort = {
    getSession: () => initial,
    onAuthStateChange(listener) {
      callback = listener;
      subscriptionActive = true;
      return {
        data: {
          subscription: {
            unsubscribe() {
              subscriptionActive = false;
            },
          },
        },
      };
    },
    async signInWithPassword() {
      submitted++;
      return result;
    },
    async signUp() {
      submitted++;
      return result;
    },
    async resetPasswordForEmail() {
      submitted++;
      return result;
    },
    async updateUser() {
      submitted++;
      return result;
    },
    async clearDeletedSession() {
      submitted++;
      return { cleared: true, error: null };
    },
    async signOut() {
      submitted++;
      return result;
    },
    async exchangeCodeForSession() {
      submitted++;
      return result;
    },
    async verifyOtp() {
      submitted++;
      return result;
    },
    async setSession() {
      submitted++;
      return result;
    },
  };
  const controller = createAccountController(auth, {
    redirectTo: "kinevaulttrack://auth/callback",
  });
  return {
    auth,
    controller,
    get submitted() {
      return submitted;
    },
    get subscriptionActive() {
      return subscriptionActive;
    },
    emit(event: string, value: Session | null) {
      if (subscriptionActive) callback?.(event, value);
    },
    setInitial(value: typeof initial) {
      initial = value;
    },
    setResult(value: typeof result) {
      result = value;
    },
  };
}
async function ready(h: ReturnType<typeof harness>) {
  h.controller.start();
  await Promise.resolve();
  await Promise.resolve();
}

test("account boot restores a session and stops its listener", async () => {
  const h = harness();
  h.setInitial(Promise.resolve({ data: { session }, error: null }));
  await ready(h);
  assert.equal(h.controller.getSnapshot().user?.id, "owner");
  assert.equal(h.controller.getSnapshot().loading, false);
  h.controller.stop();
  assert.equal(h.subscriptionActive, false);
});

test("delayed account deletion never signs out a replacement identity", async () => {
  const h = harness();
  await ready(h);
  h.emit("SIGNED_IN", session);
  const deletion = deferred<string | null>();
  let ownsAccount = false;
  const pending = h.controller.deleteAccount("owner", async (isCurrent) => {
    ownsAccount = isCurrent();
    return deletion.promise;
  });
  assert.equal(ownsAccount, true);
  h.emit("SIGNED_IN", { ...session, user: { ...session.user, id: "replacement" } });
  deletion.resolve(null);
  assert.equal(await pending, false);
  assert.equal(h.submitted, 0);
  assert.equal(h.controller.getSnapshot().user?.id, "replacement");
});

test("confirmed deletion clears the current login and preserves a local cleanup notice", async () => {
  const h = harness();
  await ready(h);
  h.emit("SIGNED_IN", session);
  assert.equal(
    await h.controller.deleteAccount("owner", async () => "Local cleanup needs retry."),
    true,
  );
  assert.equal(h.submitted, 1);
  assert.equal(h.controller.getSnapshot().user, null);
  assert.equal(h.controller.getSnapshot().notice, "Local cleanup needs retry.");
});

test("failed account deletion retains the identity and allows another account action", async () => {
  const h = harness();
  await ready(h);
  h.emit("SIGNED_IN", session);
  assert.equal(
    await h.controller.deleteAccount("owner", async () => {
      throw new Error("Password rejected");
    }),
    false,
  );
  assert.equal(h.controller.getSnapshot().user?.id, "owner");
  assert.equal(h.controller.getSnapshot().busy, false);
  assert.equal(h.submitted, 0);
  assert.equal(await h.controller.signOut(), true);
});

test("a thrown local logout after confirmed server deletion reports success and remaining device cleanup", async () => {
  const h = harness();
  await ready(h);
  h.emit("SIGNED_IN", session);
  h.auth.clearDeletedSession = async () => {
    throw new Error("Locked auth storage");
  };
  assert.equal(await h.controller.deleteAccount("owner", async () => null), true);
  assert.equal(h.controller.getSnapshot().user, null);
  assert.match(h.controller.getSnapshot().notice!, /has been deleted/);
  assert.match(h.controller.getSnapshot().error!, /couldn't clear its login/);
});
test("auth events win over a late bootstrap read", async () => {
  const h = harness();
  const boot = deferred<{ data: { session: Session | null }; error: null }>();
  h.setInitial(boot.promise);
  h.controller.start();
  h.emit("SIGNED_IN", session);
  boot.resolve({ data: { session: null }, error: null });
  await Promise.resolve();
  assert.equal(h.controller.getSnapshot().user?.id, "owner");
});
test("signup without a session requests email confirmation", async () => {
  const h = harness();
  h.setResult({ data: { session: null }, error: null });
  await ready(h);
  assert.equal(await h.controller.signUp("alex@example.com", "safe-password"), false);
  assert.equal(h.controller.getSnapshot().session, null);
  assert.match(h.controller.getSnapshot().notice ?? "", /Check your email/);
  assert.deepEqual(h.controller.getSnapshot().emailDelivery, {
    kind: "confirmation",
    email: "alex@example.com",
  });
});

test("email delivery owns its normalized recipient and clears with feedback", async () => {
  const h = harness();
  h.setResult({ data: { session: null }, error: null });
  await ready(h);
  await h.controller.signUp("  alex@example.com  ", "safe-password");
  assert.deepEqual(h.controller.getSnapshot().emailDelivery, {
    kind: "confirmation",
    email: "alex@example.com",
  });
  h.controller.clearFeedback();
  assert.equal(h.controller.getSnapshot().emailDelivery, null);
  await h.controller.requestPasswordReset("  other@example.com  ");
  assert.deepEqual(h.controller.getSnapshot().emailDelivery, {
    kind: "password-reset",
    email: "other@example.com",
  });
  h.emit("SIGNED_IN", session);
  assert.equal(h.controller.getSnapshot().emailDelivery, null);
  assert.equal(h.controller.getSnapshot().notice, null);
});

test("recovery belongs to the current identity and does not follow an account switch", async () => {
  const h = harness();
  await ready(h);
  h.emit("PASSWORD_RECOVERY", session);
  h.emit("SIGNED_IN", { ...session, user: { ...session.user, id: "other-owner" } });
  assert.equal(h.controller.getSnapshot().recovery, false);
});

test("late password updates cannot end a replacement identity's recovery", async () => {
  const h = harness();
  await ready(h);
  h.emit("PASSWORD_RECOVERY", session);
  const pending = deferred<{ error: null }>();
  h.auth.updateUser = () => pending.promise;
  const update = h.controller.updatePassword("new-safe-password");
  h.emit("PASSWORD_RECOVERY", { ...session, user: { ...session.user, id: "other-owner" } });
  pending.resolve({ error: null });
  assert.equal(await update, false);
  assert.equal(h.controller.getSnapshot().recovery, true);
  assert.equal(h.controller.getSnapshot().notice, null);
});

test("late reset deliveries and errors do not appear on another account", async () => {
  const h = harness();
  await ready(h);
  const pending = deferred<{ error: { message: string } }>();
  h.auth.resetPasswordForEmail = () => pending.promise;
  const reset = h.controller.requestPasswordReset("alex@example.com");
  h.emit("SIGNED_IN", session);
  pending.resolve({ error: { message: "network" } });
  assert.equal(await reset, false);
  assert.equal(h.controller.getSnapshot().error, null);
  assert.equal(h.controller.getSnapshot().emailDelivery, null);
});

test("late signup and login feedback is discarded after identity replacement", async () => {
  for (const method of ["signUp", "signIn"] as const) {
    for (const outcome of ["confirmation", "error", "throw"] as const) {
      const h = harness();
      await ready(h);
      const pending = deferred<{
        data: { session: Session | null };
        error: { message: string } | null;
      }>();
      h.auth[method === "signUp" ? "signUp" : "signInWithPassword"] = async () => {
        await pending.promise;
        if (outcome === "throw") throw new Error("offline");
        return {
          data: { session: null },
          error: outcome === "error" ? { message: "offline" } : null,
        };
      };
      const attempt = h.controller[method]("alex@example.com", "safe-password");
      h.emit("SIGNED_IN", session);
      pending.resolve({ data: { session: null }, error: null });
      assert.equal(await attempt, false);
      assert.equal(h.controller.getSnapshot().error, null);
      assert.equal(h.controller.getSnapshot().notice, null);
      assert.equal(h.controller.getSnapshot().emailDelivery, null);
      assert.equal(h.controller.getSnapshot().busy, false);
    }
  }
});

test("logging out and recovering the same identity still invalidates an older password update", async () => {
  const h = harness();
  await ready(h);
  h.emit("PASSWORD_RECOVERY", session);
  const pending = deferred<{ error: null }>();
  h.auth.updateUser = () => pending.promise;
  const update = h.controller.updatePassword("new-safe-password");
  h.emit("SIGNED_OUT", null);
  h.emit("PASSWORD_RECOVERY", session);
  pending.resolve({ error: null });
  assert.equal(await update, false);
  assert.equal(h.controller.getSnapshot().recovery, true);
  assert.equal(h.controller.getSnapshot().busy, false);
});
test("successful login publishes the session", async () => {
  const h = harness();
  await ready(h);
  assert.equal(await h.controller.signIn("alex@example.com", "legacy"), true);
  assert.equal(h.controller.getSnapshot().user?.id, "owner");
});
test("signup and reset validate 10 characters while login allows legacy passwords", async () => {
  const h = harness();
  await ready(h);
  assert.equal(await h.controller.signUp("alex@example.com", "short"), false);
  assert.match(h.controller.getSnapshot().error ?? "", /10 characters/);
  assert.equal(await h.controller.updatePassword("short"), false);
  assert.equal(h.submitted, 0);
  assert.equal(await h.controller.signIn("alex@example.com", "legacy"), true);
});
test("invalid email stays in the UI and never reaches the backend", async () => {
  const h = harness();
  await ready(h);
  assert.equal(await h.controller.signIn("not-email", "password"), false);
  assert.equal(h.submitted, 0);
  assert.match(h.controller.getSnapshot().error ?? "", /email/);
});
test("password reset notice does not expose whether an account exists", async () => {
  const h = harness();
  await ready(h);
  assert.equal(await h.controller.requestPasswordReset("unknown@example.com"), true);
  assert.match(h.controller.getSnapshot().notice ?? "", /If an account exists/);
});
test("duplicate submits share one operation and leaving prevents late session publication", async () => {
  const h = harness();
  const pending = deferred<{ data: { session: Session | null }; error: null }>();
  h.auth.signInWithPassword = () => pending.promise;
  await ready(h);
  const first = h.controller.signIn("alex@example.com", "password");
  assert.equal(h.controller.getSnapshot().busy, true);
  assert.equal(await h.controller.signIn("alex@example.com", "password"), false);
  h.controller.stop();
  pending.resolve({ data: { session }, error: null });
  assert.equal(await first, false);
  assert.equal(h.controller.getSnapshot().session, null);
});

test("stopping from busy feedback prevents the auth adapter request", async () => {
  const h = harness();
  await ready(h);
  h.controller.subscribe(() => {
    if (h.controller.getSnapshot().busy) h.controller.stop();
  });
  assert.equal(await h.controller.signIn("alex@example.com", "safe-password"), false);
  assert.equal(h.submitted, 0);
});

test("stopping from boot feedback prevents subscriptions and session reads", () => {
  const h = harness();
  let reads = 0;
  h.auth.getSession = async () => {
    reads++;
    return { data: { session: null }, error: null };
  };
  h.controller.subscribe(() => h.controller.stop());
  h.controller.start();
  assert.equal(reads, 0);
  assert.equal(h.subscriptionActive, false);
});

test("stopping inside synchronous auth subscription feedback retires that subscription", () => {
  const h = harness();
  let reads = 0,
    retired = 0;
  h.auth.getSession = async () => {
    reads++;
    return { data: { session: null }, error: null };
  };
  h.auth.onAuthStateChange = (listener) => {
    listener("INITIAL_SESSION", session);
    return {
      data: {
        subscription: {
          unsubscribe() {
            retired++;
          },
        },
      },
    };
  };
  h.controller.subscribe(() => {
    if (h.controller.getSnapshot().user) h.controller.stop();
  });
  h.controller.start();
  assert.equal(reads, 0);
  assert.equal(retired, 1);
});

test("a newer same-owner recovery survives an older successful login", async () => {
  const h = harness();
  await ready(h);
  h.emit("SIGNED_IN", session);
  const pending = deferred<{ data: { session: Session | null }; error: null }>();
  h.auth.signInWithPassword = () => pending.promise;
  const login = h.controller.signIn("alex@example.com", "safe-password");
  h.emit("PASSWORD_RECOVERY", session);
  pending.resolve({ data: { session }, error: null });
  await login;
  assert.equal(h.controller.getSnapshot().recovery, true);
  assert.equal(h.controller.getSnapshot().busy, false);
});

test("a newer same-owner recovery survives an older password update result or error", async () => {
  for (const outcome of ["success", "error", "throw"] as const) {
    const h = harness();
    await ready(h);
    h.emit("PASSWORD_RECOVERY", session);
    const pending = deferred<void>();
    h.auth.updateUser = async () => {
      await pending.promise;
      if (outcome === "throw") throw new Error("offline");
      return { error: outcome === "error" ? { message: "offline" } : null };
    };
    const update = h.controller.updatePassword("new-safe-password");
    h.emit("PASSWORD_RECOVERY", session);
    pending.resolve();
    assert.equal(await update, false);
    assert.equal(h.controller.getSnapshot().recovery, true);
    assert.equal(h.controller.getSnapshot().notice, null);
    assert.equal(h.controller.getSnapshot().error, null);
    assert.equal(h.controller.getSnapshot().busy, false);
  }
});
test("recovery callbacks are deduplicated and keep reset mode until password update", async () => {
  const h = harness();
  await ready(h);
  const url = "kinevaulttrack://auth/callback?code=one-use&flow=recovery";
  assert.deepEqual(
    await Promise.all([h.controller.completeAuthLink(url), h.controller.completeAuthLink(url)]),
    [true, true],
  );
  assert.equal(h.submitted, 1);
  assert.equal(h.controller.getSnapshot().recovery, true);
  assert.equal(await h.controller.updatePassword("new-safe-password"), true);
  assert.equal(h.controller.getSnapshot().recovery, false);
});
test("untrusted or expired auth links do not exchange credentials", async () => {
  const h = harness();
  await ready(h);
  assert.equal(
    await h.controller.completeAuthLink("https://track.example/food?code=secret"),
    false,
  );
  assert.equal(
    await h.controller.completeAuthLink(
      "kinevaulttrack://auth/callback?error_code=otp_expired&error=access_denied",
    ),
    false,
  );
  assert.equal(h.submitted, 0);
  assert.match(h.controller.getSnapshot().error ?? "", /expired/);
});
test("signout clears identity and recovery", async () => {
  const h = harness();
  await ready(h);
  h.emit("PASSWORD_RECOVERY", session);
  assert.equal(h.controller.getSnapshot().recovery, true);
  assert.equal(await h.controller.signOut(), true);
  assert.equal(h.controller.getSnapshot().session, null);
  assert.equal(h.controller.getSnapshot().recovery, false);
});
test("backend errors and thrown requests leave retryable feedback", async () => {
  const h = harness();
  await ready(h);
  h.setResult({
    data: { session: null },
    error: { message: "Invalid login credentials", code: "invalid_credentials" },
  });
  assert.equal(await h.controller.signIn("alex@example.com", "password"), false);
  assert.match(h.controller.getSnapshot().error ?? "", /email or password/);
  h.auth.signInWithPassword = async () => {
    throw new Error("network down");
  };
  assert.equal(await h.controller.signIn("alex@example.com", "password"), false);
  assert.equal(h.controller.getSnapshot().busy, false);
  assert.match(h.controller.getSnapshot().error ?? "", /connection/);
  h.controller.clearFeedback();
  assert.equal(h.controller.getSnapshot().error, null);
});
test("missing configuration allows guest boot and explains blocked auth", async () => {
  const controller = createAccountController(null, {
    redirectTo: "kinevaulttrack://auth/callback",
  });
  controller.start();
  assert.equal(controller.getSnapshot().loading, false);
  assert.equal(controller.getSnapshot().configured, false);
  assert.equal(await controller.signIn("alex@example.com", "password"), false);
  assert.match(controller.getSnapshot().error ?? "", /configured/);
});

test("signup supplies the app confirmation redirect and publishes immediate sessions", async () => {
  const h = harness();
  await ready(h);
  h.auth.signUp = async (credentials) => {
    assert.deepEqual(credentials, {
      email: "alex@example.com",
      password: "safe-password",
      options: { emailRedirectTo: "kinevaulttrack://auth/callback" },
    });
    return { data: { session }, error: null };
  };
  assert.equal(await h.controller.signUp(" alex@example.com ", "safe-password"), true);
  assert.equal(h.controller.getSnapshot().user?.id, "owner");
});
test("reset requests preserve the recovery marker in the redirect", async () => {
  const h = harness();
  await ready(h);
  h.auth.resetPasswordForEmail = async (address, options) => {
    assert.equal(address, "alex@example.com");
    assert.equal(options.redirectTo, "kinevaulttrack://auth/callback?flow=recovery");
    return { error: null };
  };
  assert.equal(await h.controller.requestPasswordReset(" alex@example.com "), true);
});
test("token hashes and legacy implicit links send the correct credentials to auth", async () => {
  const h = harness();
  await ready(h);
  h.auth.verifyOtp = async (credentials) => {
    assert.deepEqual(credentials, { token_hash: "email-hash", type: "email" });
    return { data: { session }, error: null };
  };
  h.auth.setSession = async (credentials) => {
    assert.deepEqual(credentials, {
      access_token: "legacy-access",
      refresh_token: "legacy-refresh",
    });
    return { data: { session }, error: null };
  };
  assert.equal(
    await h.controller.completeAuthLink(
      "kinevaulttrack://auth/callback?token_hash=email-hash&type=email",
    ),
    true,
  );
  assert.equal(
    await h.controller.completeAuthLink(
      "kinevaulttrack://auth/callback#access_token=legacy-access&refresh_token=legacy-refresh",
    ),
    true,
  );
});
test("password update requires the recovery session", async () => {
  const h = harness();
  await ready(h);
  assert.equal(await h.controller.updatePassword("new-safe-password"), false);
  h.emit("SIGNED_IN", session);
  assert.equal(await h.controller.updatePassword("new-safe-password"), false);
  assert.equal(h.submitted, 0);
});
test("refresh events preserve pending password recovery", async () => {
  const h = harness();
  await ready(h);
  h.emit("PASSWORD_RECOVERY", session);
  h.emit("TOKEN_REFRESHED", session);
  assert.equal(h.controller.getSnapshot().recovery, true);
  h.emit("SIGNED_OUT", null);
  assert.equal(h.controller.getSnapshot().recovery, false);
});
test("auth changes during login prevent stale results from restoring another identity", async () => {
  const h = harness();
  const pending = deferred<{ data: { session: Session | null }; error: null }>();
  h.auth.signInWithPassword = () => pending.promise;
  await ready(h);
  const attempt = h.controller.signIn("alex@example.com", "password");
  h.emit("SIGNED_OUT", null);
  pending.resolve({ data: { session }, error: null });
  assert.equal(await attempt, false);
  assert.equal(h.controller.getSnapshot().session, null);
});
test("failed logout retains identity and requests local session logout", async () => {
  const h = harness();
  await ready(h);
  h.emit("SIGNED_IN", session);
  h.auth.signOut = async (options) => {
    assert.deepEqual(options, { scope: "local" });
    return { error: { message: "offline" } };
  };
  assert.equal(await h.controller.signOut(), false);
  assert.equal(h.controller.getSnapshot().user?.id, "owner");
});
test("boot failure allows a new login without freezing loading", async () => {
  const h = harness();
  h.setInitial(
    Promise.resolve({ data: { session: null }, error: { message: "Unreadable session" } }),
  );
  await ready(h);
  assert.equal(h.controller.getSnapshot().loading, false);
  assert.match(h.controller.getSnapshot().error ?? "", /restore/);
  assert.equal(await h.controller.signIn("alex@example.com", "password"), true);
});

test("sanitized callback remount resumes the same in-flight recovery verification", async () => {
  const h = harness();
  await ready(h);
  const pending = deferred<{ data: { session: Session | null }; error: null }>();
  let exchanges = 0;
  h.auth.exchangeCodeForSession = () => {
    exchanges++;
    return pending.promise;
  };
  const verification = h.controller.completeAuthLink(
    "https://track.example/auth/callback?code=one-use&flow=recovery",
  );
  h.emit("SIGNED_IN", session);
  // The old callback unmounts after its URL is cleaned; the new instance sees this URL.
  const resumed = h.controller.resumeAuthLink("https://track.example/auth/callback");
  assert.ok(resumed);
  pending.resolve({ data: { session }, error: null });
  assert.equal(await verification, true);
  assert.equal(await resumed, true);
  assert.equal(exchanges, 1);
  assert.equal(h.controller.getSnapshot().recovery, true);
  h.controller.acknowledgeAuthLink();
  assert.equal(h.controller.resumeAuthLink("https://track.example/auth/callback"), null);
});

test("email verification retains its in-flight outcome when replacing an existing identity", async () => {
  const h = harness();
  await ready(h);
  h.emit("SIGNED_IN", session);
  const replacement = { ...session, user: { ...session.user, id: "other-owner" } };
  const pending = deferred<{ data: { session: Session | null }; error: null }>();
  h.auth.exchangeCodeForSession = () => pending.promise;
  const verification = h.controller.completeAuthLink(
    "https://track.example/auth/callback?code=other-account&flow=recovery",
  );
  h.emit("SIGNED_IN", replacement);
  const resumed = h.controller.resumeAuthLink("https://track.example/auth/callback");
  assert.ok(resumed, "the account-owned screen remount must retain this link's outcome");
  pending.resolve({ data: { session: replacement }, error: null });
  assert.equal(await verification, true);
  assert.equal(await resumed, true);
  assert.equal(h.controller.getSnapshot().recovery, true);
});
test("a signed-in session alone cannot resume an unrelated or fresh callback", async () => {
  const h = harness();
  await ready(h);
  h.emit("SIGNED_IN", session);
  assert.equal(h.controller.resumeAuthLink("https://track.example/auth/callback"), null);
  await h.controller.completeAuthLink("https://track.example/auth/callback?code=verified");
  assert.equal(h.controller.resumeAuthLink("https://other.example/auth/callback"), null);
  assert.equal(
    h.controller.resumeAuthLink("https://track.example/auth/callback?code=new-code"),
    null,
  );
  assert.equal(
    h.controller.resumeAuthLink("https://track.example/auth/callback?error=expired"),
    null,
  );
  assert.equal(h.controller.resumeAuthLink("https://track.example/auth/reset-password"), null);
  await h.controller.signOut();
  assert.equal(h.controller.resumeAuthLink("https://track.example/auth/callback"), null);
});

test("sanitized remount preserves an explicit expired-link result without assuming authentication", async () => {
  const h = harness();
  await ready(h);
  assert.equal(
    await h.controller.completeAuthLink(
      "https://track.example/auth/callback?error=access_denied&error_code=otp_expired",
    ),
    false,
  );
  const result = h.controller.resumeAuthLink("https://track.example/auth/callback");
  assert.ok(result);
  assert.equal(await result, false);
  assert.match(h.controller.getSnapshot().error ?? "", /expired/);
  assert.equal(h.controller.getSnapshot().session, null);
  assert.equal(h.submitted, 0);
});

function secureMemory() {
  const values = new Map<string, string>();
  const storage = {
    async getItem(key: string) {
      return values.get(key) ?? null;
    },
    async setItem(key: string, value: string) {
      if (Buffer.byteLength(value) > 2048) throw new Error("Native value too large");
      values.set(key, value);
    },
    async removeItem(key: string) {
      values.delete(key);
    },
  };
  return { values, storage, session: createSecureSessionStorage(storage) };
}
test("large Unicode sessions round-trip through bounded encrypted native values", async () => {
  const h = secureMemory();
  const value = JSON.stringify({ token: "a".repeat(4200), metadata: "משתמש 🏋️".repeat(600) });
  await h.session.setItem("session", value);
  assert.equal(await h.session.getItem("session"), value);
  for (const item of h.values.values()) assert.ok(Buffer.byteLength(item) <= 2048);
});
test("a failed chunk write keeps the previous durable session", async () => {
  const h = secureMemory();
  await h.session.setItem("session", "previous-token".repeat(300));
  const write = h.storage.setItem;
  let writes = 0;
  h.storage.setItem = async (key, value) => {
    if (++writes === 2) throw new Error("device locked");
    await write(key, value);
  };
  await assert.rejects(h.session.setItem("session", "new-token".repeat(600)), /device locked/);
  assert.equal(await h.session.getItem("session"), "previous-token".repeat(300));
});
test("logout removes encrypted session parts and subsequent reads have no session", async () => {
  const h = secureMemory();
  await h.session.setItem("session", "token".repeat(2000));
  await h.session.removeItem("session");
  assert.equal(await h.session.getItem("session"), null);
  assert.equal(h.values.size, 0);
});
test("serialized concurrent session writes publish complete latest values", async () => {
  const h = secureMemory();
  const first = h.session.setItem("session", "first".repeat(1000));
  const second = h.session.setItem("session", "second".repeat(1000));
  await Promise.all([first, second]);
  assert.equal(await h.session.getItem("session"), "second".repeat(1000));
});
test("missing native chunks fail loudly rather than returning a partial session", async () => {
  const h = secureMemory();
  await h.session.setItem("session", "token".repeat(1000));
  const part = [...h.values.keys()].find((key) => key.includes(".part."));
  assert.ok(part);
  h.values.delete(part);
  await assert.rejects(h.session.getItem("session"), /incomplete/);
});
test("legacy encrypted values remain readable and migrate on the next write", async () => {
  const h = secureMemory();
  h.values.set("session", "legacy-token");
  assert.equal(await h.session.getItem("session"), "legacy-token");
  await h.session.setItem("session", "new-token");
  assert.equal(h.values.has("session"), false);
  assert.equal(await h.session.getItem("session"), "new-token");
});

test("logout cannot restore a stale legacy token when encrypted chunk cleanup fails", async () => {
  const h = secureMemory();
  await h.session.setItem("session", "current-token".repeat(300));
  h.values.set("session", "stale-legacy-token");
  const remove = h.storage.removeItem;
  h.storage.removeItem = async (key) => {
    if (key.includes(".part.")) throw new Error("Cleanup unavailable");
    await remove(key);
  };
  await h.session.removeItem("session");
  assert.equal(await h.session.getItem("session"), null);
  assert.equal(h.values.has("session"), false);
  assert.ok([...h.values.keys()].some((key) => key.includes(".part.")));
});
test("new login can replace corrupt encrypted metadata after its payload is complete", async () => {
  const h = secureMemory();
  h.values.set("session.manifest.v1", "invalid-json");
  h.values.set("session", "stale-legacy-token");
  await assert.rejects(h.session.getItem("session"));
  await h.session.setItem("session", "new-valid-token".repeat(400));
  assert.equal(await h.session.getItem("session"), "new-valid-token".repeat(400));
  assert.equal(h.values.has("session"), false);
});
test("failed secure writes never expose legacy tokens while replacing corrupt metadata", async () => {
  const h = secureMemory();
  h.values.set("session.manifest.v1", "invalid-json");
  h.values.set("session", "stale-legacy-token");
  h.storage.setItem = async () => {
    throw new Error("device locked");
  };
  await assert.rejects(h.session.setItem("session", "new-token"), /device locked/);
  await assert.rejects(h.session.getItem("session"));
  assert.equal(h.values.get("session.manifest.v1"), "invalid-json");
});
test("logout clears corrupt session metadata without reading a partial session", async () => {
  const h = secureMemory();
  h.values.set("session.manifest.v1", "invalid-json");
  h.values.set("session", "stale-legacy-token");
  await h.session.removeItem("session");
  assert.equal(await h.session.getItem("session"), null);
});
test("failure to remove the legacy reference preserves the current session and fails logout", async () => {
  const h = secureMemory();
  await h.session.setItem("session", "current-token");
  h.values.set("session", "stale-legacy-token");
  const remove = h.storage.removeItem;
  h.storage.removeItem = async (key) => {
    if (key === "session") throw new Error("device locked");
    await remove(key);
  };
  await assert.rejects(h.session.removeItem("session"), /device locked/);
  assert.equal(await h.session.getItem("session"), "current-token");
});

test("failed manifest commit preserves the prior complete session", async () => {
  const h = secureMemory();
  await h.session.setItem("session", "previous-token".repeat(200));
  const write = h.storage.setItem;
  h.storage.setItem = async (key, value) => {
    if (key.endsWith(".manifest.v1")) throw new Error("manifest write failed");
    await write(key, value);
  };
  await assert.rejects(
    h.session.setItem("session", "replacement-token".repeat(300)),
    /manifest write failed/,
  );
  assert.equal(await h.session.getItem("session"), "previous-token".repeat(200));
});
test("native read errors cannot erase sessions during replacement or logout", async () => {
  const h = secureMemory();
  await h.session.setItem("session", "previous-token");
  const read = h.storage.getItem;
  h.storage.getItem = async () => {
    throw new Error("device locked");
  };
  await assert.rejects(h.session.setItem("session", "replacement-token"), /device locked/);
  await assert.rejects(h.session.removeItem("session"), /device locked/);
  h.storage.getItem = read;
  assert.equal(await h.session.getItem("session"), "previous-token");
});
test("failure to remove manifest preserves the current session instead of legacy fallback", async () => {
  const h = secureMemory();
  await h.session.setItem("session", "current-token");
  h.values.set("session", "stale-legacy-token");
  const remove = h.storage.removeItem;
  h.storage.removeItem = async (key) => {
    if (key.endsWith(".manifest.v1")) throw new Error("device locked");
    await remove(key);
  };
  await assert.rejects(h.session.removeItem("session"), /device locked/);
  assert.equal(await h.session.getItem("session"), "current-token");
});
