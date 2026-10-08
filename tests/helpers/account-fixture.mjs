import { browserHistoryCodec } from "./browser-history-codec.mjs";

export const fixtureUserId = "11111111-1111-4111-8111-111111111111";
export const fixtureAuthKey = "kinevault-track.auth.v1";
export const fixtureEmail = "track-fixture@example.com";
export const fixturePassword = "fixture-password-123";

function sessionFor(userId = fixtureUserId, email = fixtureEmail) {
  const expiresAt = 4102444800;
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({
    sub: userId,
    role: "authenticated",
    aud: "authenticated",
    exp: expiresAt,
    iat: 1700000000,
    iss: "https://kkywpvkckxniriatelta.supabase.co/auth/v1",
  })}.browser-fixture-signature`;
  return {
    access_token: token,
    refresh_token: "browser-fixture-refresh-token",
    expires_at: expiresAt,
    expires_in: expiresAt - Math.floor(Date.now() / 1000),
    token_type: "bearer",
    user: {
      id: userId,
      aud: "authenticated",
      role: "authenticated",
      email,
      email_confirmed_at: "2026-10-01T00:00:00Z",
      created_at: "2026-10-01T00:00:00Z",
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: {},
      identities: [],
      is_anonymous: false,
    },
  };
}

/** Test-only HTTP fixtures. The real SDK still restores and creates sessions. */
export async function installAccountFixture(
  context,
  { signedIn = true, signupConfirmation = false } = {},
) {
  await context.addInitScript(await browserHistoryCodec());
  const session = sessionFor();
  const state = {
    session,
    signedIn,
    signupConfirmation,
    loginError: null,
    recoveryError: null,
    cloudError: false,
    documents: new Map(),
    partitions: new Map(),
    requests: [],
  };
  let documentReadGate = null;
  state.deferDocumentReads = () => {
    let release, started, completed;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const startedPromise = new Promise((resolve) => {
      started = resolve;
    });
    const completedPromise = new Promise((resolve) => {
      completed = resolve;
    });
    documentReadGate = { gate, started, completed };
    return { started: startedPromise, completed: completedPromise, release };
  };
  const json = (route, value, status = 200) =>
    route.fulfill({ status, contentType: "application/json", body: JSON.stringify(value) });
  await context.route("https://kkywpvkckxniriatelta.supabase.co/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    const body = request.postDataJSON();
    state.requests.push({ path: url.pathname, method: request.method(), body });
    if (url.pathname === "/auth/v1/token") {
      if (state.loginError)
        return json(route, { code: "invalid_credentials", message: state.loginError }, 400);
      state.signedIn = true;
      return json(route, state.session);
    }
    if (url.pathname === "/auth/v1/user") {
      if (request.method() === "PUT") return json(route, { user: state.session.user });
      return json(route, state.session.user);
    }
    if (url.pathname === "/auth/v1/signup") {
      if (state.signupConfirmation) return json(route, { user: state.session.user, session: null });
      state.signedIn = true;
      return json(route, state.session);
    }
    if (url.pathname === "/auth/v1/recover") {
      return state.recoveryError
        ? json(route, { code: "over_email_send_rate_limit", message: state.recoveryError }, 429)
        : json(route, {});
    }
    if (url.pathname === "/auth/v1/logout") {
      state.signedIn = false;
      return json(route, {});
    }
    if (url.pathname === "/auth/v1/verify") {
      state.signedIn = true;
      return json(route, state.session);
    }
    if (url.pathname === "/rest/v1/subscriptions")
      return json(route, { user_id: fixtureUserId, plan: "free", status: "active" });
    if (url.pathname === "/rest/v1/profiles")
      return json(route, { user_id: fixtureUserId, display_name: "Browser fixture" });
    if (url.pathname === "/rest/v1/roles")
      return json(route, { user_id: fixtureUserId, role: "user" });
    if (url.pathname === "/rest/v1/track_documents") {
      const delay = documentReadGate;
      if (delay) {
        delay.started();
        await delay.gate;
        documentReadGate = null;
      }
      try {
        if (state.cloudError)
          return await json(route, { message: "Fixture cloud unavailable" }, 503);
        const excluded =
          url.searchParams
            .get("document_key")
            ?.match(/^not\.in\.\((.*)\)$/)?.[1]
            ?.split(",") ?? [];
        return await json(
          route,
          [...state.documents.values()].filter((row) => !excluded.includes(row.document_key)),
        );
      } finally {
        delay?.completed();
      }
    }
    if (url.pathname === "/rest/v1/rpc/save_track_document") {
      if (state.cloudError) return json(route, { message: "Fixture cloud unavailable" }, 503);
      if (body.p_user_id !== fixtureUserId)
        return json(route, { code: "42501", message: "Account changed" }, 403);
      if (state.partitions.has(`${body.p_document_key}/manifest`))
        return json(route, { code: "55000", message: "Upgrade the app to sync this history" }, 400);
      try {
        if (body.p_payload !== null) JSON.parse(body.p_payload);
      } catch {
        return json(route, { code: "22P02", message: "Invalid JSON payload" }, 400);
      }
      const previous = state.documents.get(body.p_document_key);
      if ((previous?.revision ?? 0) !== body.p_expected_revision) return json(route, []);
      const saved = {
        user_id: fixtureUserId,
        document_key: body.p_document_key,
        payload: body.p_payload,
        revision: (previous?.revision ?? 0) + 1,
        updated_at: new Date().toISOString(),
      };
      state.documents.set(saved.document_key, saved);
      return json(route, [saved]);
    }
    if (url.pathname === "/rest/v1/rpc/list_track_partitioned_documents") {
      if (state.cloudError) return json(route, { message: "Fixture cloud unavailable" }, 503);
      if (body.p_user_id !== fixtureUserId) return json(route, []);
      return json(
        route,
        [...state.partitions.values()].filter(
          (row) =>
            row.part_key === "manifest" ||
            row.revision > (body.p_known_revisions[row.document_key] ?? 0),
        ),
      );
    }
    if (url.pathname === "/rest/v1/rpc/save_track_partitioned_document") {
      if (state.cloudError) return json(route, { message: "Fixture cloud unavailable" }, 503);
      if (body.p_user_id !== fixtureUserId)
        return json(route, { code: "42501", message: "Account changed" }, 403);
      const previous =
        state.partitions.get(`${body.p_document_key}/manifest`) ??
        state.documents.get(body.p_document_key);
      if ((previous?.revision ?? 0) !== body.p_expected_revision) return json(route, null);
      const saved = {
        revision: body.p_expected_revision + 1,
        updated_at: new Date().toISOString(),
      };
      const next = new Map(state.partitions);
      for (const [part_key, payload] of Object.entries(body.p_changes))
        next.set(`${body.p_document_key}/${part_key}`, {
          user_id: fixtureUserId,
          document_key: body.p_document_key,
          part_key,
          payload,
          ...saved,
        });
      for (const [id, row] of next)
        if (
          row.document_key === body.p_document_key &&
          row.part_key !== "manifest" &&
          !body.p_parts.includes(row.part_key)
        )
          next.delete(id);
      next.set(`${body.p_document_key}/manifest`, {
        user_id: fixtureUserId,
        document_key: body.p_document_key,
        part_key: "manifest",
        payload: JSON.stringify({ version: 2, deleted: body.p_deleted, parts: body.p_parts }),
        ...saved,
      });
      state.partitions = next;
      return json(route, saved);
    }
    return json(route, { message: `Unexpected fixture request: ${url.pathname}` }, 404);
  });
  await context.addInitScript(
    ({ authKey, signedIn, session, userId }) => {
      const firstLoad = !sessionStorage.getItem("account-fixture-seeded");
      if (firstLoad) {
        if (signedIn) localStorage.setItem(authKey, JSON.stringify(session));
        sessionStorage.setItem("account-fixture-seeded", "1");
      }
      const keys = new Set([
        "kinevault-track.profile.v1",
        "kinevault-track.exercise.v1",
        "kinevault-track.food-log.v1",
        "kinevault-track.custom-foods.v1",
        "kinevault-track.water-log.v1",
        "kinevault-track.water-goal.v1",
      ]);
      const owner = () => {
        try {
          return JSON.parse(localStorage.getItem(authKey) || "null")?.user?.id ?? null;
        } catch {
          return null;
        }
      };
      const scoped = (key) =>
        `kinevault-track.account.${encodeURIComponent(owner() ?? userId)}.${key}`;
      const history = (key) => window.historyFixtureCodec.isHistoryKey(key);
      const partsFor = (root) =>
        Object.fromEntries(
          Object.entries(root.refs).map(([part, ref]) => {
            const raw = localStorage.getItem(ref);
            if (raw === null) throw new Error(`Missing fixture history fragment ${part}`);
            return [part, raw];
          }),
        );
      const readPayload = (target, key) => {
        const raw = localStorage.getItem(target);
        if (raw === null) return null;
        let value;
        try {
          value = JSON.parse(raw);
        } catch {
          if (!owner()) return raw;
          throw new Error("Invalid account fixture envelope");
        }
        if (value.historyFormat === 2)
          return window.historyFixtureCodec.assembleHistory(key, partsFor(value), value.deleted);
        return owner() && keys.has(key) ? value.payload : raw;
      };
      // Older domain fixtures seed legacy guest documents. Copy those fixtures
      // into the account cache before providers restore their domain state.
      if (firstLoad && signedIn) {
        for (const key of keys) {
          try {
            const payload = localStorage[key] ?? null;
            if (payload !== null)
              localStorage.setItem(
                scoped(key),
                JSON.stringify({
                  version: 1,
                  payload,
                  revision: 0,
                  dirty: true,
                  sequence: 1,
                }),
              );
          } catch {
            /* Domain fixtures may deliberately fail a local read/write. */
          }
        }
      }
      window.accountFixture = {
        get domainReady() {
          return Boolean(
            document.querySelector(
              '[data-testid="home-water"], [data-testid="exercise-search-actions"], [data-testid="profile-section"]',
            ),
          );
        },
        getItem(key) {
          if (!owner()) return history(key) ? readPayload(key, key) : localStorage.getItem(key);
          if (!keys.has(key))
            return localStorage.getItem(
              key.startsWith("kinevault-track.profile-media.") ? scoped(key) : key,
            );
          return readPayload(scoped(key), key);
        },
        setItem(key, payload) {
          if (owner() && key.startsWith("kinevault-track.profile-media."))
            return localStorage.setItem(scoped(key), payload);
          if (!keys.has(key)) return localStorage.setItem(key, payload);
          const target = owner() ? scoped(key) : key;
          const raw = localStorage.getItem(target),
            root = raw === null ? null : JSON.parse(raw);
          const previous = root?.historyFormat === 2 ? root.envelope : root;
          const envelope = owner()
            ? {
                version: 1,
                revision: previous?.revision ?? 0,
                dirty: true,
                sequence: (previous?.sequence ?? 0) + 1,
              }
            : null;
          if (history(key)) {
            const oldRefs = Object.values(root?.refs ?? {});
            let parts;
            try {
              let prior = {};
              if (root?.historyFormat === 2) {
                try {
                  prior = partsFor(root);
                } catch {
                  /* Recover deliberately damaged fixtures. */
                }
              }
              parts = window.historyFixtureCodec.partitionHistory(key, payload, prior);
            } catch {
              // Invalid seeds intentionally bypass the production writer so
              // browser tests can exercise unreadable-data recovery.
              oldRefs.forEach((ref) => localStorage.removeItem(ref));
            }
            if (parts) {
              const refs = {};
              for (const [part, value] of Object.entries(parts)) {
                const ref = `${target}.partition.v2.${part}.fixture-${Math.random().toString(36).slice(2)}`;
                localStorage.setItem(ref, value);
                refs[part] = ref;
              }
              localStorage.setItem(
                target,
                JSON.stringify({
                  historyFormat: 2,
                  generation: (root?.generation ?? 0) + 1,
                  envelope,
                  deleted: payload === null,
                  refs,
                }),
              );
              oldRefs.forEach((ref) => localStorage.removeItem(ref));
              return;
            }
          }
          if (envelope)
            return localStorage.setItem(target, JSON.stringify({ ...envelope, payload }));
          if (payload === null) return localStorage.removeItem(target);
          return localStorage.setItem(target, payload);
        },
        removeItem(key) {
          if (owner() && key.startsWith("kinevault-track.profile-media."))
            return localStorage.removeItem(scoped(key));
          if (!keys.has(key)) return localStorage.removeItem(key);
          this.setItem(key, null);
        },
      };
    },
    { authKey: fixtureAuthKey, signedIn, session, userId: fixtureUserId },
  );
  return state;
}

export async function signInFixture(page) {
  await page.getByRole("tab", { name: "Log in", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill(fixtureEmail);
  await page.getByLabel("Password", { exact: true }).fill(fixturePassword);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
}
