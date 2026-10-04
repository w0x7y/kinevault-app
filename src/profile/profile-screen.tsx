import { useState } from "react";
import { View } from "react-native";
import { Screen } from "../components/ui";
import { FoodButton } from "../food/food-button";
import { useSelectedDay } from "../calendar/provider";
import { spacing } from "../theme/tokens";
import { ProfileIdentity } from "./profile-identity";
import { ProfileControls, type ProfileSection } from "./profile-controls";
import { ProfileStreak } from "./profile-streak";
import { WorkoutChart } from "./workout-chart";
import { ProfileGoals } from "./profile-goals";
import { ProgressPhotos } from "./progress-photos";
export function ProfileScreen() {
  const { today } = useSelectedDay();
  const [section, setSection] = useState<ProfileSection>("Overview"),
    [edit, setEdit] = useState(false);
  function select(next: ProfileSection) {
    setEdit(false);
    setSection(next);
  }
  return (
    <Screen title="Profile" showTitle={false} adjustKeyboardInsets>
      <ProfileIdentity
        edit={() => {
          setEdit(true);
          setSection("Goals");
        }}
      />
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
            key={edit ? "edit" : "goals"}
            today={today}
            initialEdit={edit ? "name" : undefined}
          />
        )}
        {section === "Photos" && <ProgressPhotos today={today} />}
      </View>
    </Screen>
  );
}
