import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { AppText } from "../components/ui";
import { DeleteButton } from "../components/delete-button";
import { FoodButton } from "../food/food-button";
import { ErrorText } from "../onboarding/controls";
import { activities, goals } from "./answers";
import { useProfile } from "./provider";
import { useProfileMedia } from "./media-provider";
import { pickProfilePhoto } from "./media-picker";
import { PhotoImage } from "./photo-image";
import type { PhotoSource } from "./media-model";
import { ProfileDialog, SourceStatus } from "./profile-controls";
import { useTheme } from "../theme/provider";

import { Icon } from "../components/icon";
import { JournalText } from "./journal-ui";
import { ProfileName } from "./profile-name";

export function ProfileAvatar({
  size = 28,
  person = false,
}: {
  size?: number;
  person?: boolean;
}) {
  const media = useProfileMedia(),
    profile = useProfile();
  const { colors } = useTheme();
  const name =
    profile.state.kind === "ready" ? profile.state.document.answers.name : "";
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase() || "KV";
  const style = { width: size, height: size, borderRadius: size / 2 };
  if (media.state.kind === "ready" && media.state.document.avatar)
    return (
      <PhotoImage
        image={media.state.document.avatar}
        thumbnail
        accessibilityLabel="Profile photo"
        style={style}
      />
    );
  return (
    <View
      style={[
        style,
        {
          backgroundColor: colors.accent,
          alignItems: "center",
          justifyContent: "center",
        },
      ]}
    >
      {person ? (
        <Icon name="user" size={29} color={colors.primary} />
      ) : (
        <JournalText
          size={size < 40 ? 11 : 24}
          style={{ color: colors.primary }}
        >
          {initials}
        </JournalText>
      )}
    </View>
  );
}
export function ProfileIdentity() {
  const profile = useProfile(),
    media = useProfileMedia();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false),
    [draft, setDraft] = useState<PhotoSource | null>(null);
  const [picking, setPicking] = useState(false),
    [error, setError] = useState<string | null>(null);
  const pending = useRef(false),
    source = useRef<PhotoSource | null>(null),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (!pending.current && source.current)
        media.files.releaseUri(source.current.uri);
    };
  }, [media.files]);
  function release() {
    if (source.current) media.files.releaseUri(source.current.uri);
    source.current = null;
    setDraft(null);
  }
  function close() {
    if (pending.current || picking) return;
    release();
    setOpen(false);
    setError(null);
  }
  async function pick(origin: "library" | "camera") {
    if (pending.current || picking) return;
    pending.current = true;
    setPicking(true);
    setError(null);
    try {
      const next = await pickProfilePhoto(origin, true);
      if (next) {
        if (!mounted.current) media.files.releaseUri(next.uri);
        else {
          release();
          source.current = next;
          setDraft(next);
        }
      }
    } catch {
      if (mounted.current) setError("Couldn't open your photo. Try again.");
    } finally {
      pending.current = false;
      if (mounted.current) setPicking(false);
      else if (source.current) media.files.releaseUri(source.current.uri);
    }
  }
  async function save(remove = false) {
    if (pending.current || media.saving || (!remove && !draft)) return false;
    pending.current = true;
    try {
      const saved = await media.saveAvatar(remove ? null : draft);
      if (saved && mounted.current) {
        release();
        setOpen(false);
      }
      return saved;
    } finally {
      pending.current = false;
      if (!mounted.current && source.current)
        media.files.releaseUri(source.current.uri);
    }
  }
  if (profile.state.kind !== "ready") return null;
  const answers = profile.state.document.answers;
  const hasAvatar =
    media.state.kind === "ready" && media.state.document.avatar !== null;
  const busy = picking || media.saving;
  return (
    <View style={{ alignItems: "center", paddingTop: 12, paddingBottom: 4 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Change profile photo"
        onPress={() => setOpen(true)}
        style={{ marginBottom: 12 }}
      >
        <ProfileAvatar size={76} person />
        <View
          testID="profile-camera-badge"
          style={{
            position: "absolute",
            right: -1,
            bottom: -1,
            width: 25,
            height: 25,
            borderRadius: 13,
            borderWidth: 3,
            borderColor: colors.card,
            backgroundColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Svg width={12} height={12} viewBox="0 0 24 24" aria-hidden>
            <Path
              fill={colors.primaryForeground}
              fillRule="evenodd"
              d="M8 4h8l2 3h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2l2-3Zm4 5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Z"
            />
          </Svg>
        </View>
      </Pressable>
      <ProfileName />
      <JournalText size={10} muted style={{ textAlign: "center" }}>
        {[
          goals.find((goal) => goal.value === answers.goal)?.label,
          activities.find((activity) => activity.value === answers.activity)
            ?.label,
        ]
          .filter(Boolean)
          .join(" · ") || "Your goals, at your pace"}
      </JournalText>
      {media.state.kind !== "ready" && (
        <SourceStatus
          name="profile media"
          kind={media.state.kind}
          retry={media.retryLoad}
        />
      )}
      {open && (
        <ProfileDialog title="Profile photo" dismiss={close}>
          {draft ? (
            <Image
              source={{ uri: draft.uri }}
              accessibilityLabel="Draft profile photo"
              contentFit="contain"
              style={{ height: 180, width: "100%" }}
            />
          ) : (
            <View style={{ alignItems: "center" }}>
              <ProfileAvatar size={100} />
            </View>
          )}
          {media.state.kind !== "ready" ? (
            <SourceStatus
              name="profile media"
              kind={media.state.kind}
              retry={media.retryLoad}
            />
          ) : (
            <>
              <FoodButton
                label={
                  hasAvatar || draft
                    ? "Replace profile photo from library"
                    : "Choose profile photo from library"
                }
                disabled={busy}
                onPress={() => void pick("library")}
              />
              {Platform.OS !== "web" && (
                <FoodButton
                  label="Take profile photo"
                  disabled={busy}
                  onPress={() => void pick("camera")}
                />
              )}
              {draft && (
                <FoodButton
                  primary
                  label={
                    media.saving
                      ? "Saving profile photo…"
                      : "Save profile photo"
                  }
                  disabled={busy}
                  onPress={() => void save()}
                />
              )}
              {hasAvatar && (
                <DeleteButton
                  label="Remove profile photo"
                  confirmAccessibilityLabel="Confirm remove profile photo"
                  disabled={busy}
                  onDelete={() => save(true)}
                />
              )}
              {busy && (
                <AppText accessibilityLiveRegion="polite">
                  {picking ? "Opening photo picker…" : "Saving photo changes…"}
                </AppText>
              )}
              {(error || media.error) && (
                <ErrorText message={error || media.error || ""} />
              )}
            </>
          )}
          <FoodButton label="Cancel" disabled={busy} onPress={close} />
        </ProfileDialog>
      )}
    </View>
  );
}
