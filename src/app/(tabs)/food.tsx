import { useState } from "react";
import { Screen } from "../../components/ui";
import { useDayActivity } from "../../daily/use-day";
import { SearchActions } from "../../daily/search-actions";
import { MealsWidget } from "../../daily/meals-widget";

export default function FoodScreen() {
  const { day } = useDayActivity();
  return <FoodDay key={day.date} day={day} />;
}

function FoodDay({ day }: { day: ReturnType<typeof useDayActivity>["day"] }) {
  const [query, setQuery] = useState("");
  return (
    <Screen title="Food" showTitle={false}>
      <SearchActions kind="food" query={query} onQueryChange={setQuery} />
      <MealsWidget day={day} query={query} />
    </Screen>
  );
}
