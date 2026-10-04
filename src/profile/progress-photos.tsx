import { Fragment, useEffect, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, View } from "react-native";
import { Icon } from "../components/icon";
import { useTheme } from "../theme/provider";
import { parseDay } from "../calendar/dates";
import { JournalHeading, JournalText } from "./journal-ui";
import { FoodButton } from "../food/food-button";
import { ErrorText } from "../onboarding/controls";
import { useProfileMedia } from "./media-provider";
import { pickProfilePhoto } from "./media-picker";
import type { PhotoSource, ProgressPhoto } from "./media-model";
import { PhotoImage } from "./photo-image";
import { ProfileDialog, SourceStatus } from "./profile-controls";
import { PhotoEditor } from "./photo-editor";
import { progressPhotoTimeline } from "./progress-photo-order";

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
  const [sources, setSources] = useState(false);
  const [editor, setEditor] = useState<{
    photo?: ProgressPhoto;
    source?: PhotoSource;
  } | null>(null);
  const [picking, setPicking] = useState(false),
    [error, setError] = useState<string | null>(null);
  const [galleryWidth, setGalleryWidth] = useState(0);
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
  const { photos, first, latest } = progressPhotoTimeline(
    media.state.kind === "ready" ? media.state.document.photos : [],
  );
  const itemWidth = galleryWidth ? Math.min(360, galleryWidth * 0.84) : 240;
  function add() {
    if (Platform.OS === "web") void pick("library");
    else setSources(true);
  }
  const unavailable = picking || media.saving || media.state.kind !== "ready";
  const dateLabel = (date: string) =>
    parseDay(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  function photoWell(photo?: ProgressPhoto, journal = false) {
    const style = {
      width: "100%" as const,
      aspectRatio: journal ? 4 / 5 : 1,
      borderRadius: 12,
      backgroundColor: colors.secondary,
    };
    return photo ? (
      <PhotoImage
        image={photo.image}
        thumbnail={recent}
        contentFit="contain"
        accessibilityLabel={`Progress photo ${photo.date}`}
        style={style}
      />
    ) : (
      <View
        style={[
          style,
          { justifyContent: "center", alignItems: "center", gap: 9 },
        ]}
      >
        <Icon
          name="image"
          size={journal ? 22 : 19}
          color={colors.mutedForeground}
        />
        <JournalText size={9} muted style={{ textAlign: "center" }}>
          No saved photo
        </JournalText>
      </View>
    );
  }
  return (
    <View
      testID={recent ? "profile-recent-photos" : "profile-photos"}
      style={{ paddingVertical: 10, paddingHorizontal: 3, minWidth: 0 }}
    >
      <JournalHeading
        title={recent ? "Progress comparison" : "Photo journal"}
        style={{ marginBottom: recent ? 2 : 0 }}
      />
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
              {[
                { label: "First", photo: first, testID: "profile-comparison-first" },
                { label: "Latest", photo: latest, testID: "profile-comparison-latest" },
              ].map(({ label, photo, testID }) => (
                <Pressable
                  key={label}
                  testID={testID}
                  accessibilityRole="button"
                  accessibilityLabel={
                    photo
                      ? `View ${label.toLowerCase()} progress photo ${photo.date}`
                      : `View photo journal, no ${label.toLowerCase()} photo saved`
                  }
                  onPress={openPhotos}
                  disabled={!openPhotos}
                  style={{ flex: 1, minWidth: 0 }}
                >
                  {photoWell(photo)}
                  <JournalText size={9} muted style={{ marginTop: 6 }}>
                    {label}
                  </JournalText>
                  {photo && (
                    <JournalText size={10}>{dateLabel(photo.date)}</JournalText>
                  )}
                </Pressable>
              ))}
            </View>
          ) : (
            <>
              {photos.length === 0 ? (
                <View style={{ marginTop: 4, marginBottom: 15 }}>
                  {photoWell(undefined, true)}
                  <JournalText size={10} muted style={{ marginTop: 7 }}>
                    Your photo journal starts here.
                  </JournalText>
                </View>
              ) : (
                <View
                  onLayout={({ nativeEvent }) =>
                    setGalleryWidth(nativeEvent.layout.width)
                  }
                  style={{ width: "100%", minWidth: 0, overflow: "hidden" }}
                >
                  <ScrollView
                    testID="profile-photo-carousel"
                    horizontal
                    nestedScrollEnabled
                    directionalLockEnabled
                    showsHorizontalScrollIndicator={photos.length > 1}
                    style={{ width: "100%", flexGrow: 0 }}
                    contentContainerStyle={{
                      paddingTop: 4,
                      paddingBottom: 15,
                      alignItems: "stretch",
                    }}
                  >
                    {photos.map((photo, index) => (
                      <Fragment key={photo.id}>
                        {index > 0 && (
                          <View
                            testID="profile-photo-separator"
                            style={{
                              width: 1,
                              marginHorizontal: 12,
                              backgroundColor: colors.border,
                            }}
                          />
                        )}
                        <View
                          testID={`progress-photo-${photo.id}`}
                          style={{ width: itemWidth }}
                        >
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Edit photo ${index + 1} from ${photo.date}`}
                            accessibilityState={{ disabled: media.saving }}
                            disabled={media.saving}
                            onPress={() => setEditor({ photo })}
                          >
                            {photoWell(photo, true)}
                          </Pressable>
                          <JournalText size={11} style={{ marginTop: 8 }}>
                            {dateLabel(photo.date)}
                          </JournalText>
                          {photo.note !== "" && (
                            <JournalText
                              size={10}
                              muted
                              numberOfLines={3}
                              style={{ marginTop: 4 }}
                            >
                              {photo.note}
                            </JournalText>
                          )}
                        </View>
                      </Fragment>
                    ))}
                  </ScrollView>
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
    </View>
  );
}
