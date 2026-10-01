import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type PropsWithChildren,
} from "react";
import {
  createProfilePersistence,
  type ProfileSnapshot,
} from "./persistence";
import type { ProfileDocument } from "./model";

export { profileStorageKey } from "./persistence";
type ProfileContextValue = ProfileSnapshot & {
  retryLoad: () => void;
  save: (document: ProfileDocument) => Promise<boolean>;
  reset: () => Promise<void>;
};
const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: PropsWithChildren) {
  const [profile] = useState(() => createProfilePersistence(AsyncStorage));
  const snapshot = useSyncExternalStore(
    profile.subscribe, profile.getSnapshot, profile.getSnapshot,
  );
  useEffect(() => {
    profile.start();
    return profile.stop;
  }, [profile]);
  return (
    <ProfileContext.Provider value={{
      ...snapshot,
      save: profile.save,
      reset: profile.reset,
      retryLoad: profile.retryLoad,
    }}>
      {children}
    </ProfileContext.Provider>
  );
}
export function useProfile() {
  const value = useContext(ProfileContext);
  if (!value) throw new Error("useProfile must be used inside ProfileProvider");
  return value;
}
