import { ButtonRow, AppButton } from "../components/button";
import { Image } from "expo-image";
import { Platform } from "react-native";
import { AppText } from "../components/ui";
import { DeleteButton } from "../components/delete-button";
import { Field, ErrorText } from "../onboarding/controls";
import type { MediaEditing, MediaEditSnapshot } from "./media-editing";
import { PhotoImage } from "./photo-image";
import { ProfileDialog } from "./profile-controls";
export function PhotoEditor({
  editing,
  snapshot,
}: {
  editing: MediaEditing;
  snapshot: MediaEditSnapshot;
}) {
  const { attempt, phase, error, busy, ready } = snapshot;
  if (attempt.kind !== "photo") return null;
  const { photo, source, date, note } = attempt;
  const picking = phase === "picking";
  const disabled = busy || !ready;
  const pick = editing.pick;
  const dismiss = () => {
    editing.cancel();
  };
  return (
    <ProfileDialog title={photo ? "Edit progress photo" : "Add progress photo"} dismiss={dismiss}>
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
        onChangeText={(date) => {
          editing.change({ date });
        }}
        editable={!disabled}
        maxLength={10}
        placeholder="YYYY-MM-DD"
      />
      <Field
        label="Photo note (optional)"
        value={note}
        onChangeText={(note) => {
          editing.change({ note });
        }}
        editable={!disabled}
        multiline
        maxLength={2000}
      />
      <AppButton
        label="Replace from library"
        disabled={disabled}
        onPress={() => void pick("library")}
      />
      {Platform.OS !== "web" && (
        <AppButton
          label="Replace from camera"
          disabled={disabled}
          onPress={() => void pick("camera")}
        />
      )}
      {error && <ErrorText message={error} />}
      {busy && (
        <AppText accessibilityLiveRegion="polite">
          {picking ? "Opening photo picker…" : "Saving photo changes…"}
        </AppText>
      )}
      <ButtonRow>
        <AppButton label="Cancel" disabled={busy} onPress={dismiss} fill />
        <AppButton
          fill
          primary
          label={busy && !picking ? "Saving photo…" : "Save photo"}
          disabled={disabled}
          onPress={() => void editing.save()}
        />
      </ButtonRow>
      {photo && (
        <DeleteButton
          label="Remove photo"
          confirmAccessibilityLabel="Confirm remove photo"
          disabled={disabled}
          onDelete={editing.remove}
        />
      )}
    </ProfileDialog>
  );
}
