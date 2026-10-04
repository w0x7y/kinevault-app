import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import { Platform, View } from "react-native";
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
import { spacing } from "../theme/tokens";

export function ProfileAvatar({ size = 32 }: { size?: number }) {
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
          backgroundColor: colors.secondary,
          alignItems: "center",
          justifyContent: "center",
        },
      ]}
    >
      <AppText variant="label" style={{ fontSize: size < 40 ? 10 : 24 }}>
        {initials}
      </AppText>
    </View>
  );
}
export function ProfileIdentity({ edit }: { edit: () => void }) {
  const profile = useProfile(),
    media = useProfileMedia();
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
    <View style={{ alignItems: "center", gap: spacing.sm }}>
      <ProfileAvatar size={88} />
      <AppText
        variant="heading"
        accessibilityRole="header"
        style={{ textAlign: "center" }}
      >
        {answers.name.trim() || "Your journal"}
      </AppText>
      <AppText variant="caption" muted style={{ textAlign: "center" }}>
        {[
          goals.find((goal) => goal.value === answers.goal)?.label,
          activities.find((activity) => activity.value === answers.activity)
            ?.label,
        ]
          .filter(Boolean)
          .join(" · ") || "Your goals, at your pace"}
      </AppText>
      <View
        style={{
          flexDirection: "row",
          gap: spacing.sm,
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        <FoodButton label="Edit profile" onPress={edit} />
        <FoodButton
          label="Change profile photo"
          onPress={() => setOpen(true)}
        />
      </View>
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
