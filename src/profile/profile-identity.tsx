import { ButtonRow, AppButton } from "../components/button";
import { Image } from "expo-image";
import { Platform, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { AppText } from "../components/ui";
import { DeleteButton } from "../components/delete-button";
import { InlineMessage } from "../components/inline-message";
import { choiceLabels } from "./answers";
import { useProfile } from "./provider";
import { useProfileMedia } from "./media-provider";
import { useMediaEditing } from "./use-media-editing";
import { PhotoImage } from "./photo-image";
import { SourceStatus } from "./profile-controls";
import { ModalSheet } from "../components/modal-sheet";
import { useTheme } from "../theme/provider";

import { Icon } from "../components/icon";
import { Tappable } from "../components/tappable";
import { fonts, spacing } from "../theme/tokens";
import { ProfileName } from "./profile-name";

export function ProfileAvatar({ size = 36, person = false }: { size?: number; person?: boolean }) {
  const media = useProfileMedia(),
    profile = useProfile();
  const { colors } = useTheme();
  const name = profile.state.kind === "ready" ? profile.state.document.answers.name : "";
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
          backgroundColor: person ? colors.muted : colors.brand,
          alignItems: "center",
          justifyContent: "center",
        },
      ]}
    >
      {person ? (
        <Icon name="user" size={Math.round(size * 0.4)} color={colors.mutedForeground} />
      ) : (
        <AppText
          variant="label"
          style={{
            color: colors.card,
            fontFamily: fonts.bold,
            fontSize: size < 40 ? 13 : Math.round(size * 0.34),
            lineHeight: size < 40 ? 18 : Math.round(size * 0.42),
            letterSpacing: size < 40 ? 0.2 : 0.6,
          }}
        >
          {initials}
        </AppText>
      )}
    </View>
  );
}
export function ProfileIdentity() {
  const profile = useProfile(),
    media = useProfileMedia();
  const { colors } = useTheme();
  const { editing, attempt, phase, error, busy } = useMediaEditing("avatar");
  const open = attempt.kind === "avatar";
  const draft = attempt.kind === "avatar" ? attempt.source : undefined;
  const picking = phase === "picking";
  const close = () => {
    editing.cancel();
  };
  const pick = editing.pick;
  if (profile.state.kind !== "ready") return null;
  const answers = profile.state.document.answers;
  const hasAvatar = media.state.kind === "ready" && media.state.document.avatar !== null;
  return (
    <View style={{ alignItems: "center", paddingTop: spacing.sm, paddingBottom: spacing.lg }}>
      <Tappable
        label="Change profile photo"
        onPress={() => editing.open()}
        style={{
          width: 104,
          height: 104,
          borderRadius: 52,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: spacing.sm,
          backgroundColor: colors.brandSoft,
        }}
      >
        <ProfileAvatar size={84} />
        <View
          testID="profile-camera-badge"
          style={{
            position: "absolute",
            right: 2,
            bottom: 2,
            width: 30,
            height: 30,
            borderRadius: 15,
            borderWidth: 3,
            borderColor: colors.background,
            backgroundColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Svg width={14} height={14} viewBox="0 0 24 24" aria-hidden>
            <Path
              fill={colors.primaryForeground}
              fillRule="evenodd"
              d="M8 4h8l2 3h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2l2-3Zm4 5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Z"
            />
          </Svg>
        </View>
      </Tappable>
      <ProfileName />
      <AppText variant="caption" muted style={{ textAlign: "center" }}>
        {Object.values(choiceLabels(answers)).filter(Boolean).join(" · ") ||
          "Your goals, at your pace"}
      </AppText>
      {media.state.kind !== "ready" && (
        <SourceStatus name="profile media" kind={media.state.kind} retry={media.retryLoad} />
      )}
      <ModalSheet open={open} title="Profile photo" onDismiss={close} dismissDisabled={busy}>
        {draft ? (
          <Image
            source={{ uri: draft.uri }}
            accessibilityLabel="Draft profile photo"
            contentFit="cover"
            style={{ height: 136, width: 136, borderRadius: 68, alignSelf: "center" }}
          />
        ) : (
          <View style={{ alignItems: "center", paddingVertical: spacing.xs }}>
            <ProfileAvatar size={136} />
          </View>
        )}
        {media.state.kind !== "ready" ? (
          <SourceStatus name="profile media" kind={media.state.kind} retry={media.retryLoad} />
        ) : (
          <>
            <AppButton
              icon="image"
              label={
                hasAvatar || draft
                  ? "Replace profile photo from library"
                  : "Choose profile photo from library"
              }
              disabled={busy}
              onPress={() => void pick("library")}
            />
            {Platform.OS !== "web" && (
              <AppButton
                icon="camera"
                label="Take profile photo"
                disabled={busy}
                onPress={() => void pick("camera")}
              />
            )}
            {busy && (
              <AppText variant="caption" muted accessibilityLiveRegion="polite">
                {picking ? "Opening photo picker…" : "Saving photo changes…"}
              </AppText>
            )}
            {error && <InlineMessage>{error}</InlineMessage>}
          </>
        )}
        <ButtonRow>
          <AppButton label="Cancel" disabled={busy} onPress={close} fill />
          {draft && media.state.kind === "ready" && (
            <AppButton
              tone="primary"
              fill
              label={busy && !picking ? "Saving profile photo…" : "Save profile photo"}
              disabled={busy}
              onPress={() => void editing.save()}
            />
          )}
        </ButtonRow>
        {hasAvatar && media.state.kind === "ready" && (
          <DeleteButton
            icon="trash-can"
            label="Remove profile photo"
            confirmAccessibilityLabel="Confirm remove profile photo"
            disabled={busy}
            onDelete={editing.remove}
          />
        )}
      </ModalSheet>
    </View>
  );
}
