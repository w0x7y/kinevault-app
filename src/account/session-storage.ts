import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { createSecureSessionStorage } from "./secure-storage";

const encrypted = createSecureSessionStorage({
  getItem: key => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: key => SecureStore.deleteItemAsync(key),
});

/** Auth tokens use encrypted device storage, separate from tracking documents. */
export const sessionStorage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS !== "web") return encrypted.getItem(key);
    return typeof window === "undefined" ? null : window.localStorage.getItem(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS !== "web") { await encrypted.setItem(key, value); return; }
    if (typeof window !== "undefined") window.localStorage.setItem(key, value);
  },
  async removeItem(key: string): Promise<void> {
    if (Platform.OS !== "web") { await encrypted.removeItem(key); return; }
    if (typeof window !== "undefined") window.localStorage.removeItem(key);
  },
};
