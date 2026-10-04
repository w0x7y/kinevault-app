import { Image } from "expo-image";
import { Platform, Pressable, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { AppText } from "../components/ui";
import { DeleteButton } from "../components/delete-button";
import { FoodButton } from "../food/food-button";
import { ErrorText } from "../onboarding/controls";
import { activities, goals } from "./answers";
import { useProfile } from "./provider";
import { useProfileMedia } from "./media-provider";
import { useMediaEditing } from "./use-media-editing";
import { PhotoImage } from "./photo-image";
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
  const { editing, attempt, phase, error } = useMediaEditing("avatar");
  const open = attempt.kind === "avatar";
  const draft = attempt.kind === "avatar" ? attempt.source : undefined;
  const picking = phase === "picking";
  const close = () => { editing.cancel(); };
  const pick = editing.pick;
  if (profile.state.kind !== "ready") return null;
  const answers = profile.state.document.answers;
  const hasAvatar =
    media.state.kind === "ready" && media.state.document.avatar !== null;
  const busy = phase !== "idle" || media.saving;
  return (
    <View style={{ alignItems: "center", paddingTop: 12, paddingBottom: 4 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Change profile photo"
        onPress={() => editing.open()}
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
                  onPress={() => void editing.save()}
                />
              )}
              {hasAvatar && (
                <DeleteButton
                  label="Remove profile photo"
                  confirmAccessibilityLabel="Confirm remove profile photo"
                  disabled={busy}
                  onDelete={editing.remove}
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
