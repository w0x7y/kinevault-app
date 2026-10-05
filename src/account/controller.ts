import type { Session, User } from "@supabase/supabase-js";
import { parseAuthLink, sanitizedAuthPath } from "./auth-links.ts";

type AuthError = { message: string; code?: string; status?: number };
type Result = { error: AuthError | null };
type SessionResult = Result & { data: { session: Session | null } };
export type AccountAuthPort = {
  getSession: () => Promise<SessionResult>;
  onAuthStateChange: (callback: (event: string, session: Session | null) => void) => { data: { subscription: { unsubscribe: () => void } } };
  signInWithPassword: (credentials: { email: string; password: string }) => Promise<SessionResult>;
  signUp: (credentials: { email: string; password: string; options: { emailRedirectTo: string } }) => Promise<SessionResult>;
  resetPasswordForEmail: (email: string, options: { redirectTo: string }) => Promise<Result>;
  updateUser: (attributes: { password: string }) => Promise<Result>;
  signOut: (options: { scope: "local" }) => Promise<Result>;
  exchangeCodeForSession: (code: string) => Promise<SessionResult>;
  verifyOtp: (options: { token_hash: string; type: "email" | "recovery" }) => Promise<SessionResult>;
  setSession: (tokens: { access_token: string; refresh_token: string }) => Promise<SessionResult>;
};
export type AccountSnapshot = {
  loading: boolean;
  configured: boolean;
  session: Session | null;
  user: User | null;
  recovery: boolean;
  busy: boolean;
  error: string | null;
  notice: string | null;
  emailDelivery: { kind: "confirmation" | "password-reset"; email: string } | null;
};

function messageFor(error: AuthError): string {
  if (error.code === "invalid_credentials") return "The email or password is incorrect. Try again.";
  if (error.code === "email_not_confirmed") return "Confirm your email before logging in. Check your inbox.";
  if (error.code === "email_address_not_authorized") return "Email delivery isn't configured for this address yet. Contact KineVault support.";
  if (error.code === "weak_password" || error.code === "validation_failed") return "Check your email and use a password of at least 10 characters.";
  if (error.code === "over_email_send_rate_limit" || error.status === 429) return "Too many requests. Wait a little before trying again.";
  if (error.code === "otp_expired" || error.code === "flow_state_expired" || error.code === "flow_state_not_found")
    return "This email link has expired or already been used. Request a new one.";
  if (error.code === "bad_code_verifier") return "Open this email link on the device where you requested it, or return and log in after confirming your email.";
  return "Couldn't complete your account request. Check your connection and try again.";
}

