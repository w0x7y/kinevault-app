import { useRef, useState } from "react";
import { View } from "react-native";
import { Screen } from "../components/ui";
import { FoodButton } from "../food/food-button";
import { useSelectedDay } from "../calendar/provider";
import { spacing } from "../theme/tokens";
import { ProfileIdentity } from "./profile-identity";
import { ProfileControls, type ProfileSection } from "./profile-controls";
import { ProfileStreak } from "./profile-streak";
import { WorkoutChart } from "./workout-chart";
import { ProfileGoals, type ProfileEditorInstance } from "./profile-goals";
import { ProgressPhotos } from "./progress-photos";
import type { ProfileEditSection } from "./section-editing";
export function ProfileScreen() {
  const { today } = useSelectedDay();
  const [section, setSection] = useState<ProfileSection>("Overview");
  const [editor, setEditor] = useState<ProfileEditorInstance | null>(null);
  const nextEditorId = useRef(0);
  function select(next: ProfileSection) {
    if (next === section) return;
    setEditor(null);
    setSection(next);
  }
  function edit(next: ProfileEditSection | "water") {
    setEditor({ id: ++nextEditorId.current, section: next });
    setSection("Goals");
  }
  function closeEditor(id: number) {
    // A pending save can finish after another editor has opened.
    setEditor((current) => (current?.id === id ? null : current));
  }
  return (
    <Screen title="Profile" showTitle={false} adjustKeyboardInsets>
      <ProfileIdentity edit={() => edit("name")} />
      <ProfileControls section={section} select={select} />
      <View
        testID="profile-section"
        accessibilityLabel={`${section} section`}
        style={{ gap: spacing.layout }}
      >
        {section === "Overview" && (
          <>
            <ProfileStreak today={today} />
            <WorkoutChart today={today} />
            <FoodButton
              label="Today's nutrition"
              onPress={() => select("Goals")}
            />
            <ProgressPhotos
              today={today}
              recent
              openPhotos={() => select("Photos")}
            />
          </>
        )}
        {section === "Goals" && (
          <ProfileGoals
            today={today}
            editor={editor}
            edit={edit}
            close={closeEditor}
          />
        )}
        {section === "Photos" && <ProgressPhotos today={today} />}
      </View>
    </Screen>
  );
}
