import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createMediaEditing } from "./media-editing";
import { pickProfilePhoto } from "./media-picker";
import { useProfileMedia, useProfileMediaStore } from "./media-provider";

export function useMediaEditing(mode: "avatar" | "photos", today = "") {
  const media = useProfileMediaStore();
  const { files } = useProfileMedia();
  const date = useRef(today);
  date.current = today;
  const [editing] = useState(() =>
    createMediaEditing({
      mode,
      media,
      files,
      pick: pickProfilePhoto,
      today: () => date.current,
    }),
  );
  const snapshot = useSyncExternalStore(
    editing.subscribe,
    editing.getSnapshot,
    editing.getSnapshot,
  );
  useEffect(() => {
    editing.start();
    return editing.stop;
  }, [editing]);
  return { ...snapshot, editing };
}
