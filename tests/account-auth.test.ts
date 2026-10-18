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
function harness(openAuthSession: (url: string) => Promise<string | null> = async () => null) {
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
    async resend() {
      submitted++;
      return result;
    },
    async signInWithOAuth() {
      submitted++;
      return { data: { url: "https://auth.example/authorize" }, error: null };
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
  };
  const controller = createAccountController(auth, {
    redirectTo: "kinevaulttrack://auth/callback",
    openAuthSession,
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
test("email delivery owns its normalized recipient and clears with feedback", async () => {
  const h = harness();
  h.setResult({ data: { session: null }, error: null });
  await ready(h);
  assert.equal(await h.controller.signUp("  alex@example.com  ", "safe-password"), false);
  assert.match(h.controller.getSnapshot().notice ?? "", /Check your email/);
  assert.deepEqual(h.controller.getSnapshot().emailDelivery, {
    kind: "confirmation",
    email: "alex@example.com",
    resends: 0,
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

test("confirmation resends keep the confirmation screen and cap emails at three an hour", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 0 });
  const h = harness();
  h.setResult({ data: { session: null }, error: null });
  await ready(h);
  const resent: Parameters<AccountAuthPort["resend"]>[0][] = [];
  h.auth.resend = async (credentials) => {
    resent.push(credentials);
    return { error: null };
  };
  assert.equal(await h.controller.resendConfirmation(), false);
  assert.equal(await h.controller.signUp(" Alex@example.com ", "safe-password"), false);
  assert.equal(await h.controller.resendConfirmation(), true);
  assert.deepEqual(resent[0], {
    type: "signup",
    email: "Alex@example.com",
    options: { emailRedirectTo: "kinevaulttrack://auth/callback" },
  });
  assert.deepEqual(h.controller.getSnapshot().emailDelivery, {
    kind: "confirmation",
    email: "Alex@example.com",
    resends: 1,
  });
  assert.equal(await h.controller.resendConfirmation(), true);
  t.mock.timers.tick(10 * 60 * 1000);
  assert.equal(await h.controller.resendConfirmation(), false);
  assert.equal(resent.length, 2);
  assert.match(h.controller.getSnapshot().error ?? "", /limit of 3 .*Try again in 50 minutes/);
  assert.equal(h.controller.getSnapshot().emailDelivery?.kind, "confirmation");
  t.mock.timers.tick(50 * 60 * 1000);
  assert.equal(await h.controller.resendConfirmation(), true);
  assert.equal(resent.length, 3);
});
test("the cap's wait counts down to the send that frees a slot, even after extra sign-ups", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 0 });
  const h = harness();
  h.setResult({ data: { session: null }, error: null });
  await ready(h);
  // Signing up again isn't blocked, so four emails can be on record.
  for (let minute = 0; minute < 4; minute++) {
    await h.controller.signUp("alex@example.com", "safe-password");
    t.mock.timers.tick(60 * 1000);
  }
  assert.equal(await h.controller.resendConfirmation(), false);
  assert.match(h.controller.getSnapshot().error ?? "", /Try again in 57 minutes/);
});
test("a failed resend keeps the confirmation screen and does not count toward the cap", async () => {
  const h = harness();
  h.setResult({ data: { session: null }, error: null });
  await ready(h);
  await h.controller.signUp("alex@example.com", "safe-password");
  let calls = 0;
  h.auth.resend = async () =>
    ++calls === 1
      ? { error: { message: "rate limited", code: "over_email_send_rate_limit", status: 429 } }
      : { error: null };
  assert.equal(await h.controller.resendConfirmation(), false);
  assert.match(h.controller.getSnapshot().error ?? "", /Too many requests/);
  assert.equal(h.controller.getSnapshot().emailDelivery?.kind, "confirmation");
  assert.equal(await h.controller.resendConfirmation(), true);
  assert.equal(await h.controller.resendConfirmation(), true);
  assert.equal(await h.controller.resendConfirmation(), false);
  assert.equal(calls, 3);
});
test("a resent confirmation survives a provider remount and each resend publishes a new delivery", async () => {
  const h = harness();
  h.setResult({ data: { session: null }, error: null });
  await ready(h);
  await h.controller.signUp("alex@example.com", "safe-password");
  assert.equal(await h.controller.resendConfirmation(), true);
  const first = h.controller.getSnapshot().emailDelivery;
  assert.equal(await h.controller.resendConfirmation(), true);
  assert.notEqual(
    h.controller.getSnapshot().emailDelivery,
    first,
    "the screen announces each send",
  );
  h.controller.stop();
  await ready(h);
  assert.deepEqual(h.controller.getSnapshot().emailDelivery, {
    kind: "confirmation",
    email: "alex@example.com",
    resends: 2,
  });
  // Feedback cleared while a resend is in flight stays cleared.
  await h.controller.signUp("sam@example.com", "safe-password");
  const sent = deferred<{ error: null }>();
  h.auth.resend = () => sent.promise;
  const late = h.controller.resendConfirmation();
  h.controller.clearFeedback();
  sent.resolve({ error: null });
  assert.equal(await late, true);
  assert.equal(h.controller.getSnapshot().emailDelivery, null);
});

test("Google sign-in opens the provider and exchanges the returned PKCE code", async () => {
  const opened: string[] = [];
  const h = harness(async (url) => {
    opened.push(url);
    return "kinevaulttrack://auth/callback?code=google-code";
  });
  await ready(h);
  h.auth.signInWithOAuth = async (credentials) => {
    assert.deepEqual(credentials, {
      provider: "google",
      options: { redirectTo: "kinevaulttrack://auth/callback", skipBrowserRedirect: true },
    });
    return { data: { url: "https://auth.example/authorize?provider=google" }, error: null };
  };
  const exchanged: string[] = [];
  h.auth.exchangeCodeForSession = async (code) => {
    exchanged.push(code);
    return { data: { session }, error: null };
  };
  assert.equal(await h.controller.signInWithGoogle(), true);
  assert.deepEqual(opened, ["https://auth.example/authorize?provider=google"]);
  assert.deepEqual(exchanged, ["google-code"]);
  assert.equal(h.controller.getSnapshot().user?.id, "owner");
});
test("Google sign-in stays quiet on cancel and explains provider or browser failures", async () => {
  const browser = [
    async () => null,
    async () => "kinevaulttrack://auth/callback?error=access_denied&error_code=bad_oauth_state",
    async () => "kinevaulttrack://auth/callback?token_hash=someone-else&type=email",
    async () => {
      throw new Error("another browser is open");
    },
  ];
  const h = harness(() => browser.shift()!());
  await ready(h);
  assert.equal(await h.controller.signInWithGoogle(), false);
  assert.equal(h.controller.getSnapshot().error, null);
  assert.equal(await h.controller.signInWithGoogle(), false);
  assert.match(h.controller.getSnapshot().error ?? "", /Google sign-in didn't finish/);
  // A token-hash link handed to the browser session isn't this sign-in's code.
  h.auth.verifyOtp = async () => assert.fail("only a PKCE code completes Google sign-in");
  h.controller.clearFeedback();
  assert.equal(await h.controller.signInWithGoogle(), false);
  assert.match(h.controller.getSnapshot().error ?? "", /Google sign-in didn't finish/);
  assert.equal(await h.controller.signInWithGoogle(), false);
  assert.match(h.controller.getSnapshot().error ?? "", /Couldn't open Google sign-in/);
  assert.equal(h.controller.getSnapshot().busy, false);
  assert.equal(h.controller.getSnapshot().user, null);
});
test("a second Google tap while its browser is open does nothing", async () => {
  const browser = deferred<string | null>();
  const h = harness(() => browser.promise);
  await ready(h);
  let starts = 0;
  const signIn = h.auth.signInWithOAuth;
  h.auth.signInWithOAuth = (credentials) => {
    starts++;
    return signIn(credentials);
  };
  const first = h.controller.signInWithGoogle();
  await new Promise((resolve) => setTimeout(resolve, 0)); // the browser is now open
  const second = h.controller.signInWithGoogle();
  browser.resolve(null);
  assert.equal(await second, false);
  assert.equal(await first, false);
  assert.equal(starts, 1, "a second start would replace the open browser's verifier");
  assert.equal(await h.controller.signInWithGoogle(), false);
  assert.equal(starts, 2, "the guard clears once the browser closes");
});
test("a link whose PKCE verifier was removed explains how to finish", async () => {
  const h = harness();
  await ready(h);
  h.auth.exchangeCodeForSession = async () => ({
    data: { session: null },
    error: {
      message: "PKCE code verifier not found in storage.",
      code: "pkce_code_verifier_not_found",
    },
  });
  assert.equal(await h.controller.completeAuthLink("kinevaulttrack://auth/callback?code=c"), false);
  assert.match(h.controller.getSnapshot().error ?? "", /log in after confirming your email/);
});
test("Google's redirect may also reach the callback route while the browser is still open", async () => {
  const link = "kinevaulttrack://auth/callback?code=google-code";
  let routeResult: Promise<boolean> | undefined;
  const h = harness(async () => {
    routeResult = h.controller.completeAuthLink(link);
    return link;
  });
  await ready(h);
  let exchanges = 0;
  h.auth.exchangeCodeForSession = async () => {
    exchanges++;
    return { data: { session }, error: null };
  };
  const signedIn = await h.controller.signInWithGoogle();
  assert.equal(await routeResult, true);
  assert.equal(signedIn, true);
  assert.equal(exchanges, 1);
});

test("recovery belongs to the current identity and does not follow an account switch", async () => {
  const h = harness();
  await ready(h);
  h.emit("PASSWORD_RECOVERY", session);
  h.emit("SIGNED_IN", { ...session, user: { ...session.user, id: "other-owner" } });
  assert.equal(h.controller.getSnapshot().recovery, false);
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
    openAuthSession: async () => null,
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
test("token hashes send the correct credentials and implicit links reach no auth call", async () => {
  const h = harness();
  await ready(h);
  h.auth.verifyOtp = async (credentials) => {
    assert.deepEqual(credentials, { token_hash: "email-hash", type: "email" });
    return { data: { session }, error: null };
  };
  assert.equal(
    await h.controller.completeAuthLink(
      "kinevaulttrack://auth/callback?token_hash=email-hash&type=email",
    ),
    true,
  );
  assert.equal(await h.controller.signOut(), true);
  const before = h.submitted;
  assert.equal(
    await h.controller.completeAuthLink(
      "kinevaulttrack://auth/callback#access_token=other-access&refresh_token=other-refresh",
    ),
    false,
  );
  assert.equal(h.submitted, before);
  assert.equal(h.controller.getSnapshot().user, null);
});
test("links without a device-bound PKCE code never replace a signed-in account", async () => {
  const h = harness();
  await ready(h);
  h.emit("SIGNED_IN", session);
  const before = h.submitted;
  for (const link of [
    "kinevaulttrack://auth/callback?token_hash=attacker-hash&type=email",
    "https://track.example/auth/callback?token_hash=attacker-hash&type=recovery",
  ]) {
    assert.equal(await h.controller.completeAuthLink(link), false);
    assert.match(h.controller.getSnapshot().error ?? "", /already logged in/);
    // The sanitized remount gets the retained refusal, not a new verification error.
    assert.equal(await h.controller.completeAuthLink(link.replace(/[?#].*$/, "")), false);
    assert.match(h.controller.getSnapshot().error ?? "", /already logged in/);
  }
  assert.equal(h.submitted, before, "no credentials from the link reach Auth");
  assert.equal(h.controller.getSnapshot().user?.id, "owner");
  assert.equal(h.controller.getSnapshot().recovery, false);
  // A PKCE code still completes, since only this device holds its verifier.
  assert.equal(
    await h.controller.completeAuthLink("kinevaulttrack://auth/callback?code=device-code"),
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
  const resumed = h.controller.completeAuthLink("https://track.example/auth/callback");
  pending.resolve({ data: { session }, error: null });
  assert.equal(await verification, true);
  assert.equal(await resumed, true);
  assert.equal(exchanges, 1);
  assert.equal(h.controller.getSnapshot().recovery, true);
  h.controller.acknowledgeAuthLink();
  assert.equal(await h.controller.completeAuthLink("https://track.example/auth/callback"), false);
  assert.equal(exchanges, 1);
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
  const resumed = h.controller.completeAuthLink("https://track.example/auth/callback");
  pending.resolve({ data: { session: replacement }, error: null });
  assert.equal(await verification, true);
  assert.equal(
    await resumed,
    true,
    "the account-owned screen remount must retain this link's outcome",
  );
  assert.equal(h.controller.getSnapshot().recovery, true);
});
test("a signed-in session alone cannot resume an unrelated or fresh callback", async () => {
  const h = harness();
  await ready(h);
  h.emit("SIGNED_IN", session);
  const callback = "https://track.example/auth/callback";
  assert.equal(await h.controller.completeAuthLink(callback), false);
  assert.match(h.controller.getSnapshot().error ?? "", /couldn't be verified/);
  assert.equal(await h.controller.completeAuthLink(`${callback}?code=verified`), true);
  const exchanged = h.submitted;
  assert.equal(await h.controller.completeAuthLink("https://other.example/auth/callback"), false);
  assert.equal(await h.controller.completeAuthLink(`${callback}?error=expired`), false);
  assert.equal(
    await h.controller.completeAuthLink("https://track.example/auth/reset-password"),
    false,
  );
  assert.equal(h.submitted, exchanged);
  // A new link on the same path is exchanged, not answered with the retained result.
  assert.equal(await h.controller.completeAuthLink(`${callback}?code=new-code`), true);
  assert.equal(h.submitted, exchanged + 1);
  await h.controller.signOut();
  assert.equal(await h.controller.completeAuthLink(callback), false);
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
  assert.equal(await h.controller.completeAuthLink("https://track.example/auth/callback"), false);
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
