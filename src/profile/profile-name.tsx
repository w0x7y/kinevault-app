import { useState } from "react";
import { Platform, TextInput, View } from "react-native";
import { IconButton } from "../components/button";
import { InlineMessage } from "../components/inline-message";
import { useDocumentEdit } from "../persistence/use-document-edit";
import { useTheme } from "../theme/provider";
import { fonts } from "../theme/tokens";
import { AppText } from "../components/ui";
import { createFocusedProfileEdit, focusedEditFeedback } from "./focused-editing";
import { useProfile, useProfilePersistence } from "./provider";

export function ProfileName() {
  const profile = useProfile();
  const persistence = useProfilePersistence();
  const { colors } = useTheme();
  const { edit, draft, error, busy, saving } = useDocumentEdit(() =>
    createFocusedProfileEdit(persistence, "name"),
  );
  const [editing, setEditing] = useState(false);
  if (profile.state.kind !== "ready") return null;
  const name = profile.state.document.answers.name;
  const feedback = focusedEditFeedback(error);
  const message = feedback.message
    ? "Couldn't save your name. Try again."
    : Object.values(feedback.errors)[0];
  function start() {
    // Each opening starts from the latest saved name, even while another save runs.
    if (edit.cancel()) setEditing(true);
  }
  function cancel() {
    if (edit.cancel()) setEditing(false);
  }
  async function save() {
    if (await edit.save()) setEditing(false);
  }
  return (
    <View style={{ maxWidth: "100%", alignItems: "center", marginBottom: 2 }}>
      <View
        testID="profile-name"
        style={{ flexDirection: "row", alignItems: "center", maxWidth: "100%" }}
      >
        {editing ? (
          <>
            <IconButton label="Cancel name editing" icon="xmark" onPress={cancel} disabled={busy} />
            <TextInput
              accessibilityLabel="Profile name"
              value={draft.name}
              maxLength={40}
              autoFocus
              selectTextOnFocus
              editable={!busy}
              returnKeyType="done"
              onSubmitEditing={() => void save()}
              onKeyPress={({ nativeEvent }) => {
                if (nativeEvent.key === "Escape") cancel();
              }}
              onChangeText={(value) => {
                edit.change({ kind: "fields", patch: { name: value } });
              }}
              selectionColor={colors.primary}
              underlineColorAndroid="transparent"
              style={{
                flex: 1,
                minWidth: 80,
                maxWidth: 260,
                minHeight: 48,
                paddingHorizontal: 4,
                paddingVertical: 4,
                fontFamily: fonts.display,
                fontSize: 24,
                color: colors.foreground,
                textAlign: "center",
                borderBottomWidth: 1,
                borderBottomColor: colors.ring,
                ...(Platform.OS === "web"
                  ? { outlineWidth: 0, outlineStyle: "solid" as const }
                  : {}),
              }}
            />
            <IconButton
              label={saving ? "Saving profile name…" : "Save profile name"}
              icon="check"
              onPress={() => void save()}
              disabled={busy}
            />
          </>
        ) : (
          <>
            <View style={{ width: 48 }} />
            <AppText
              variant="title"
              accessibilityRole="header"
              numberOfLines={2}
              style={{ textAlign: "center", flexShrink: 1 }}
            >
              {name.trim() || "Your profile"}
            </AppText>
            <IconButton label="Edit profile name" icon="pen" onPress={start} />
          </>
        )}
      </View>
      {message && <InlineMessage>{message}</InlineMessage>}
    </View>
  );
}
