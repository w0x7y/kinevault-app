import { useEffect, useRef, useState } from "react";
import { Platform, View } from "react-native";
import { AppText, Panel } from "../components/ui";
import { FoodButton } from "../food/food-button";
import { ErrorText } from "../onboarding/controls";
import { spacing } from "../theme/tokens";
import { useProfileMedia } from "./media-provider";
import { pickProfilePhoto } from "./media-picker";
import type { PhotoSource, ProgressPhoto } from "./media-model";
import { PhotoImage } from "./photo-image";
import { SourceStatus } from "./profile-controls";
import { PhotoEditor } from "./photo-editor";
import { PhotoComparison } from "./photo-comparison";
export function ProgressPhotos({
  today,
  recent = false,
  openPhotos,
}: {
  today: string;
  recent?: boolean;
  openPhotos?: () => void;
}) {
  const media = useProfileMedia();
  const [editor, setEditor] = useState<{
    photo?: ProgressPhoto;
    source?: PhotoSource;
  } | null>(null);
  const [selected, setSelected] = useState<string[]>([]),
    [comparing, setComparing] = useState(false);
  const [picking, setPicking] = useState(false),
    [error, setError] = useState<string | null>(null);
  const pending = useRef(false),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function pick(origin: "library" | "camera") {
    if (pending.current || media.saving || media.state.kind !== "ready") return;
    pending.current = true;
    setPicking(true);
    setError(null);
    try {
      const source = await pickProfilePhoto(origin, false);
      if (source) {
        if (mounted.current) setEditor({ source });
        else media.files.releaseUri(source.uri);
      }
    } catch {
      if (mounted.current) setError("Couldn't open your photo. Try again.");
    } finally {
      pending.current = false;
      if (mounted.current) setPicking(false);
    }
  }
  const photos =
    media.state.kind === "ready"
      ? [...media.state.document.photos].sort(
          (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id),
        )
      : [];
  const visible = recent ? photos.slice(0, 2) : photos;
  const chosen = photos
    .filter((photo) => selected.includes(photo.id))
    .sort((a, b) => a.date.localeCompare(b.date));
  function toggle(id: string) {
    setSelected((current) => {
      const available = current.filter((value) =>
        photos.some((photo) => photo.id === value),
      );
      return available.includes(id)
        ? available.filter((value) => value !== id)
        : available.length < 2
          ? [...available, id]
          : available;
    });
  }
  return (
    <Panel testID={recent ? "profile-recent-photos" : "profile-photos"}>
      <AppText variant="heading" accessibilityRole="header">
        {recent ? "Recent photos" : "Photo journal"}
      </AppText>
      {media.state.kind !== "ready" ? (
        <SourceStatus
          name="profile media"
          kind={media.state.kind}
          retry={media.retryLoad}
        />
      ) : (
        <>
          {photos.length === 0 && (
            <AppText muted>Your photo journal starts here.</AppText>
          )}
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: spacing.layout,
            }}
          >
            {visible.map((photo, index) => (
              <View
                key={photo.id}
                testID={`progress-photo-${photo.id}`}
                style={{
                  flexGrow: 1,
                  flexBasis: "46%",
                  minWidth: 120,
                  gap: spacing.sm,
                }}
              >
                <PhotoImage
                  image={photo.image}
                  thumbnail
                  accessibilityLabel={`Progress photo ${photo.date}`}
                  style={{ width: "100%", height: 180, borderRadius: 14 }}
                />
                <AppText variant="label">{photo.date}</AppText>
                {photo.note !== "" && (
                  <AppText variant="caption" muted>
                    {photo.note}
                  </AppText>
                )}
                {!recent && (
                  <>
                    <FoodButton
                      label={
                        selected.includes(photo.id)
                          ? "Selected"
                          : "Select for comparison"
                      }
                      accessibilityLabel={`Select photo ${index + 1} from ${photo.date}`}
                      selected={selected.includes(photo.id)}
                      disabled={
                        !selected.includes(photo.id) && chosen.length === 2
                      }
                      onPress={() => toggle(photo.id)}
                    />
                    <FoodButton
                      label="Edit photo"
                      accessibilityLabel={`Edit photo ${index + 1} from ${photo.date}`}
                      disabled={media.saving}
                      onPress={() => setEditor({ photo })}
                    />
                  </>
                )}
              </View>
            ))}
          </View>
          {recent ? (
            <FoodButton label="View photos" onPress={() => openPhotos?.()} />
          ) : (
            <>
              <FoodButton
                primary
                label={picking ? "Opening photo picker…" : "Add from library"}
                disabled={picking || media.saving}
                onPress={() => void pick("library")}
              />
              {Platform.OS !== "web" && (
                <FoodButton
                  label="Add from camera"
                  disabled={picking || media.saving}
                  onPress={() => void pick("camera")}
                />
              )}
              <AppText variant="caption" muted>
                Select exactly two photos to compare. {chosen.length} selected.
              </AppText>
              <FoodButton
                label="Compare selected photos"
                disabled={chosen.length !== 2 || media.saving}
                onPress={() => setComparing(true)}
              />
              {error && <ErrorText message={error} />}
            </>
          )}
          <AppText variant="caption" muted>
            Optional · Saved on this device
          </AppText>
        </>
      )}
      {editor && (
        <PhotoEditor
          photo={editor.photo}
          initialSource={editor.source}
          today={today}
          close={() => setEditor(null)}
        />
      )}
      {comparing && chosen.length === 2 && (
        <PhotoComparison
          photos={[chosen[0], chosen[1]]}
          close={() => setComparing(false)}
        />
      )}
    </Panel>
  );
}
