import { Image } from "expo-image";
import { Platform } from "react-native";
import { AppText } from "../components/ui";
import { DeleteButton } from "../components/delete-button";
import { FoodButton } from "../food/food-button";
import { Field, ErrorText } from "../onboarding/controls";
import type { MediaEditing, MediaEditSnapshot } from "./media-editing";
import { useProfileMedia } from "./media-provider";
import { PhotoImage } from "./photo-image";
import { ProfileDialog } from "./profile-controls";
export function PhotoEditor({ editing, snapshot }: {
  editing: MediaEditing;
  snapshot: MediaEditSnapshot;
}) {
  const media = useProfileMedia();
  const { attempt, phase, error } = snapshot;
  if (attempt.kind !== "photo") return null;
  const { photo, source, date, note } = attempt;
  const picking = phase === "picking";
  const busy = phase !== "idle" || media.saving;
  const pick = editing.pick;
  const dismiss = () => { editing.cancel(); };
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
        onChangeText={(date) => { editing.change({ date }); }}
        editable={!busy}
        maxLength={10}
        placeholder="YYYY-MM-DD"
      />
      <Field
        label="Photo note (optional)"
        value={note}
        onChangeText={(note) => { editing.change({ note }); }}
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
        onPress={() => void editing.save()}
      />
      {photo && (
        <DeleteButton
          label="Remove photo"
          confirmAccessibilityLabel="Confirm remove photo"
          disabled={busy}
          onDelete={editing.remove}
        />
      )}
      <FoodButton label="Cancel" disabled={busy} onPress={dismiss} />
    </ProfileDialog>
  );
}
