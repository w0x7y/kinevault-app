import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { createSecureSessionStorage } from "./secure-storage";
import { createOwnedSessionStorage, createWebSessionBackend } from "./owned-session-storage";

const encrypted = createSecureSessionStorage({
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
});

/** Auth tokens use encrypted device storage, separate from tracking documents. */
const backend =
  Platform.OS === "web"
    ? createWebSessionBackend(
        () => (typeof window === "undefined" ? null : window.localStorage),
        typeof navigator !== "undefined" && navigator.locks
          ? (key, run) => navigator.locks.request(`kinevault-track.session-storage.${key}`, run)
          : undefined,
      )
    : encrypted;
export const sessionStorage = createOwnedSessionStorage(backend);
if (Platform.OS === "web" && typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.storageArea !== window.localStorage || event.key === null) return;
    sessionStorage.notifyExternal(event.key, window.localStorage.getItem(event.key));
  });
}
