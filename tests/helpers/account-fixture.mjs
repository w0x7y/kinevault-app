export const fixtureUserId = "11111111-1111-4111-8111-111111111111";
export const fixtureAuthKey = "kinevault-track.auth.v1";
export const fixtureEmail = "track-fixture@example.com";
export const fixturePassword = "fixture-password-123";

function sessionFor(userId = fixtureUserId, email = fixtureEmail) {
  const expiresAt = 4102444800;
  const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({
    sub: userId, role: "authenticated", aud: "authenticated", exp: expiresAt,
    iat: 1700000000, iss: "https://kkywpvkckxniriatelta.supabase.co/auth/v1",
  })}.browser-fixture-signature`;
  return {
    access_token: token, refresh_token: "browser-fixture-refresh-token",
    expires_at: expiresAt, expires_in: expiresAt - Math.floor(Date.now() / 1000), token_type: "bearer",
    user: {
      id: userId, aud: "authenticated", role: "authenticated", email,
      email_confirmed_at: "2026-10-01T00:00:00Z", created_at: "2026-10-01T00:00:00Z",
      app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {},
      identities: [], is_anonymous: false,
    },
  };
}

/** Test-only HTTP fixtures. The real SDK still restores and creates sessions. */
export async function installAccountFixture(context, { signedIn = true, signupConfirmation = false } = {}) {
  const session = sessionFor();
  const state = { session, signedIn, signupConfirmation, loginError: null, recoveryError: null, cloudError: false, documents: new Map(), requests: [] };
  let documentReadGate = null;
  state.deferDocumentReads = () => {
    let release, started, completed;
    const gate = new Promise(resolve => { release = resolve; });
    const startedPromise = new Promise(resolve => { started = resolve; });
    const completedPromise = new Promise(resolve => { completed = resolve; });
    documentReadGate = { gate, started, completed };
    return { started: startedPromise, completed: completedPromise, release };
  };
  const json = (route, value, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(value) });
  await context.route("https://kkywpvkckxniriatelta.supabase.co/**", async route => {
    const request = route.request(), url = new URL(request.url());
    const body = request.postDataJSON();
    state.requests.push({ path: url.pathname, method: request.method(), body });
    if (url.pathname === "/auth/v1/token") {
      if (state.loginError) return json(route, { code: "invalid_credentials", message: state.loginError }, 400);
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
      return state.recoveryError ? json(route, { code: "over_email_send_rate_limit", message: state.recoveryError }, 429) : json(route, {});
    }
    if (url.pathname === "/auth/v1/logout") { state.signedIn = false; return json(route, {}); }
    if (url.pathname === "/auth/v1/verify") { state.signedIn = true; return json(route, state.session); }
    if (url.pathname === "/rest/v1/subscriptions") return json(route, { user_id: fixtureUserId, plan: "free", status: "active" });
    if (url.pathname === "/rest/v1/profiles") return json(route, { user_id: fixtureUserId, display_name: "Browser fixture" });
    if (url.pathname === "/rest/v1/roles") return json(route, { user_id: fixtureUserId, role: "user" });
    if (url.pathname === "/rest/v1/track_documents") {
      const delay = documentReadGate;
      if (delay) { delay.started(); await delay.gate; documentReadGate = null; }
      try {
        if (state.cloudError) return await json(route, { message: "Fixture cloud unavailable" }, 503);
        return await json(route, [...state.documents.values()]);
      } finally { delay?.completed(); }
    }
    if (url.pathname === "/rest/v1/rpc/save_track_document") {
      if (state.cloudError) return json(route, { message: "Fixture cloud unavailable" }, 503);
      if (body.p_user_id !== fixtureUserId) return json(route, { code: "42501", message: "Account changed" }, 403);
      try { if (body.p_payload !== null) JSON.parse(body.p_payload); }
      catch { return json(route, { code: "22P02", message: "Invalid JSON payload" }, 400); }
      const previous = state.documents.get(body.p_document_key);
      if ((previous?.revision ?? 0) !== body.p_expected_revision) return json(route, []);
      const saved = { user_id: fixtureUserId, document_key: body.p_document_key, payload: body.p_payload,
        revision: (previous?.revision ?? 0) + 1, updated_at: new Date().toISOString() };
      state.documents.set(saved.document_key, saved);
      return json(route, [saved]);
    }
    return json(route, { message: `Unexpected fixture request: ${url.pathname}` }, 404);
  });
  await context.addInitScript(({ authKey, signedIn, session, userId }) => {
    const firstLoad = !sessionStorage.getItem("account-fixture-seeded");
    if (firstLoad) {
      if (signedIn) localStorage.setItem(authKey, JSON.stringify(session));
      sessionStorage.setItem("account-fixture-seeded", "1");
    }
    const keys = new Set(["kinevault-track.profile.v1", "kinevault-track.exercise.v1", "kinevault-track.food-log.v1",
      "kinevault-track.custom-foods.v1", "kinevault-track.water-log.v1", "kinevault-track.water-goal.v1"]);
    const owner = () => {
      try { return JSON.parse(localStorage.getItem(authKey) || "null")?.user?.id ?? null; }
      catch { return null; }
    };
    const scoped = key => `kinevault-track.account.${encodeURIComponent(owner() ?? userId)}.${key}`;
    // Older domain fixtures seed legacy guest documents. Copy those fixtures
    // into the account cache before providers restore their domain state.
    if (firstLoad && signedIn) {
      for (const key of keys) {
        try {
          const payload = localStorage[key] ?? null;
          if (payload !== null) localStorage.setItem(scoped(key), JSON.stringify({
            version: 1, payload, revision: 0, dirty: true, sequence: 1,
          }));
        } catch { /* Domain fixtures may deliberately fail a local read/write. */ }
      }
    }
    window.accountFixture = {
      get domainReady() {
        return Boolean(document.querySelector('[data-testid="home-water"], [data-testid="exercise-search-actions"], [data-testid="profile-section"]'));
      },
      getItem(key) {
        if (!owner()) return localStorage.getItem(key);
        if (!keys.has(key)) return localStorage.getItem(key.startsWith("kinevault-track.profile-media.") ? scoped(key) : key);
        const raw = localStorage.getItem(scoped(key));
        return raw === null ? null : JSON.parse(raw).payload;
      },
      setItem(key, payload) {
        if (owner() && key.startsWith("kinevault-track.profile-media.")) return localStorage.setItem(scoped(key), payload);
        if (!owner() || !keys.has(key)) return localStorage.setItem(key, payload);
        const raw = localStorage.getItem(scoped(key));
        const previous = raw === null ? null : JSON.parse(raw);
        localStorage.setItem(scoped(key), JSON.stringify({ version: 1, payload, revision: previous?.revision ?? 0,
          dirty: true, sequence: (previous?.sequence ?? 0) + 1 }));
      },
      removeItem(key) {
        if (owner() && key.startsWith("kinevault-track.profile-media.")) return localStorage.removeItem(scoped(key));
        if (!owner() || !keys.has(key)) return localStorage.removeItem(key);
        this.setItem(key, null);
      },
    };
  }, { authKey: fixtureAuthKey, signedIn, session, userId: fixtureUserId });
  return state;
}

export async function signInFixture(page) {
  await page.getByRole("tab", { name: "Log in", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill(fixtureEmail);
  await page.getByLabel("Password", { exact: true }).fill(fixturePassword);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
}
