import { useState } from "react";
import { Screen } from "../../components/ui";
import { useDayActivity } from "../../daily/use-day";
import { SearchActions } from "../../daily/search-actions";
import { WorkoutWidget } from "../../daily/workout-widget";

export default function ExerciseScreen() {
  const activity = useDayActivity();
  return <ExerciseDay key={activity.day.date} activity={activity} />;
}

function ExerciseDay({ activity }: { activity: ReturnType<typeof useDayActivity> }) {
  const [query, setQuery] = useState("");
  return (
    <Screen title="Exercise" showTitle={false}>
      <SearchActions kind="exercise" query={query} onQueryChange={setQuery} />
      <WorkoutWidget workout={activity.summary.workout} detailed query={query} />
    </Screen>
  );
}
