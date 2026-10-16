import { AppButton } from "../components/button";
import { Fragment, useRef, useState } from "react";
import { Platform, ScrollView, StyleSheet, View } from "react-native";
import { AppText, Overline, Panel } from "../components/ui";
import { fonts, radius, spacing } from "../theme/tokens";
import { Icon } from "../components/icon";
import { IconWell } from "../components/icon-well";
import { Tappable } from "../components/tappable";
import { useTheme } from "../theme/provider";
import { parseDay } from "../calendar/dates";
import { JournalHeading } from "./journal-ui";
import { InlineMessage } from "../components/inline-message";
import { useProfileMedia } from "./media-provider";
import { useMediaEditing } from "./use-media-editing";
import type { ProgressPhoto } from "./media-model";
import { PhotoImage } from "./photo-image";
import { SourceStatus } from "./profile-controls";
import { ModalSheet } from "../components/modal-sheet";
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
  // The picker opens once the source sheet has gone, never over a sheet that is still leaving.
  const source = useRef<"library" | "camera" | null>(null);
  const edit = useMediaEditing("photos", today);
  const { editing, phase, error } = edit;
  const picking = phase === "picking";
  const pick = editing.pick;
  const [galleryWidth, setGalleryWidth] = useState(0);
  const { photos, first, latest } = progressPhotoTimeline(
    media.state.kind === "ready" ? media.state.document.photos : [],
  );
  const itemWidth = galleryWidth ? Math.min(300, galleryWidth * 0.72) : 220;
  function add() {
    if (Platform.OS === "web") void pick("library");
    else setSources(true);
  }
  const unavailable = edit.busy || !edit.ready;
  const dateLabel = (date: string) =>
    parseDay(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  function photoWell(photo?: ProgressPhoto, journal = false) {
    const style = {
      width: "100%" as const,
      aspectRatio: journal ? 4 / 5 : 3 / 4,
      borderRadius: journal ? radius.control + 4 : radius.control,
      backgroundColor: colors.muted,
    };
    return photo ? (
      <PhotoImage
        image={photo.image}
        thumbnail={recent}
        contentFit="cover"
        accessibilityLabel={`Progress photo ${photo.date}`}
        style={style}
      />
    ) : (
      <View style={[style, { justifyContent: "center", alignItems: "center", gap: spacing.sm }]}>
        <Icon name="image" size={22} color={colors.mutedForeground} />
        <AppText variant="caption" muted style={{ textAlign: "center" }}>
          No saved photo
        </AppText>
      </View>
    );
  }
  return (
    <Panel testID={recent ? "profile-recent-photos" : "profile-photos"} style={{ minWidth: 0 }}>
      <JournalHeading title={recent ? "Progress comparison" : "Photo journal"}>
        {!recent && photos.length > 0 && (
          <AppText variant="caption" muted>
            {photos.length === 1 ? "1 photo" : `${photos.length} photos`}
          </AppText>
        )}
      </JournalHeading>
      {media.state.kind !== "ready" ? (
        <SourceStatus name="profile media" kind={media.state.kind} retry={media.retryLoad} />
      ) : (
        <>
          {recent && !first && !latest ? (
            <Tappable
              testID="profile-comparison-empty"
              label="Add progress photos in your photo journal"
              onPress={openPhotos}
              disabled={!openPhotos}
              style={({ pressed }) => ({
                minHeight: 64,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                padding: spacing.md - 2,
                borderRadius: radius.control,
                backgroundColor: pressed ? colors.accent : colors.muted,
              })}
            >
              <IconWell icon="images" color={colors.primary} background="card" size="large" />
              <AppText variant="label" style={{ flex: 1, fontFamily: fonts.medium }}>
                Add progress photos to compare your first and latest.
              </AppText>
              <Icon name="chevron-right" size={16} color={colors.mutedForeground} />
            </Tappable>
          ) : recent ? (
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.md }}>
              {[
                { label: "First", photo: first, testID: "profile-comparison-first" },
                { label: "Latest", photo: latest, testID: "profile-comparison-latest" },
              ].map(({ label, photo, testID }) => (
                <Tappable
                  key={label}
                  testID={testID}
                  label={
                    photo
                      ? `View ${label.toLowerCase()} progress photo ${photo.date}`
                      : `View photo journal, no ${label.toLowerCase()} photo saved`
                  }
                  onPress={openPhotos}
                  disabled={!openPhotos}
                  style={{ flex: 1, minWidth: 0, gap: 6, borderRadius: radius.control + 2 }}
                >
                  <View>
                    {photoWell(photo)}
                    <View
                      style={{
                        position: "absolute",
                        top: spacing.sm,
                        left: spacing.sm,
                        paddingHorizontal: spacing.sm,
                        paddingVertical: 3,
                        borderRadius: radius.pill,
                        backgroundColor: colors.elevated,
                      }}
                    >
                      <Overline style={{ color: colors.foreground, letterSpacing: 0.8 }}>
                        {label}
                      </Overline>
                    </View>
                  </View>
                  {photo && <AppText variant="label">{dateLabel(photo.date)}</AppText>}
                </Tappable>
              ))}
            </View>
          ) : (
            <>
              {photos.length === 0 ? (
                <View
                  style={{ alignItems: "center", gap: spacing.sm, paddingVertical: spacing.lg }}
                >
                  <View
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 36,
                      backgroundColor: colors.brandSoft,
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: spacing.xs,
                    }}
                  >
                    <Icon name="images" size={30} color={colors.brand} />
                  </View>
                  <AppText variant="heading" style={{ textAlign: "center" }}>
                    Your photo journal starts here.
                  </AppText>
                  <AppText variant="caption" muted style={{ textAlign: "center", maxWidth: 280 }}>
                    Add a dated photo now and then to see how far you have come.
                  </AppText>
                </View>
              ) : (
                <View
                  onLayout={({ nativeEvent }) => setGalleryWidth(nativeEvent.layout.width)}
                  style={{ width: "100%", minWidth: 0, overflow: "hidden" }}
                >
                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    showsHorizontalScrollIndicator={false}
                    testID="profile-photo-carousel"
                    horizontal
                    nestedScrollEnabled
                    directionalLockEnabled
                    style={{ width: "100%", flexGrow: 0 }}
                    contentContainerStyle={{ paddingBottom: spacing.xs, alignItems: "stretch" }}
                  >
                    {photos.map((photo, index) => (
                      <Fragment key={photo.id}>
                        {index > 0 && (
                          <View
                            testID="profile-photo-separator"
                            style={{
                              width: StyleSheet.hairlineWidth,
                              marginHorizontal: spacing.md,
                              backgroundColor: colors.border,
                            }}
                          />
                        )}
                        <View
                          testID={`progress-photo-${photo.id}`}
                          style={{ width: itemWidth, gap: 4 }}
                        >
                          <Tappable
                            label={`Edit photo ${index + 1} from ${photo.date}`}
                            disabled={edit.busy && !picking}
                            onPress={() => editing.open(photo)}
                            style={{ marginBottom: 6, borderRadius: radius.control + 6 }}
                          >
                            {photoWell(photo, true)}
                          </Tappable>
                          <AppText variant="label">{dateLabel(photo.date)}</AppText>
                          {photo.note !== "" && (
                            <AppText variant="caption" muted numberOfLines={3}>
                              {photo.note}
                            </AppText>
                          )}
                        </View>
                      </Fragment>
                    ))}
                  </ScrollView>
                </View>
              )}
              <AppButton
                tone={photos.length === 0 ? "primary" : "secondary"}
                icon="plus"
                accessibilityLabel="Add from library"
                label={
                  picking
                    ? "Opening photo picker…"
                    : Platform.OS === "web"
                      ? "Add from library"
                      : "Add progress photo"
                }
                disabled={unavailable}
                onPress={add}
              />
            </>
          )}
          {error && edit.attempt.kind === "closed" && <InlineMessage>{error}</InlineMessage>}
        </>
      )}
      <ModalSheet
        open={sources}
        title="Add progress photo"
        onDismiss={() => setSources(false)}
        onClosed={() => {
          const from = source.current;
          source.current = null;
          if (from) void pick(from);
        }}
      >
        <AppButton
          icon="images"
          label="Add from library"
          onPress={() => {
            source.current = "library";
            setSources(false);
          }}
        />
        <AppButton
          icon="camera"
          label="Add from camera"
          onPress={() => {
            source.current = "camera";
            setSources(false);
          }}
        />
        <AppButton label="Cancel" onPress={() => setSources(false)} />
      </ModalSheet>
      <ModalSheet
        open={edit.attempt.kind === "photo"}
        title={
          edit.attempt.kind === "photo" && edit.attempt.photo
            ? "Edit progress photo"
            : "Add progress photo"
        }
        onDismiss={editing.cancel}
        dismissDisabled={edit.busy}
      >
        {edit.attempt.kind === "photo" && (
          <PhotoEditor key={edit.attempt.id} editing={editing} snapshot={edit} />
        )}
      </ModalSheet>
    </Panel>
  );
}
