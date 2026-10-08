import type { AccountAuthPort } from "./controller.ts";
import { persistedSession, type OwnedSessionStorage } from "./owned-session-storage.ts";

/** Server deletion already revoked sessions; clearing this device needs no HTTP logout. */
export function createAccountAuthAdapter(
  auth: Omit<AccountAuthPort, "clearDeletedSession">,
  storage: OwnedSessionStorage,
  storageKey: string,
): AccountAuthPort {
  return {
    getSession: () => auth.getSession(),
    onAuthStateChange(callback) {
      const stopStorage = storage.subscribeSession(storageKey, (raw) => {
        try {
          callback(raw === null ? "SIGNED_OUT" : "SIGNED_IN", persistedSession(raw));
        } catch {
          /* Unreadable storage is surfaced by the SDK's normal session read. */
        }
      });
      const { data } = auth.onAuthStateChange(callback);
      return {
        data: {
          subscription: {
            unsubscribe() {
              stopStorage();
              data.subscription.unsubscribe();
            },
          },
        },
      };
    },
    signInWithPassword: (credentials) => auth.signInWithPassword(credentials),
    signUp: (credentials) => auth.signUp(credentials),
    resetPasswordForEmail: (email, options) => auth.resetPasswordForEmail(email, options),
    updateUser: (attributes) => auth.updateUser(attributes),
    signOut: (options) => auth.signOut(options),
    exchangeCodeForSession: (code) => auth.exchangeCodeForSession(code),
    verifyOtp: (options) => auth.verifyOtp(options),
    setSession: (tokens) => auth.setSession(tokens),
    async clearDeletedSession(ownerId, isCurrent) {
      return {
        cleared: await storage.clearDeletedOwner(storageKey, ownerId, isCurrent),
        error: null,
      };
    },
  };
}
