import { ButtonRow, AppButton } from "../components/button";
import { Image } from "expo-image";
import { Platform } from "react-native";
import { AppText } from "../components/ui";
import { DeleteButton } from "../components/delete-button";
import { InlineMessage } from "../components/inline-message";
import { TextField } from "../components/text-field";
import type { MediaEditing, MediaEditSnapshot } from "./media-editing";
import { PhotoImage } from "./photo-image";
import { radius } from "../theme/tokens";
const preview = {
  height: 220,
  width: "100%",
  borderRadius: radius.control + 4,
  backgroundColor: "rgba(127, 127, 127, 0.12)",
} as const;
/** The body of the progress photo sheet, for one attempt. */
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
    <>
      {source ? (
        <Image
          source={{ uri: source.uri }}
          contentFit="contain"
          accessibilityLabel="Draft progress photo"
          style={preview}
        />
      ) : (
        photo && (
          <PhotoImage
            image={photo.image}
            contentFit="contain"
            accessibilityLabel={`Progress photo ${photo.date}`}
            style={preview}
          />
        )
      )}
      <TextField
        size="large"
        label="Photo date (YYYY-MM-DD)"
        value={date}
        onChange={(date) => {
          editing.change({ date });
        }}
        disabled={disabled}
        maxLength={10}
        placeholder="YYYY-MM-DD"
      />
      <TextField
        size="large"
        label="Photo note (optional)"
        value={note}
        onChange={(note) => {
          editing.change({ note });
        }}
        disabled={disabled}
        kind="multiline"
        maxLength={2000}
      />
      <AppButton
        icon="images"
        label="Replace from library"
        disabled={disabled}
        onPress={() => void pick("library")}
      />
      {Platform.OS !== "web" && (
        <AppButton
          icon="camera"
          label="Replace from camera"
          disabled={disabled}
          onPress={() => void pick("camera")}
        />
      )}
      {error && <InlineMessage>{error}</InlineMessage>}
      {busy && (
        <AppText variant="caption" muted accessibilityLiveRegion="polite">
          {picking ? "Opening photo picker…" : "Saving photo changes…"}
        </AppText>
      )}
      <ButtonRow>
        <AppButton label="Cancel" disabled={busy} onPress={dismiss} fill />
        <AppButton
          fill
          tone="primary"
          label={busy && !picking ? "Saving photo…" : "Save photo"}
          disabled={disabled}
          onPress={() => void editing.save()}
        />
      </ButtonRow>
      {photo && (
        <DeleteButton
          icon="trash-can"
          label="Remove photo"
          confirmAccessibilityLabel="Confirm remove photo"
          disabled={disabled}
          onDelete={editing.remove}
        />
      )}
    </>
  );
}
