import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, TextInput, View } from "react-native";
import { Icon, type IconName } from "../components/icon";
import { ErrorText } from "../onboarding/controls";
import { useTheme } from "../theme/provider";
import { fonts } from "../theme/tokens";
import { validateAnswers } from "./calories";
import { JournalText } from "./journal-ui";
import { useProfile } from "./provider";
import { editedProfileAnswers } from "./section-editing";

export function ProfileName() {
  const profile = useProfile();
  const { colors } = useTheme();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  if (profile.state.kind !== "ready") return null;
  const name = profile.state.document.answers.name;
  function start() {
    setDraft(name);
    setError(null);
    setEditing(true);
  }
  function cancel() {
    if (pending.current) return;
    setEditing(false);
    setError(null);
  }
  async function save() {
    if (pending.current || profile.saving || profile.state.kind !== "ready")
      return;
    const current = profile.state.document.answers;
    const answers = editedProfileAnswers(
      current,
      { ...current, name: draft },
      "name",
    );
    const errors = validateAnswers(answers);
    if (Object.keys(errors).length) {
      setError(Object.values(errors)[0] || "Check your name and try again.");
      return;
    }
    pending.current = true;
    setError(null);
    try {
      const saved = await profile.save({ version: 1, kind: "complete", answers });
      if (mounted.current) {
        if (saved) setEditing(false);
        else setError("Couldn't save your name. Try again.");
      }
    } finally {
      pending.current = false;
    }
  }
  function action(
    label: string,
    icon: IconName,
    onPress: () => void,
    disabled = false,
  ) {
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
            <TextInput
              accessibilityLabel="Profile name"
              value={draft}
              autoFocus
              selectTextOnFocus
              editable={!profile.saving}
              returnKeyType="done"
              onSubmitEditing={() => void save()}
              onKeyPress={({ nativeEvent }) => {
                if (nativeEvent.key === "Escape") cancel();
              }}
              onChangeText={(value) => {
                setDraft(value);
                setError(null);
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
              profile.saving ? "Saving profile name…" : "Save profile name",
              "check",
              () => void save(),
              profile.saving,
            )}
            {action("Cancel name editing", "xmark", cancel, profile.saving)}
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
