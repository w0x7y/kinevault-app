import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState, useSyncExternalStore, type PropsWithChildren } from "react";
import { mediaFiles } from "./media-files";
import { createProfileMediaPersistence, type ProfileMediaSnapshot } from "./media-persistence";
import type { MediaFiles } from "./media-model";

type MediaStore = ReturnType<typeof createProfileMediaPersistence>;
type ProfileMediaContextValue = ProfileMediaSnapshot & Pick<MediaStore, "retryLoad" | "saveAvatar" | "addPhoto" | "updatePhoto" | "removePhoto"> & { files: MediaFiles };
const ProfileMediaContext = createContext<ProfileMediaContextValue | null>(null);

export function ProfileMediaProvider({ children }: PropsWithChildren) {
  const [store] = useState(() => {
    let sequence = 0;
    return createProfileMediaPersistence({
      storage: AsyncStorage,
      files: mediaFiles,
      createId: () => `${Date.now().toString(36)}-${++sequence}-${Math.random().toString(36).slice(2)}`,
    });
  });
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  useEffect(() => {
    store.start();
    return store.stop;
  }, [store]);
  return <ProfileMediaContext.Provider value={{
    ...snapshot,
    files: mediaFiles,
    retryLoad: store.retryLoad,
    saveAvatar: store.saveAvatar,
    addPhoto: store.addPhoto,
    updatePhoto: store.updatePhoto,
    removePhoto: store.removePhoto,
  }}>{children}</ProfileMediaContext.Provider>;
}

export function useProfileMedia() {
  const value = useContext(ProfileMediaContext);
  if (!value) throw new Error("useProfileMedia must be used inside ProfileMediaProvider");
  return value;
}
