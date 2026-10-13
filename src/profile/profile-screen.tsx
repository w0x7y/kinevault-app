import { useRef, useState } from "react";
import { View } from "react-native";
import { Screen } from "../components/ui";
import { useSelectedDay } from "../calendar/provider";
import { useRouteRequest } from "../navigation/use-route-request";
import { spacing } from "../theme/tokens";
import { ProfileIdentity } from "./profile-identity";
import { ProfileControls, profileSections, type ProfileSection } from "./profile-controls";
import { ProfileStreak } from "./profile-streak";
import { WorkoutChart } from "./workout-chart";
import { WeightJournal } from "./weight-journal";
import { ProfileGoals, TodayNutrition, type ProfileEditorInstance } from "./profile-goals";
import { ProgressPhotos } from "./progress-photos";
import type { ProfileEditSection } from "./section-editing";

export function ProfileScreen() {
  const { today } = useSelectedDay();
  const [section, setSection] = useState<ProfileSection>("Overview");
  const [editor, setEditor] = useState<ProfileEditorInstance | null>(null);
  const nextEditorId = useRef(0);
  // `/profile?section=photos` opens a section, e.g. from a Progress photo reminder.
  // It never closes an open editor, which would discard unsaved changes.
  useRouteRequest("section", { ready: true }, (requested) => {
    const next = profileSections.find((name) => name.toLowerCase() === requested);
    if (!next || next === section || editor) return;
    setSection(next);
  });
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
    <Screen
      title="Profile"
      showTitle={false}
      adjustKeyboardInsets
      contentContainerStyle={{ gap: 0 }}
    >
      <ProfileIdentity />
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
            <WeightJournal />
            <TodayNutrition today={today} onPress={() => select("Goals")} />
            <ProgressPhotos today={today} recent openPhotos={() => select("Photos")} />
          </>
        )}
        {section === "Goals" && (
          <ProfileGoals today={today} editor={editor} edit={edit} close={closeEditor} />
        )}
        {section === "Photos" && <ProgressPhotos today={today} />}
      </View>
    </Screen>
  );
}
