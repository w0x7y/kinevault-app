import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { AppText } from "../components/ui";
import { DeleteButton } from "../components/delete-button";
import { FoodButton } from "../food/food-button";
import { Field, ErrorText } from "../onboarding/controls";
import type { PhotoSource, ProgressPhoto } from "./media-model";
import { validatePhotoDetails } from "./media-model";
import { useProfileMedia } from "./media-provider";
import { pickProfilePhoto } from "./media-picker";
import { PhotoImage } from "./photo-image";
import { ProfileDialog } from "./profile-controls";
export function PhotoEditor({
  photo,
  initialSource,
  today,
  close,
}: {
  photo?: ProgressPhoto;
  initialSource?: PhotoSource;
  today: string;
  close: () => void;
}) {
  const media = useProfileMedia();
  const [date, setDate] = useState(photo?.date ?? today),
    [note, setNote] = useState(photo?.note ?? "");
  const [source, setSource] = useState(initialSource),
    [picking, setPicking] = useState(false),
    [error, setError] = useState<string | null>(null);
  const draft = useRef(initialSource),
    pending = useRef(false),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (!pending.current && draft.current)
        media.files.releaseUri(draft.current.uri);
    };
  }, [media.files]);
  function release() {
    if (draft.current) media.files.releaseUri(draft.current.uri);
    draft.current = undefined;
  }
  async function pick(origin: "library" | "camera") {
    if (pending.current || media.saving) return;
    pending.current = true;
    setPicking(true);
    setError(null);
    try {
      const next = await pickProfilePhoto(origin, false);
      if (next) {
        if (!mounted.current) media.files.releaseUri(next.uri);
        else {
          release();
          draft.current = next;
          setSource(next);
        }
      }
    } catch {
      if (mounted.current) setError("Couldn't open your photo. Try again.");
    } finally {
      pending.current = false;
      if (mounted.current) setPicking(false);
      else release();
    }
  }
  async function save() {
    if (pending.current || media.saving) return;
    try {
      validatePhotoDetails(date, note);
    } catch {
      setError(
        "Enter a valid date as YYYY-MM-DD and a note of 2,000 characters or fewer.",
      );
      return;
    }
    if (!photo && !source) {
      setError("Choose a photo first.");
      return;
    }
    pending.current = true;
    setError(null);
    try {
      const saved = photo
        ? await media.updatePhoto({ id: photo.id, date, note, source })
        : source
          ? await media.addPhoto({ source, date, note })
          : false;
      if (saved && mounted.current) {
        release();
        close();
      }
    } finally {
      pending.current = false;
      if (!mounted.current) release();
    }
  }
  async function remove() {
    if (pending.current || media.saving || !photo) return false;
    pending.current = true;
    try {
      const saved = await media.removePhoto(photo.id);
      if (saved && mounted.current) {
        release();
        close();
      }
      return saved;
    } finally {
      pending.current = false;
      if (!mounted.current) release();
    }
  }
  const busy = media.saving || picking;
  const dismiss = () => {
    if (!pending.current) close();
  };
  return (
    <ProfileDialog
      title={photo ? "Edit progress photo" : "Add progress photo"}
      dismiss={dismiss}
    >
      {source ? (
        <Image
          source={{ uri: source.uri }}
          contentFit="contain"
          accessibilityLabel="Draft progress photo"
          style={{ height: 180, width: "100%" }}
        />
      ) : (
        photo && (
          <PhotoImage
            image={photo.image}
            contentFit="contain"
            accessibilityLabel={`Progress photo ${photo.date}`}
            style={{ height: 180, width: "100%" }}
          />
        )
      )}
      <Field
        label="Photo date (YYYY-MM-DD)"
        value={date}
        onChangeText={setDate}
        editable={!busy}
        maxLength={10}
        placeholder="YYYY-MM-DD"
      />
      <Field
        label="Photo note (optional)"
        value={note}
        onChangeText={setNote}
        editable={!busy}
        multiline
        maxLength={2000}
      />
      <FoodButton
        label="Replace from library"
        disabled={busy}
        onPress={() => void pick("library")}
      />
      {Platform.OS !== "web" && (
        <FoodButton
          label="Replace from camera"
          disabled={busy}
          onPress={() => void pick("camera")}
        />
      )}
      {(error || media.error) && (
        <ErrorText message={error || media.error || ""} />
      )}
      {busy && (
        <AppText accessibilityLiveRegion="polite">
          {picking ? "Opening photo picker…" : "Saving photo changes…"}
        </AppText>
      )}
      <FoodButton
        primary
        label={media.saving ? "Saving photo…" : "Save photo"}
        disabled={busy}
        onPress={() => void save()}
      />
      {photo && (
        <DeleteButton
          label="Remove photo"
          confirmAccessibilityLabel="Confirm remove photo"
          disabled={busy}
          onDelete={remove}
        />
      )}
      <FoodButton label="Cancel" disabled={busy} onPress={dismiss} />
    </ProfileDialog>
  );
}