export function createAccountController(auth: AccountAuthPort | null, options: { redirectTo: string }) {
  let snapshot: AccountSnapshot = { loading: Boolean(auth), configured: Boolean(auth), session: null, user: null, recovery: false, busy: false, error: null, notice: null, emailDelivery: null };
  const listeners = new Set<() => void>();
  let running = false;
  let generation = 0;
  let authRevision = 0;
  let identityRevision = 0;
  let recoveryRevision = 0;
  let unsubscribe: (() => void) | undefined;
  let pending = false;
  const completedLinks = new Set<string>();
  const pendingLinks = new Map<string, Promise<boolean>>();
  // Lives above account-owned screen remounts; credentials never leave memory.
  let callbackContext: { target: string; result: Promise<boolean> } | null = null;
  function callbackTarget(value: string, requireClean = false): string | null {
    try {
      const url = new URL(value);
      if (requireClean && (url.search || url.hash)) return null;
      url.search = ""; url.hash = "";
      return url.href;
    } catch { return null; }
  }
  function clearCallbackContext() { callbackContext = null; completedLinks.clear(); }
  function publish(patch: Partial<AccountSnapshot>) {
    snapshot = { ...snapshot, ...patch };
    listeners.forEach(listener => listener());
  }
  function publishSession(session: Session | null, recovery = snapshot.user?.id === session?.user.id && snapshot.recovery) {
    const changedIdentity = snapshot.user?.id !== session?.user.id;
    if (changedIdentity) identityRevision++;
    publish({ loading: false, session, user: session?.user ?? null, recovery: Boolean(session) && recovery,
      ...(changedIdentity ? { error: null, notice: null, emailDelivery: null } : {}) });
  }
  function clearFeedback() { publish({ error: null, notice: null, emailDelivery: null }); }
  function email(value: string): string | null {
    const trimmed = value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) || trimmed.length > 320) {
      publish({ error: "Enter a valid email address.", notice: null, emailDelivery: null }); return null;
    }
    return trimmed;
  }
  function password(value: string, creating: boolean): boolean {
    if (!value || (creating && value.length < 10) || value.length > 128) {
      publish({ error: creating ? "Use at least 10 characters and no more than 128 for your password." : "Enter your password, up to 128 characters.", notice: null, emailDelivery: null });
      return false;
    }
    return true;
  }
  async function run(work: (port: AccountAuthPort, current: () => boolean, revision: number, sameJourney: () => boolean) => Promise<boolean>): Promise<boolean> {
    if (!running || pending || snapshot.loading) return false;
    if (!auth) { publish({ error: "Account sign-in isn't configured yet. Your saved tracking stays on this device.", notice: null }); return false; }
    pending = true;
    const id = generation;
    const revision = authRevision;
    const identity = identityRevision;
    const recovery = recoveryRevision;
    const current = () => running && id === generation;
    const sameJourney = () => current() && identity === identityRevision && recovery === recoveryRevision;
    publish({ busy: true, error: null, notice: null, emailDelivery: null });
    try {
      if (!sameJourney()) return false;
      return await work(auth, current, revision, sameJourney);
    }
    catch { if (sameJourney()) publish({ error: "Couldn't complete your account request. Check your connection and try again." }); return false; }
    finally { if (current()) { pending = false; publish({ busy: false }); } }
  }
  function check(result: Result, current: () => boolean, errorCurrent = current): boolean {
    if (!current()) return false;
    if (result.error) { if (errorCurrent()) publish({ error: messageFor(result.error) }); return false; }
    return true;
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    start() {
      if (running) return;
      running = true;
      const id = ++generation;
      pending = false;
      publish({ loading: Boolean(auth), busy: false });
      if (!auth || !running || id !== generation) return;
      const revision = authRevision;
      const { data } = auth.onAuthStateChange((event, session) => {
        if (!running || id !== generation) return;
        if (event === "SIGNED_OUT") clearCallbackContext();
        else if (snapshot.user && snapshot.user.id !== session?.user.id) {
          completedLinks.clear();
          // A verified link may itself replace the account, remounting its
          // screen. Keep only the in-flight outcome until that screen consumes it.
          if (!pendingLinks.size) callbackContext = null;
        }
        authRevision++;
        if (event === "PASSWORD_RECOVERY") recoveryRevision++;
        publishSession(session, event === "PASSWORD_RECOVERY" ? true : event === "SIGNED_OUT" ? false : snapshot.user?.id === session?.user.id && snapshot.recovery);
      });
      if (!running || id !== generation) { data.subscription.unsubscribe(); return; }
      unsubscribe = () => data.subscription.unsubscribe();
      void auth.getSession().then(result => {
        if (!running || id !== generation || revision !== authRevision) return;
        if (result.error) publish({ loading: false, error: "Couldn't restore your account session. Try logging in again." });
        else publishSession(result.data.session);
      }).catch(() => {
        if (running && id === generation && revision === authRevision)
          publish({ loading: false, error: "Couldn't restore your account session. Try logging in again." });
      });
    },
    stop() { running = false; generation++; pending = false; unsubscribe?.(); unsubscribe = undefined; pendingLinks.clear(); clearCallbackContext(); },
    clearFeedback,
    async signIn(address: string, secret: string) {
      const normalized = email(address); if (!normalized || !password(secret, false)) return false;
      return run(async (port, current, revision, sameJourney) => {
        const result = await port.signInWithPassword({ email: normalized, password: secret });
        if (!check(result, current, sameJourney)) return false;
        if (!result.data.session) { if (sameJourney()) publish({ error: "Couldn't start your account session. Try logging in again." }); return false; }
        if (revision === authRevision) publishSession(result.data.session, false);
        else if (sameJourney() && snapshot.user?.id === result.data.session.user.id) publish({ recovery: false });
        return snapshot.user?.id === result.data.session.user.id;
      });
    },
    async signUp(address: string, secret: string) {
      const normalized = email(address); if (!normalized || !password(secret, true)) return false;
      return run(async (port, current, revision, sameJourney) => {
        const result = await port.signUp({ email: normalized, password: secret, options: { emailRedirectTo: options.redirectTo } });
        if (!check(result, current, sameJourney)) return false;
        if (!result.data.session) {
          if (!sameJourney()) return false;
          publish({ notice: "Check your email to confirm your account, then return here and log in.", emailDelivery: { kind: "confirmation", email: normalized } }); return false;
        }
        if (revision === authRevision) publishSession(result.data.session, false);
        return snapshot.user?.id === result.data.session.user.id;
      });
    },
    async requestPasswordReset(address: string) {
      const normalized = email(address); if (!normalized) return false;
      return run(async (port, _current, _revision, sameJourney) => {
        const redirect = new URL(options.redirectTo); redirect.searchParams.set("flow", "recovery");
        if (!check(await port.resetPasswordForEmail(normalized, { redirectTo: redirect.href }), sameJourney)) return false;
        publish({ notice: "If an account exists for this email, you'll receive a password reset link. Open it on this device.", emailDelivery: { kind: "password-reset", email: normalized } }); return true;
      });
    },
    async updatePassword(secret: string) {
      if (!password(secret, true)) return false;
      if (!snapshot.session || !snapshot.recovery) { publish({ error: "Open the password reset link from your email first." }); return false; }
      return run(async (port, _current, _revision, sameJourney) => {
        if (!check(await port.updateUser({ password: secret }), sameJourney)) return false;
        publish({ recovery: false, notice: "Your password has been updated." }); return true;
      });
    },
    async signOut() {
      return run(async (port, current, revision, sameJourney) => {
        if (!check(await port.signOut({ scope: "local" }), current, sameJourney)) return false;
        if (revision === authRevision || !snapshot.session) { clearCallbackContext(); publishSession(null, false); }
        return snapshot.session === null;
      });
    },
    resumeAuthLink(cleanUrl: string): Promise<boolean> | null {
      const target = callbackTarget(cleanUrl, true);
      return target && callbackContext?.target === target ? callbackContext.result : null;
    },
    acknowledgeAuthLink() { callbackContext = null; },
    completeAuthLink(url: string): Promise<boolean> {
      if (completedLinks.has(url)) return Promise.resolve(true);
      const existing = pendingLinks.get(url); if (existing) return existing;
      const parsed = parseAuthLink(url);
      if (parsed.kind === "invalid" || parsed.kind === "error") {
        if (sanitizedAuthPath(url)) callbackContext = { target: callbackTarget(url)!, result: Promise.resolve(false) };
        publish({ error: parsed.kind === "error" ? parsed.message : "This email link couldn't be verified. Request a new one and try again.", notice: null }); return Promise.resolve(false);
      }
      let resolve!: (success: boolean) => void;
      const result = new Promise<boolean>(done => { resolve = done; });
      pendingLinks.set(url, result);
      callbackContext = { target: callbackTarget(url)!, result };
      void run(async (port, current, revision, sameJourney) => {
        const response = parsed.kind === "code" ? await port.exchangeCodeForSession(parsed.code)
          : parsed.kind === "token-hash" ? await port.verifyOtp({ token_hash: parsed.tokenHash, type: parsed.type })
          : await port.setSession({ access_token: parsed.accessToken, refresh_token: parsed.refreshToken });
        if (!check(response, current, sameJourney) || !response.data.session) return false;
        if (revision === authRevision) publishSession(response.data.session, parsed.recovery);
        else if (snapshot.user?.id === response.data.session.user.id && parsed.recovery) publish({ recovery: true });
        if (snapshot.user?.id !== response.data.session.user.id) return false;
        completedLinks.add(url);
        if (completedLinks.size > 8) completedLinks.delete(completedLinks.values().next().value!);
        return true;
      }).then(resolve).finally(() => { if (pendingLinks.get(url) === result) pendingLinks.delete(url); });
      return result;
    },
  };
}
