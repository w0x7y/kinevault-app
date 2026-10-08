import { useAccountStorage } from "../account/storage-context";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type PropsWithChildren,
} from "react";
import { createProfilePersistence, type ProfileSnapshot } from "./persistence";
import type { ProfileDocument } from "./model";
import type { SaveWeightInput } from "./weight-model";

type ProfileContextValue = ProfileSnapshot & {
  retryLoad: () => void;
  save: (document: ProfileDocument) => Promise<boolean>;
  reset: () => Promise<void>;
  saveWeight: (input: SaveWeightInput) => Promise<boolean>;
  removeWeight: (date: string) => Promise<boolean>;
};
const ProfileContext = createContext<ProfileContextValue | null>(null);
const ProfilePersistenceContext = createContext<ReturnType<typeof createProfilePersistence> | null>(
  null,
);

export function ProfileProvider({ children }: PropsWithChildren) {
  const storage = useAccountStorage();
  const [profile] = useState(() => createProfilePersistence(storage));
  const snapshot = useSyncExternalStore(
    profile.subscribe,
    profile.getSnapshot,
    profile.getSnapshot,
  );
  useEffect(() => {
    profile.start();
    return profile.stop;
  }, [profile]);
  return (
    <ProfilePersistenceContext.Provider value={profile}>
      <ProfileContext.Provider
        value={{
          ...snapshot,
          save: profile.save,
          saveWeight: profile.saveWeight,
          removeWeight: profile.removeWeight,
          reset: profile.reset,
          retryLoad: profile.retryLoad,
        }}
      >
        {children}
      </ProfileContext.Provider>
    </ProfilePersistenceContext.Provider>
  );
}
export function useProfilePersistence() {
  const value = useContext(ProfilePersistenceContext);
  if (!value) throw new Error("useProfilePersistence must be used inside ProfileProvider");
  return value;
}
export function useProfile() {
  const value = useContext(ProfileContext);
  if (!value) throw new Error("useProfile must be used inside ProfileProvider");
  return value;
}
