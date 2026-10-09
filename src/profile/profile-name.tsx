import { Platform, TextInput, View } from "react-native";
import { IconButton } from "../components/button";
import { ErrorText } from "../onboarding/controls";
import { useTheme } from "../theme/provider";
import { fonts } from "../theme/tokens";
import { JournalText } from "./journal-ui";
import { useProfile } from "./provider";
import { useFocusedProfileEdit } from "./use-focused-edit";

export function ProfileName() {
  const profile = useProfile();
  const { colors } = useTheme();
  const { edit, attempt, busy } = useFocusedProfileEdit();
  if (profile.state.kind !== "ready") return null;
  const name = profile.state.document.answers.name;
  const editing = attempt !== null;
  const draft = attempt?.draft.name || "";
  const error = attempt?.error
    ? "Couldn't save your name. Try again."
    : Object.values(attempt?.errors || {})[0];
  function start() {
    edit.begin("name");
  }
  function cancel() {
    edit.cancel();
  }
  function save() {
    return edit.save();
  }
  return (
    <View style={{ maxWidth: "100%", alignItems: "center", marginBottom: 4 }}>
      <View
        testID="profile-name"
        style={{ flexDirection: "row", alignItems: "center", maxWidth: "100%" }}
      >
        {editing ? (
          <>
            <IconButton label="Cancel name editing" icon="xmark" onPress={cancel} disabled={busy} />
            <TextInput
              accessibilityLabel="Profile name"
              value={draft}
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
                fontFamily: fonts.medium,
                fontSize: 20,
                color: colors.foreground,
                textAlign: "center",
                borderBottomWidth: 1,
                borderBottomColor: colors.primary,
                ...(Platform.OS === "web"
                  ? { outlineWidth: 0, outlineStyle: "solid" as const }
                  : {}),
              }}
            />
            <IconButton
              label={busy ? "Saving profile name…" : "Save profile name"}
              icon="check"
              onPress={() => void save()}
              disabled={busy}
            />
          </>
        ) : (
          <>
            <View style={{ width: 48 }} />
            <JournalText
              size={20}
              variant="heading"
              accessibilityRole="header"
              style={{ textAlign: "center", flexShrink: 1 }}
            >
              {name.trim() || "Your journal"}
            </JournalText>
            <IconButton label="Edit profile name" icon="pen" onPress={start} />
          </>
        )}
      </View>
      {error && <ErrorText message={error} />}
    </View>
  );
}
