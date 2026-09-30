import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { parseProfile, type ProfileDocument } from "./model";

export const profileStorageKey = "kinevault-track.profile.v1";
type ProfileState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; document: ProfileDocument };
type ProfileContextValue = {
  state: ProfileState;
  saving: boolean;
  error: string | null;
  retryLoad: () => void;
  save: (document: ProfileDocument) => Promise<boolean>;
  reset: () => Promise<void>;
};
const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<ProfileState>({ kind: "loading" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const busy = useRef(false);
  useEffect(() => {
    let active = true;
    setState({ kind: "loading" });
    AsyncStorage.getItem(profileStorageKey)
      .then((raw) => {
        const document = parseProfile(raw);
        if (active) setState({ kind: "ready", document });
      })
      .catch(() => {
        if (active) setState({ kind: "error" });
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  async function save(document: ProfileDocument) {
    if (state.kind !== "ready" || busy.current) return false;
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      const serialized = JSON.stringify(document);
      parseProfile(serialized);
      await AsyncStorage.setItem(profileStorageKey, serialized);
      setState({ kind: "ready", document });
      return true;
    } catch {
      setError("Couldn't save your answers. Try again.");
      return false;
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  async function reset() {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      await AsyncStorage.removeItem(profileStorageKey);
      setState({ kind: "ready", document: parseProfile(null) });
    } catch {
      setError("Couldn't reset your profile. Try again.");
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  return (
    <ProfileContext.Provider
      value={{
        state,
        saving,
        error,
        save,
        reset,
        retryLoad: () => setAttempt((value) => value + 1),
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}
export function useProfile() {
  const value = useContext(ProfileContext);
  if (!value) throw new Error("useProfile must be used inside ProfileProvider");
  return value;
}
