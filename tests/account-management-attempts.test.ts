import assert from "node:assert/strict";
import test from "node:test";
import type { Session } from "@supabase/supabase-js";
import { createAccountController, type AccountAuthPort } from "../src/account/controller.ts";
import { createAccountManagementAttempts } from "../src/account/management-attempts.ts";
import { createAccountStorage, type AccountLocalStorage } from "../src/account/storage.ts";

const goalKey = "kinevault-track.water-goal.v1";
const prefix = "kinevault-track.account.a.";
const goal = JSON.stringify({ version: 1, dailyMl: 2100 });
type Ports = Parameters<typeof createAccountManagementAttempts>[0];

function sessionFor(ownerId: string): Session {
  return {
    user: {
      id: ownerId,
      email: `${ownerId}@example.com`,
      aud: "authenticated",
      app_metadata: {},
      user_metadata: {},
      created_at: "2026-10-08T00:00:00Z",
    },
    access_token: `${ownerId}-access`,
    refresh_token: `${ownerId}-refresh`,
    expires_in: 3600,
    token_type: "bearer",
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

async function setup(
  options: Partial<
    Pick<Ports, "readPhoto" | "deliverExport" | "deleteOnServer" | "removePhoto">
  > & {
    failCleanup?: boolean;
    beforeSessionCleared?: () => void;
    afterSessionCleared?: () => void;
  } = {},
) {
  const values = new Map<string, string>();
  const local: AccountLocalStorage = {
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => {
      values.set(key, value);
    },
    removeItem: async (key) => {
      if (options.failCleanup && key === `${prefix}${goalKey}`)
        throw new Error("Device storage unavailable");
      values.delete(key);
    },
    getAllKeys: async () => [...values.keys()],
  };
  const storage = createAccountStorage({ userId: "a", local, remote: null });
  await storage.start();
  await storage.setItem(goalKey, goal);
  const events: string[] = [];
  let currentSession: Session | null = sessionFor("a");
  let authChanged: Parameters<AccountAuthPort["onAuthStateChange"]>[0] | undefined;
  const result = async () => ({ data: { session: currentSession }, error: null });
  const auth: AccountAuthPort = {
    getSession: result,
    onAuthStateChange(callback) {
      authChanged = callback;
      return { data: { subscription: { unsubscribe: () => (authChanged = undefined) } } };
    },
    signInWithPassword: result,
    signUp: result,
    resetPasswordForEmail: async () => ({ error: null }),
    updateUser: async () => ({ error: null }),
    async clearDeletedSession(ownerId, isCurrent) {
      events.push("clear-session");
      options.beforeSessionCleared?.();
      if (!isCurrent() || currentSession?.user.id !== ownerId)
        return { error: null, cleared: false };
      currentSession = null;
      authChanged?.("SIGNED_OUT", null);
      options.afterSessionCleared?.();
      return { error: null, cleared: true };
    },
    async signOut() {
      throw new Error("Confirmed deletion must not call SDK signOut");
    },
    exchangeCodeForSession: result,
    verifyOtp: result,
    setSession: result,
  };
  const controller = createAccountController(auth, { redirectTo: "https://example.com/callback" });
  controller.start();
  await Promise.resolve();
  assert.equal(controller.getSnapshot().user?.id, "a");
  let offline = true;
  const delivered: string[] = [];
  const attempts = createAccountManagementAttempts({
    ownerId: "a",
    storage,
    account: () => ({
      ownerId: controller.getSnapshot().user?.id ?? null,
      busy: controller.getSnapshot().busy,
    }),
    deleteAccount: controller.deleteAccount,
    offline: () => offline,
    readPhoto: options.readPhoto ?? (async () => btoa("\xff\xd8\xff\xe0\x00\xff\xd9")),
    deliverExport:
      options.deliverExport ??
      (async (contents) => {
        delivered.push(contents);
      }),
    deleteOnServer:
      options.deleteOnServer ??
      (async () => {
        events.push("server-confirmed");
      }),
    removePhoto: options.removePhoto ?? (async () => {}),
    onDeleted: () => events.push("navigate-account"),
  });
  attempts.start();
  return {
    storage,
    values,
    delivered,
    events,
    controller,
    attempts,
    online: () => (offline = false),
    replaceOwner(ownerId: string | null) {
      currentSession = ownerId === null ? null : sessionFor(ownerId);
      authChanged?.(ownerId === null ? "SIGNED_OUT" : "SIGNED_IN", currentSession);
    },
    deletionForm() {
      offline = false;
      attempts.openDeletion();
      attempts.setPassword("request-only-secret");
      attempts.setConfirmation("DELETE");
    },
  };
}

test("management delivers the logical device export and retires feedback when canceled or departed", async () => {
  const h = await setup();
  assert.equal(await h.attempts.exportData(), true);
  const exported = JSON.parse(h.delivered[0]);
  assert.equal(exported.ownerId, "a");
  assert.equal(exported.cloudStatus, "not-requested-device-copy-only");
  assert.deepEqual(
    exported.documents.find((row: { key: string }) => row.key === goalKey).local.data,
    JSON.parse(goal),
  );
  assert.match(h.attempts.getSnapshot().notice ?? "", /Cloud changes weren't checked/);
  h.attempts.openDeletion();
  assert.equal(h.attempts.getSnapshot().notice, null);
  h.attempts.setPassword("field-only-secret");
  h.attempts.cancelDeletion();
  assert.deepEqual(h.attempts.getSnapshot().deletion, { kind: "closed" });
  h.attempts.openDeletion();
  h.attempts.setPassword("field-only-secret");
  h.attempts.stop();
  assert.deepEqual(h.attempts.getSnapshot().deletion, { kind: "closed" });
  assert.equal(await h.attempts.exportData(), false);
});

test("sharing failure leaves a retryable attempt and never claims export success", async () => {
  let deliveries = 0;
  const h = await setup({
    deliverExport: async () => {
      if (++deliveries === 1) throw new Error("Sharing unavailable");
    },
  });
  assert.equal(await h.attempts.exportData(), false);
  assert.equal(h.attempts.getSnapshot().error, "Sharing unavailable");
  assert.equal(h.attempts.getSnapshot().notice, null);
  assert.equal(h.attempts.getSnapshot().working, false);
  assert.equal(await h.attempts.exportData(), true);
  assert.equal(deliveries, 2);
  assert.equal(h.attempts.getSnapshot().error, null);
});

test("export holds shared exclusion through delivery, including synchronous subscriber reentry", async () => {
  const entered = deferred<void>();
  const delivered = deferred<void>();
  const h = await setup({
    deliverExport: async () => {
      entered.resolve();
      await delivered.promise;
    },
  });
  const reentered: Promise<boolean>[] = [];
  const unsubscribe = h.attempts.subscribe(() => {
    if (h.attempts.getSnapshot().working) reentered.push(h.attempts.exportData());
  });
  const exporting = h.attempts.exportData();
  await entered.promise;
  assert.deepEqual(await Promise.all(reentered), [false]);
  assert.equal(await h.attempts.exportData(), false);
  assert.equal(await h.attempts.retrySync(), false);
  assert.equal(await h.attempts.resolveConflict(goalKey, "cloud"), false);
  h.attempts.openDeletion();
  assert.deepEqual(h.attempts.getSnapshot().deletion, { kind: "closed" });
  assert.equal(await h.attempts.deleteData(), false);
  delivered.resolve();
  assert.equal(await exporting, true);
  unsubscribe();
});

test("subscriber departure at submission prevents adapter work even after immediate restart", async () => {
  const h = await setup();
  let retired = false;
  const unsubscribe = h.attempts.subscribe(() => {
    if (!retired && h.attempts.getSnapshot().working) {
      retired = true;
      h.attempts.stop();
      h.attempts.start();
    }
  });
  assert.equal(await h.attempts.exportData(), false);
  assert.deepEqual(h.delivered, []);
  assert.equal(h.attempts.getSnapshot().notice, null);
  assert.equal(h.attempts.getSnapshot().error, null);
  unsubscribe();
  assert.equal(await h.attempts.exportData(), true);
});

test("departure during export assembly prevents delivery and feedback in a restarted caller", async () => {
  const entered = deferred<void>();
  const photo = deferred<string>();
  let deliveries = 0;
  const h = await setup({
    readPhoto: async () => {
      entered.resolve();
      return photo.promise;
    },
    deliverExport: async () => {
      deliveries++;
    },
  });
  await h.storage.setItem(
    "kinevault-track.profile-media.v1",
    JSON.stringify({ version: 1, avatar: { id: "a-photo", width: 1, height: 1 }, photos: [] }),
  );
  const exporting = h.attempts.exportData();
  await entered.promise;
  h.attempts.stop();
  h.attempts.start();
  assert.equal(await h.attempts.exportData(), false);
  photo.resolve(btoa("\xff\xd8\xff\xe0\x00\xff\xd9"));
  assert.equal(await exporting, false);
  assert.equal(deliveries, 0);
  assert.equal(h.attempts.getSnapshot().error, null);
  assert.equal(h.attempts.getSnapshot().notice, null);
  assert.equal(h.attempts.getSnapshot().working, false);
});

test("a replacement owner during sharing receives no old success or failure feedback", async () => {
  for (const fails of [false, true]) {
    const entered = deferred<void>();
    const delivered = deferred<void>();
    const h = await setup({
      deliverExport: async () => {
        entered.resolve();
        await delivered.promise;
      },
    });
    const exporting = h.attempts.exportData();
    await entered.promise;
    h.replaceOwner("b");
    if (fails) delivered.reject(new Error("Old sharing failed"));
    else delivered.resolve();
    assert.equal(await exporting, false);
    assert.equal(h.attempts.getSnapshot().error, null);
    assert.equal(h.attempts.getSnapshot().notice, null);
    assert.equal(await h.attempts.exportData(), false);
  }
});

test("the live Account reader aborts export before delivery while the rendered owner is still stale", async () => {
  const entered = deferred<void>();
  const photo = deferred<string>();
  const h = await setup({
    readPhoto: async () => {
      entered.resolve();
      return photo.promise;
    },
  });
  await h.storage.setItem(
    "kinevault-track.profile-media.v1",
    JSON.stringify({ version: 1, avatar: { id: "a-photo", width: 1, height: 1 }, photos: [] }),
  );
  const renderedAccount = h.controller.getSnapshot();
  const exporting = h.attempts.exportData();
  await entered.promise;
  h.replaceOwner("b");
  // No caller rerender, stop, start, or updated render snapshot intervenes.
  assert.equal(renderedAccount.user?.id, "a");
  assert.equal(h.controller.getSnapshot().user?.id, "b");
  photo.resolve(btoa("\xff\xd8\xff\xe0\x00\xff\xd9"));
  assert.equal(await exporting, false);
  assert.deepEqual(h.delivered, []);
  assert.equal(h.attempts.getSnapshot().notice, null);
  assert.equal(h.attempts.getSnapshot().error, null);
});

test("submission clears the password before observers, freezes data and waits for server confirmation before auth retirement", async () => {
  const entered = deferred<void>();
  const server = deferred<void>();
  const h = await setup({
    deleteOnServer: async (ownerId, password) => {
      assert.equal(ownerId, "a");
      assert.equal(password, "request-only-secret");
      entered.resolve();
      await server.promise;
    },
  });
  h.deletionForm();
  let observerSawPassword = false;
  const unsubscribe = h.attempts.subscribe(() => {
    const state = h.attempts.getSnapshot();
    if (state.working && state.deletion.kind === "confirm" && state.deletion.password)
      observerSawPassword = true;
  });
  const deleting = h.attempts.deleteData();
  assert.equal(observerSawPassword, false);
  assert.deepEqual(h.attempts.getSnapshot().deletion, {
    kind: "confirm",
    password: "",
    confirmation: "DELETE",
  });
  await entered.promise;
  assert.equal(h.values.get(`${prefix}deleted.v1`), "pending");
  assert.equal(h.controller.getSnapshot().user?.id, "a");
  assert.deepEqual(h.events, []);
  assert.equal(await h.attempts.deleteData(), false);
  assert.equal(await h.attempts.exportData(), false);
  await assert.rejects(h.storage.setItem(goalKey, goal), /delet/i);
  server.resolve();
  assert.equal(await deleting, true);
  unsubscribe();
  assert.deepEqual(h.events, ["clear-session", "navigate-account"]);
  assert.equal(h.controller.getSnapshot().user, null);
  assert.equal(h.controller.getSnapshot().notice, "Your KineVault account has been deleted.");
  assert.deepEqual([...h.values], [[`${prefix}deleted.v1`, "1"]]);
});

test("server rejection preserves confirmation and saved data, requires a fresh password and supports explicit retry", async () => {
  let requests = 0;
  const h = await setup({
    deleteOnServer: async () => {
      if (++requests === 1)
        throw new Error("Couldn't confirm deletion. Your local data has been kept.");
    },
  });
  h.deletionForm();
  assert.equal(await h.attempts.deleteData(), false);
  assert.match(h.attempts.getSnapshot().error ?? "", /local data has been kept/);
  assert.equal(h.controller.getSnapshot().error, null);
  assert.equal(h.values.has(`${prefix}deleted.v1`), false);
  assert.equal(await h.storage.getItem(goalKey), goal);
  assert.deepEqual(h.events, []);
  assert.deepEqual(h.attempts.getSnapshot().deletion, {
    kind: "confirm",
    password: "",
    confirmation: "DELETE",
  });
  assert.equal(await h.attempts.deleteData(), false);
  assert.equal(requests, 1);
  h.attempts.setPassword("retry-only-secret");
  assert.equal(await h.attempts.deleteData(), true);
  assert.equal(requests, 2);
});

test("rejected deletion feedback retires with cancel, replacement form, and same-owner caller remount", async () => {
  const h = await setup({
    deleteOnServer: async () => {
      throw new Error("Only this deletion attempt failed");
    },
  });
  for (const retirement of ["cancel", "replace", "remount"]) {
    h.deletionForm();
    assert.equal(await h.attempts.deleteData(), false);
    assert.equal(h.attempts.getSnapshot().error, "Only this deletion attempt failed");
    assert.equal(h.controller.getSnapshot().error, null);
    if (retirement === "cancel") h.attempts.cancelDeletion();
    else if (retirement === "replace") h.attempts.openDeletion();
    else {
      h.attempts.stop();
      h.attempts.start();
    }
    assert.equal(h.attempts.getSnapshot().error, null);
    assert.equal(h.attempts.getSnapshot().notice, null);
    assert.equal(h.controller.getSnapshot().error, null);
  }
});

test("a rejected retry of an uncertain earlier deletion preserves its durable block and saved data", async () => {
  const h = await setup({
    deleteOnServer: async () => {
      throw new Error("The server outcome still cannot be confirmed");
    },
  });
  // A previous process persisted its pending marker but lost the server reply.
  h.values.set(`${prefix}deleted.v1`, "pending");
  h.deletionForm();
  assert.equal(await h.attempts.deleteData(), false);
  assert.equal(h.values.get(`${prefix}deleted.v1`), "pending");
  assert.equal(await h.storage.getItem(goalKey), goal);
  await assert.rejects(h.storage.setItem(goalKey, goal), /delet/i);
  assert.equal(h.controller.getSnapshot().user?.id, "a");
  assert.deepEqual(h.events, []);
  assert.match(h.attempts.getSnapshot().error ?? "", /local data remains frozen.*Clear.*storage/);
});

test("offline submission preserves the field and online invalid confirmation never reaches the server", async () => {
  const h = await setup();
  h.attempts.openDeletion();
  h.attempts.setPassword("field-only-secret");
  h.attempts.setConfirmation("DELETE");
  assert.equal(await h.attempts.deleteData(), false);
  assert.deepEqual(h.attempts.getSnapshot().deletion, {
    kind: "confirm",
    password: "field-only-secret",
    confirmation: "DELETE",
  });
  h.online();
  h.attempts.setConfirmation("delete");
  assert.equal(await h.attempts.deleteData(), false);
  assert.deepEqual(h.events, []);
  assert.equal(h.values.has(`${prefix}deleted.v1`), false);
  assert.match(h.attempts.getSnapshot().error ?? "", /type DELETE/);
});

test("abandoned deletion rejection cannot publish feedback into a newer caller for the same owner", async () => {
  const entered = deferred<void>();
  const server = deferred<void>();
  const h = await setup({
    deleteOnServer: async () => {
      entered.resolve();
      return server.promise;
    },
  });
  h.deletionForm();
  const deleting = h.attempts.deleteData();
  await entered.promise;
  h.attempts.stop();
  h.attempts.start();
  server.reject(new Error("Old caller's deletion failed"));
  assert.equal(await deleting, false);
  assert.equal(h.controller.getSnapshot().error, null);
  assert.equal(h.attempts.getSnapshot().error, null);
  assert.deepEqual(h.attempts.getSnapshot().deletion, { kind: "closed" });
  assert.equal(h.controller.getSnapshot().user?.id, "a");
  assert.equal(await h.storage.getItem(goalKey), goal);
  assert.deepEqual(h.events, []);
});

test("confirmed server deletion finishes immutable-owner cleanup after replacement without clearing its session or navigating", async () => {
  const entered = deferred<void>();
  const server = deferred<void>();
  const h = await setup({
    deleteOnServer: async () => {
      entered.resolve();
      return server.promise;
    },
  });
  h.deletionForm();
  const deleting = h.attempts.deleteData();
  await entered.promise;
  h.replaceOwner("b");
  server.resolve();
  assert.equal(await deleting, false);
  assert.equal(h.controller.getSnapshot().user?.id, "b");
  assert.equal(h.controller.getSnapshot().notice, null);
  assert.deepEqual(h.events, []);
  assert.deepEqual([...h.values], [[`${prefix}deleted.v1`, "1"]]);
});

test("an A to B to A replacement cannot revive the earlier deletion's auth retirement or navigation", async () => {
  const entered = deferred<void>();
  const server = deferred<void>();
  const h = await setup({
    deleteOnServer: async () => {
      entered.resolve();
      return server.promise;
    },
  });
  h.deletionForm();
  const deleting = h.attempts.deleteData();
  await entered.promise;
  h.replaceOwner("b");
  h.replaceOwner("a");
  server.resolve();
  assert.equal(await deleting, false);
  assert.equal(h.controller.getSnapshot().user?.id, "a");
  assert.equal(h.controller.getSnapshot().notice, null);
  assert.deepEqual(h.events, []);
  assert.deepEqual([...h.values], [[`${prefix}deleted.v1`, "1"]]);
});

test("confirmed deletion after caller departure retains Account feedback but never navigates that caller", async () => {
  const entered = deferred<void>();
  const server = deferred<void>();
  const h = await setup({
    deleteOnServer: async () => {
      entered.resolve();
      return server.promise;
    },
  });
  h.deletionForm();
  const deleting = h.attempts.deleteData();
  await entered.promise;
  h.attempts.stop();
  server.resolve();
  assert.equal(await deleting, false);
  assert.equal(h.controller.getSnapshot().user, null);
  assert.equal(h.controller.getSnapshot().notice, "Your KineVault account has been deleted.");
  assert.deepEqual(h.events, ["clear-session"]);
});

test("auth retirement can detach Settings before deletion completes while preserving its successful navigation", async () => {
  const h = await setup();
  h.deletionForm();
  const unsubscribe = h.controller.subscribe(() => {
    if (h.controller.getSnapshot().user === null) h.attempts.stop();
  });
  assert.equal(await h.attempts.deleteData(), true);
  unsubscribe();
  assert.deepEqual(h.events, ["server-confirmed", "clear-session", "navigate-account"]);
  assert.equal(h.controller.getSnapshot().user, null);
  assert.equal(h.controller.getSnapshot().notice, "Your KineVault account has been deleted.");
});

test("leaving Settings after data deletion but before auth retires still suppresses navigation", async () => {
  const h = await setup({ beforeSessionCleared: () => h.attempts.stop() });
  h.deletionForm();
  assert.equal(await h.attempts.deleteData(), false);
  assert.deepEqual(h.events, ["server-confirmed", "clear-session"]);
  assert.equal(h.controller.getSnapshot().user, null);
  assert.equal(h.controller.getSnapshot().notice, "Your KineVault account has been deleted.");
});

test("a replacement signing in and out during auth retirement cannot revive old deletion navigation", async () => {
  const h = await setup({
    afterSessionCleared: () => {
      h.replaceOwner("b");
      h.replaceOwner(null);
    },
  });
  h.deletionForm();
  const unsubscribe = h.controller.subscribe(() => {
    if (h.controller.getSnapshot().user === null) h.attempts.stop();
  });
  assert.equal(await h.attempts.deleteData(), false);
  unsubscribe();
  assert.deepEqual(h.events, ["server-confirmed", "clear-session"]);
  assert.equal(h.controller.getSnapshot().notice, null);
});

test("a restarted caller after auth retirement receives no earlier deletion navigation", async () => {
  const h = await setup();
  h.deletionForm();
  let restarted = false;
  const unsubscribe = h.controller.subscribe(() => {
    if (!restarted && h.controller.getSnapshot().user === null) {
      restarted = true;
      h.attempts.stop();
      h.attempts.start();
    }
  });
  assert.equal(await h.attempts.deleteData(), false);
  unsubscribe();
  assert.deepEqual(h.events, ["server-confirmed", "clear-session"]);
  assert.equal(h.controller.getSnapshot().notice, "Your KineVault account has been deleted.");
});

test("confirmed cleanup failure still retires auth and preserves an accurate Account notice", async () => {
  const h = await setup({ failCleanup: true });
  h.deletionForm();
  assert.equal(await h.attempts.deleteData(), true);
  assert.equal(h.values.get(`${prefix}deleted.v1`), "1");
  assert.equal(h.values.has(`${prefix}${goalKey}`), true);
  assert.match(h.controller.getSnapshot().notice ?? "", /Some data remains on this device/);
  assert.deepEqual(h.events, ["server-confirmed", "clear-session", "navigate-account"]);
});
