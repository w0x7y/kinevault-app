import { View } from "react-native";
import { LoadFailure } from "../components/load-failure";
import { AppText } from "../components/ui";
import { SegmentedControl } from "../components/segmented-control";
import { spacing } from "../theme/tokens";
export const profileSections = ["Overview", "Goals", "Photos"] as const;
export type ProfileSection = (typeof profileSections)[number];

export function ProfileControls({
  section,
  select,
}: {
  section: ProfileSection;
  select: (section: ProfileSection) => void;
}) {
  return (
    <View style={{ marginBottom: spacing.layout }}>
      <SegmentedControl
        label="Profile sections"
        shape="pill"
        options={profileSections.map((name) => ({ value: name, label: name }))}
        value={section}
        onChange={select}
      />
    </View>
  );
}

/** A Profile card's source while it loads, or the failure to load it with its retry. */
export function SourceStatus({
  name,
  kind,
  retry,
}: {
  name: string;
  kind: "loading" | "error";
  retry: () => void;
}) {
  if (kind === "loading")
    return (
      <AppText variant="caption" muted accessibilityLiveRegion="polite">
        {`Loading ${name}…`}
      </AppText>
    );
  return (
    <LoadFailure message={`Couldn't load ${name}.`} retryLabel={`Retry ${name}`} onRetry={retry} />
  );
}
