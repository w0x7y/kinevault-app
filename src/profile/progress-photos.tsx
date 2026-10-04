import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, View } from "react-native";
import { Icon } from "../components/icon";
import { useTheme } from "../theme/provider";
import { parseDay } from "../calendar/dates";
import { JournalAction, JournalHeading, JournalText } from "./journal-ui";
import { FoodButton } from "../food/food-button";
import { ErrorText } from "../onboarding/controls";
import { useProfileMedia } from "./media-provider";
import { pickProfilePhoto } from "./media-picker";
import type { PhotoSource, ProgressPhoto } from "./media-model";
import { PhotoImage } from "./photo-image";
import { ProfileDialog, SourceStatus } from "./profile-controls";
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
  const { colors } = useTheme();
  const [selecting, setSelecting] = useState(false),
    [sources, setSources] = useState(false);
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
  const visible = recent ? photos.slice(0, 2).reverse() : photos;
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
  function add() {
    if (Platform.OS === "web") void pick("library");
    else setSources(true);
  }
  const unavailable = picking || media.saving || media.state.kind !== "ready";
  const dateLabel = (date: string) =>
    parseDay(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  function photoWell(photo?: ProgressPhoto, journal = false) {
    return photo ? (
      <PhotoImage
        image={photo.image}
        thumbnail
        accessibilityLabel={`Progress photo ${photo.date}`}
        style={{
          width: "100%",
          aspectRatio: journal ? 16 / 9 : 1,
          borderRadius: 12,
        }}
      />
    ) : (
      <View
        style={{
          width: "100%",
          aspectRatio: journal ? 16 / 9 : 1,
          borderRadius: 12,
          backgroundColor: colors.secondary,
          justifyContent: "center",
          alignItems: "center",
          gap: 9,
        }}
      >
        <Icon
          name="image"
          size={journal ? 22 : 19}
          color={colors.mutedForeground}
        />
        {journal && (
          <JournalText size={9} muted>
            Progress photo
          </JournalText>
        )}
      </View>
    );
  }
  return (
    <View
      testID={recent ? "profile-recent-photos" : "profile-photos"}
      style={{ paddingVertical: 10, paddingHorizontal: 3 }}
    >
      <JournalHeading
        title={recent ? "Progress photos" : "Photo journal"}
        style={{ marginBottom: recent ? 2 : 0 }}
      >
        <JournalAction
          label={
            recent ? "Compare" : selecting ? "Compare selected" : "Compare two"
          }
          accessibilityLabel={
            recent
              ? "View photos"
              : selecting
                ? "Compare selected photos"
                : "Choose photos to compare"
          }
          disabled={
            !recent && selecting && (chosen.length !== 2 || media.saving)
          }
          onPress={() => {
            if (recent) openPhotos?.();
            else if (selecting) setComparing(true);
            else setSelecting(true);
          }}
        />
      </JournalHeading>
      {media.state.kind !== "ready" ? (
        <SourceStatus
          name="profile media"
          kind={media.state.kind}
          retry={media.retryLoad}
        />
      ) : (
        <>
          {recent ? (
            <View
              style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}
            >
              {[0, 1].map((index) => (
                <Pressable
                  key={index}
                  accessibilityRole="button"
                  accessibilityLabel={
                    visible[index]
                      ? `View progress photo ${visible[index].date}`
                      : `View photo journal ${index + 1}`
                  }
                  onPress={() => openPhotos?.()}
                  style={{ flex: 1 }}
                >
                  {photoWell(visible[index])}
                  {visible[index] && (
                    <JournalText size={9} style={{ marginTop: 6 }}>
                      {dateLabel(visible[index].date)}
                    </JournalText>
                  )}
                </Pressable>
              ))}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add from library"
                disabled={unavailable}
                onPress={add}
                style={{
                  width: 62,
                  height: 62,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderStyle: "dashed",
                  borderColor: colors.border,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5,
                  opacity: unavailable ? 0.5 : 1,
                }}
              >
                <Icon name="plus" size={14} color={colors.primary} />
                <JournalText size={9} style={{ color: colors.primary }}>
                  Add
                </JournalText>
              </Pressable>
            </View>
          ) : (
            <>
              {photos.length === 0 && (
                <View style={{ marginTop: 4, marginBottom: 15 }}>
                  {photoWell(undefined, true)}
                  <JournalText size={10} muted style={{ marginTop: 7 }}>
                    Your photo journal starts here.
                  </JournalText>
                </View>
              )}
              {visible.map((photo, index) => {
                const date = parseDay(photo.date),
                  noteLines = photo.note.split("\n"),
                  checked = selected.includes(photo.id);
                return (
                  <View
                    key={photo.id}
                    testID={`progress-photo-${photo.id}`}
                    style={{
                      flexDirection: "row",
                      gap: 12,
                      marginTop: 4,
                      marginBottom: 15,
                    }}
                  >
                    <View
                      style={{ width: 48, alignItems: "center", paddingTop: 8 }}
                    >
                      <JournalText size={9} muted>
                        {date.toLocaleDateString("en-US", { month: "short" })}
                      </JournalText>
                      <JournalText size={21} variant="heading">
                        {date.getDate()}
                      </JournalText>
                      <JournalText size={9} muted>
                        {date.getFullYear()}
                      </JournalText>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${selecting ? "Select" : "Edit"} photo ${index + 1} from ${photo.date}`}
                        accessibilityState={{
                          selected: checked,
                          disabled:
                            media.saving ||
                            (selecting && !checked && chosen.length === 2),
                        }}
                        aria-pressed={selecting ? checked : undefined}
                        disabled={
                          media.saving ||
                          (selecting && !checked && chosen.length === 2)
                        }
                        onPress={() =>
                          selecting ? toggle(photo.id) : setEditor({ photo })
                        }
                      >
                        {photoWell(photo, true)}
                        {selecting && (
                          <View
                            style={{
                              position: "absolute",
                              right: 10,
                              top: 10,
                              width: 28,
                              height: 28,
                              borderRadius: 14,
                              borderWidth: 1,
                              borderColor: colors.primary,
                              backgroundColor: checked
                                ? colors.primary
                                : colors.card,
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Icon
                              name={checked ? "check" : "plus"}
                              size={12}
                              color={
                                checked
                                  ? colors.primaryForeground
                                  : colors.primary
                              }
                            />
                          </View>
                        )}
                      </Pressable>
                      {selecting && (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Edit photo ${index + 1} from ${photo.date}`}
                          disabled={media.saving}
                          onPress={() => setEditor({ photo })}
                          style={{
                            position: "absolute",
                            left: 0,
                            top: 0,
                            width: 44,
                            height: 44,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <View
                            style={{
                              padding: 6,
                              borderRadius: 7,
                              backgroundColor: colors.card,
                            }}
                          >
                            <Icon name="pen" size={12} color={colors.primary} />
                          </View>
                        </Pressable>
                      )}
                      {photo.note !== "" && (
                        <>
                          <JournalText size={10} style={{ marginTop: 7 }}>
                            {noteLines[0]}
                          </JournalText>
                          {noteLines.length > 1 && (
                            <JournalText
                              size={9}
                              muted
                              style={{ marginTop: 3 }}
                            >
                              {noteLines.slice(1).join("\n")}
                            </JournalText>
                          )}
                        </>
                      )}
                    </View>
                  </View>
                );
              })}
              {selecting && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <JournalText size={10} muted>
                    Select exactly two photos to compare. {chosen.length}{" "}
                    selected.
                  </JournalText>
                  <JournalAction
                    label="Cancel"
                    accessibilityLabel="Cancel photo selection"
                    onPress={() => {
                      setSelecting(false);
                      setSelected([]);
                    }}
                  />
                </View>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add from library"
                disabled={unavailable}
                onPress={add}
                style={{
                  minHeight: 44,
                  marginVertical: -1,
                  borderRadius: 10,
                  backgroundColor: colors.secondary,
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  gap: 8,
                  opacity: unavailable ? 0.5 : 1,
                }}
              >
                <Icon name="plus" size={11} color={colors.primary} />
                <JournalText size={11} style={{ color: colors.primary }}>
                  {picking ? "Opening photo picker…" : "Add progress photo"}
                </JournalText>
              </Pressable>
              <JournalText
                size={9}
                muted
                style={{ textAlign: "center", marginTop: 9 }}
              >
                Optional · Stored on this device
              </JournalText>
            </>
          )}
          {error && <ErrorText message={error} />}
        </>
      )}
      {sources && (
        <ProfileDialog
          title="Add progress photo"
          dismiss={() => setSources(false)}
        >
          <FoodButton
            label="Add from library"
            onPress={() => {
              setSources(false);
              void pick("library");
            }}
          />
          <FoodButton
            label="Add from camera"
            onPress={() => {
              setSources(false);
              void pick("camera");
            }}
          />
        </ProfileDialog>
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
    </View>
  );
}
