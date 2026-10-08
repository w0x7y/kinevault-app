import assert from "node:assert/strict";
import test from "node:test";
import { createClient, type Session } from "@supabase/supabase-js";
import {
  createOwnedSessionStorage,
  createWebSessionBackend,
  type SessionBackend,
} from "../src/account/owned-session-storage.ts";
import { createAccountAuthAdapter } from "../src/account/auth-adapter.ts";
import { createAccountController, getAppAccountController } from "../src/account/controller.ts";

const key = "kinevault-track.auth.v1";
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function session(owner: string): Session {
  return {
    access_token: `access-${owner}`,
    refresh_token: `refresh-${owner}`,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: {
      id: owner,
      email: `${owner}@example.com`,
      aud: "authenticated",
      app_metadata: {},
      user_metadata: {},
      created_at: "2026-10-08T00:00:00Z",
    },
  };
}
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
function fixture() {
  const values = new Map([[key, JSON.stringify(session("a"))]]);
  const backend: SessionBackend = {
    async getItem(key) {
      return values.get(key) ?? null;
    },
    async setItem(key, value) {
      values.set(key, value);
    },
    async removeItem(key) {
      values.delete(key);
    },
  };
  const storage = createOwnedSessionStorage(backend);
  const requests: string[] = [];
  const logout = deferred<void>();
  const client = (adapter = storage) =>
    createClient("https://auth-regression.test", "public-test-key", {
      auth: {
        storage: adapter,
        storageKey: key,
        autoRefreshToken: false,
        persistSession: true,
        detectSessionInUrl: false,
      },
      global: {
        fetch: async (input, options) => {
          const url = String(input);
          requests.push(url);
          if (url.includes("/logout")) {
            await logout.promise;
            return new Response("{}", { status: 200 });
          }
          if (url.includes("/token?grant_type=password")) {
            const body = JSON.parse(String(options?.body));
            return new Response(JSON.stringify(session(body.email.startsWith("b") ? "b" : "a")), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }
          throw new Error(`Unexpected mock request ${url}`);
        },
      },
    });
  return { values, backend, storage, requests, logout, client };
}

test("installed SDK signOut reproduces why deletion cannot await HTTP then remove the current session", async () => {
  const f = fixture();
  const sdkA = f.client(),
    sdkB = f.client();
  try {
    assert.equal((await sdkA.auth.getSession()).data.session?.user.id, "a");
    const pending = sdkA.auth.signOut({ scope: "local" });
    await tick();
    assert.ok(f.requests.some((url) => url.includes("/logout")));
    assert.equal(
      (await sdkB.auth.signInWithPassword({ email: "b@example.com", password: "password" })).error,
      null,
    );
    assert.equal((await sdkB.auth.getSession()).data.session?.user.id, "b");
    f.logout.resolve();
    await pending;
    assert.equal((await sdkB.auth.getSession()).data.session, null);
  } finally {
    await sdkA.auth.dispose();
    await sdkB.auth.dispose();
  }
});

test("deletion adapter preserves B in both installed SDK contexts, persisted storage and controller after delayed A cleanup", async () => {
  const f = fixture();
  const sdkA = f.client(),
    sdkB = f.client(createOwnedSessionStorage(f.backend));
  const auth = createAccountAuthAdapter(sdkA.auth, f.storage, key);
  const controller = createAccountController(auth, {
    redirectTo: "kinevaulttrack://auth/callback",
  });
  try {
    controller.start();
    await tick();
    assert.equal(controller.getSnapshot().user?.id, "a");
    const removed = deferred<string | null>();
    const pending = controller.deleteAccount("a", () => removed.promise);
    await sdkB.auth.signInWithPassword({ email: "b@example.com", password: "password" });
    removed.resolve(null);
    assert.equal(await pending, false);
    assert.equal(controller.getSnapshot().user?.id, "b");
    assert.equal(JSON.parse(f.values.get(key)!).user.id, "b");
    assert.equal((await sdkA.auth.getSession()).data.session?.user.id, "b");
    assert.equal((await sdkB.auth.getSession()).data.session?.user.id, "b");
    assert.equal(
      f.requests.some((url) => url.includes("/logout")),
      false,
    );
  } finally {
    controller.stop();
    await sdkA.auth.dispose();
    await sdkB.auth.dispose();
  }
});

test("external B replacement while owner-clear is awaiting storage is compared at removal, not before an await", async () => {
  const f = fixture();
  const sdk = f.client();
  const auth = createAccountAuthAdapter(sdk.auth, f.storage, key);
  const controller = createAccountController(auth, {
    redirectTo: "kinevaulttrack://auth/callback",
  });
  try {
    controller.start();
    await tick();
    const read = deferred<void>(),
      entered = deferred<void>();
    const getItem = f.backend.getItem;
    f.backend.getItem = async (name) => {
      if (name === key) {
        entered.resolve();
        await read.promise;
      }
      return getItem(name);
    };
    const pending = controller.deleteAccount("a", async () => null);
    await entered.promise;
    // An external context bypasses the cooperative adapter. The persisted value
    // replaces A while removal is paused; getSession must still read B afterward.
    f.values.set(key, JSON.stringify(session("b")));
    read.resolve();
    assert.equal(await pending, false);
    assert.equal(JSON.parse(f.values.get(key)!).user.id, "b");
    assert.equal((await sdk.auth.getSession()).data.session?.user.id, "b");
    assert.equal(controller.getSnapshot().user?.id, "b");
  } finally {
    controller.stop();
    await sdk.auth.dispose();
  }
});

test("cooperative B SDK install queued during native physical clear survives and replaces controller state", async () => {
  const f = fixture();
  const sdkA = f.client(),
    sdkB = f.client(createOwnedSessionStorage(f.backend));
  const controller = createAccountController(createAccountAuthAdapter(sdkA.auth, f.storage, key), {
    redirectTo: "kinevaulttrack://auth/callback",
  });
  try {
    controller.start();
    await tick();
    const remove = deferred<void>(),
      entered = deferred<void>();
    f.backend.removeItem = async (name) => {
      entered.resolve();
      await remove.promise;
      f.values.delete(name);
    };
    const deleting = controller.deleteAccount("a", async () => null);
    await entered.promise;
    const installing = sdkB.auth.signInWithPassword({
      email: "b@example.com",
      password: "password",
    });
    await tick();
    remove.resolve();
    await deleting;
    await installing;
    assert.equal(JSON.parse(f.values.get(key)!).user.id, "b");
    assert.equal((await sdkA.auth.getSession()).data.session?.user.id, "b");
    assert.equal((await sdkB.auth.getSession()).data.session?.user.id, "b");
    assert.equal(controller.getSnapshot().user?.id, "b");
    assert.equal(
      f.requests.some((url) => url.includes("/logout")),
      false,
    );
  } finally {
    controller.stop();
    await sdkA.auth.dispose();
    await sdkB.auth.dispose();
  }
});

test("current-owner deletion clears the installed SDK session without a logout request", async () => {
  const f = fixture();
  const sdk = f.client();
  const controller = createAccountController(createAccountAuthAdapter(sdk.auth, f.storage, key), {
    redirectTo: "kinevaulttrack://auth/callback",
  });
  try {
    controller.start();
    await tick();
    assert.equal(await controller.deleteAccount("a", async () => null), true);
    assert.equal(f.values.has(key), false);
    assert.equal((await sdk.auth.getSession()).data.session, null);
    assert.equal(controller.getSnapshot().user, null);
    assert.deepEqual(f.requests, []);
  } finally {
    controller.stop();
    await sdk.auth.dispose();
  }
});

test("confirmed local removal cannot be undone by an A refresh that was already in flight", async () => {
  const f = fixture();
  await f.storage.clearDeletedOwner(key, "a", () => true);
  await assert.rejects(f.storage.setItem(key, JSON.stringify(session("a"))), /deleted/);
  await createOwnedSessionStorage(f.backend).setItem(key, JSON.stringify(session("b")));
  assert.equal(JSON.parse(f.values.get(key)!).user.id, "b");
});

test("production web compare/removal sees a raw external replacement at commit and leaves it untouched", async () => {
  const f = fixture();
  const nativeStorage = {
    getItem: (name: string) => f.values.get(name) ?? null,
    setItem: (name: string, value: string) => {
      f.values.set(name, value);
    },
    removeItem: (name: string) => {
      f.values.delete(name);
    },
  };
  const storage = createOwnedSessionStorage(createWebSessionBackend(() => nativeStorage));
  const sdk = f.client(storage);
  const controller = createAccountController(createAccountAuthAdapter(sdk.auth, storage, key), {
    redirectTo: "kinevaulttrack://auth/callback",
  });
  try {
    controller.start();
    await tick();
    const deleting = controller.deleteAccount("a", async () => null);
    // This direct write occurs before the async clear reaches its synchronous
    // compare/remove transaction; it sends no SDK or app-owned auth event.
    nativeStorage.setItem(key, JSON.stringify(session("b")));
    assert.equal(await deleting, false);
    assert.equal(JSON.parse(nativeStorage.getItem(key)!).user.id, "b");
    assert.equal((await sdk.auth.getSession()).data.session?.user.id, "b");
    assert.equal(controller.getSnapshot().user?.id, "b");
  } finally {
    controller.stop();
    await sdk.auth.dispose();
  }
});

test("separate web adapters share one lock across SDK writes and conditional removal", async () => {
  const f = fixture();
  let tail: Promise<unknown> = Promise.resolve();
  const entered = deferred<void>(),
    release = deferred<void>();
  let hold = false;
  function exclusive<T>(_key: string, run: () => Promise<T>): Promise<T> {
    const task = tail
      .catch(() => {})
      .then(async () => {
        if (hold) {
          hold = false;
          entered.resolve();
          await release.promise;
        }
        return run();
      });
    tail = task;
    return task;
  }
  const web = {
    getItem: (name: string) => f.values.get(name) ?? null,
    setItem: (name: string, value: string) => {
      f.values.set(name, value);
    },
    removeItem: (name: string) => {
      f.values.delete(name);
    },
  };
  const a = createOwnedSessionStorage(createWebSessionBackend(() => web, exclusive));
  const b = createOwnedSessionStorage(createWebSessionBackend(() => web, exclusive));
  const sdkA = f.client(a),
    sdkB = f.client(b);
  try {
    await sdkA.auth.getSession();
    await sdkB.auth.getSession();
    hold = true;
    const clearing = a.clearDeletedOwner(key, "a", () => true);
    await entered.promise;
    const installing = sdkB.auth.signInWithPassword({
      email: "b@example.com",
      password: "password",
    });
    await tick();
    assert.equal(JSON.parse(f.values.get(key)!).user.id, "a");
    release.resolve();
    assert.equal(await clearing, true);
    await installing;
    assert.equal((await sdkA.auth.getSession()).data.session?.user.id, "b");
    assert.equal((await sdkB.auth.getSession()).data.session?.user.id, "b");
    assert.equal(JSON.parse(f.values.get(key)!).user.id, "b");
  } finally {
    await sdkA.auth.dispose();
    await sdkB.auth.dispose();
  }
});

test("web without a cross-context lock fails clearing honestly and preserves the current persisted login", async () => {
  const f = fixture();
  const web = {
    getItem: (name: string) => f.values.get(name) ?? null,
    setItem: (name: string, value: string) => {
      f.values.set(name, value);
    },
    removeItem: (name: string) => {
      f.values.delete(name);
    },
  };
  const storage = createOwnedSessionStorage(createWebSessionBackend(() => web));
  await assert.rejects(
    storage.clearDeletedOwner(key, "a", () => true),
    /cannot coordinate/,
  );
  assert.equal(JSON.parse(f.values.get(key)!).user.id, "a");
});

test("deleted-owner feedback survives root-provider remount and is cleared when B signs in", async () => {
  const f = fixture();
  const sdk = f.client();
  const auth = createAccountAuthAdapter(sdk.auth, f.storage, key);
  const oldProvider = getAppAccountController(auth, {
    redirectTo: "kinevaulttrack://auth/callback",
  });
  try {
    oldProvider.start();
    await tick();
    assert.equal(await oldProvider.deleteAccount("a", async () => null), true);
    oldProvider.stop();
    const remounted = getAppAccountController(auth, {
      redirectTo: "kinevaulttrack://auth/callback",
    });
    remounted.start();
    await tick();
    assert.equal(remounted.getSnapshot().user, null);
    assert.equal(remounted.getSnapshot().notice, "Your KineVault account has been deleted.");
    await sdk.auth.signInWithPassword({ email: "b@example.com", password: "password" });
    assert.equal(remounted.getSnapshot().user?.id, "b");
    assert.equal(remounted.getSnapshot().notice, null);
    remounted.stop();
  } finally {
    oldProvider.stop();
    await sdk.auth.dispose();
  }
});
