import { Platform, Pressable, TextInput, View } from "react-native";
import { Icon, type IconName } from "../components/icon";
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
  function action(label: string, icon: IconName, onPress: () => void, disabled = false) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        style={{
          width: 44,
          minHeight: 44,
          alignItems: "center",
          justifyContent: "center",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <Icon
          name={icon}
          size={13}
          color={colors.primary}
          style={{ lineHeight: 16, includeFontPadding: false }}
        />
      </Pressable>
    );
  }
  return (
    <View style={{ maxWidth: "100%", alignItems: "center", marginBottom: 4 }}>
      <View
        testID="profile-name"
        style={{ flexDirection: "row", alignItems: "center", maxWidth: "100%" }}
      >
        {editing ? (
          <>
            {action("Cancel name editing", "xmark", cancel, busy)}
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
                minHeight: 44,
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
            {action(
              busy ? "Saving profile name…" : "Save profile name",
              "check",
              () => void save(),
              busy,
            )}
          </>
        ) : (
          <>
            <View style={{ width: 44 }} />
            <JournalText
              size={20}
              variant="heading"
              accessibilityRole="header"
              style={{ textAlign: "center", flexShrink: 1 }}
            >
              {name.trim() || "Your journal"}
            </JournalText>
            {action("Edit profile name", "pen", start)}
          </>
        )}
      </View>
      {error && <ErrorText message={error} />}
    </View>
  );
}
