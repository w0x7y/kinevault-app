import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Answers } from "./answers";
import { createFocusedProfileEdit } from "./focused-editing";
import { useProfilePersistence } from "./provider";
import type { ProfileEditSection } from "./section-editing";

export function useFocusedProfileEdit(
  options: {
    initial?: { section: ProfileEditSection; answers: Answers };
    close?: () => void;
  } = {},
) {
  const profile = useProfilePersistence();
  const close = useRef(options.close);
  close.current = options.close;
  const [edit] = useState(() =>
    createFocusedProfileEdit(profile, {
      initial: options.initial,
      onClose: () => close.current?.(),
    }),
  );
  const snapshot = useSyncExternalStore(edit.subscribe, edit.getSnapshot, edit.getSnapshot);
  useEffect(() => {
    edit.start();
    return edit.stop;
  }, [edit]);
  return { edit, ...snapshot };
}
