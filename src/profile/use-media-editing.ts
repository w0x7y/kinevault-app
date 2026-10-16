import { useRef } from "react";
import { useDocumentEdit } from "../persistence/use-document-edit";
import { createMediaEditing } from "./media-editing";
import { pickProfilePhoto } from "./media-picker";
import { useProfileMedia, useProfileMediaStore } from "./media-provider";

export function useMediaEditing(mode: "avatar" | "photos", today = "") {
  const media = useProfileMediaStore();
  const { files } = useProfileMedia();
  const date = useRef(today);
  date.current = today;
  const { edit, ...snapshot } = useDocumentEdit(() =>
    createMediaEditing({
      mode,
      media,
      files,
      pick: pickProfilePhoto,
      today: () => date.current,
    }),
  );
  return { ...snapshot, editing: edit };
}
