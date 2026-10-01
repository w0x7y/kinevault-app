import { useRef, useState } from "react";
import type { ScrollView } from "react-native";
import { Panel, Screen } from "../../components/ui";
import { useDayActivity } from "../../daily/use-day";
import { SearchActions } from "../../daily/search-actions";
import { MealsWidget } from "../../daily/meals-widget";
import { FoodSearchResults } from "../../food/search-results";
import { FoodLogStatus } from "../../food/log-status";
import { useFoodLog } from "../../food/log-provider";
import { FoodNutritionDetail } from "../../food/nutrition-detail";
import { DailyMacros } from "../../food/daily-macros";
import type { FoodEntry } from "../../daily/model";

export default function FoodScreen() {
  const { day } = useDayActivity();
  return <FoodDay key={day.date} day={day} />;
}

function FoodDay({ day }: { day: ReturnType<typeof useDayActivity>["day"] }) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<{ kind: "log" } | { kind: "edit"; entry: FoodEntry } | { kind: "macros" }>({ kind: "log" });
  const scrollRef = useRef<ScrollView>(null);
  const resultsTop = useRef(0);
  const log = useFoodLog();
  function showLog() {
    setView({ kind: "log" });
    setQuery("");
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }
  function scrollToContent() {
    scrollRef.current?.scrollTo({ y: resultsTop.current, animated: false });
  }
  return (
    <Screen title="Food" showTitle={false} scrollRef={scrollRef}>
      <SearchActions kind="food" query={query} onQueryChange={query => { setView({ kind: "log" }); setQuery(query); }}
        macrosDisabled={log.state.kind !== "ready" || log.saving}
        onViewMacros={() => { setQuery(""); setView({ kind: "macros" }); scrollToContent(); }} />
      <FoodLogStatus />
      {log.state.kind === "ready" && view.kind === "edit" ? (
        <Panel onLayout={event => { resultsTop.current = event.nativeEvent.layout.y; scrollToContent(); }}>
          <FoodNutritionDetail target={{ kind: "edit", entry: view.entry }} date={day.date} onBack={showLog} onSaved={showLog} />
        </Panel>
      ) : log.state.kind === "ready" && view.kind === "macros" ? (
        <DailyMacros day={day} onBack={showLog}
          onLayout={event => { resultsTop.current = event.nativeEvent.layout.y; scrollToContent(); }} />
      ) : query.trim() ? (
        <FoodSearchResults key={query} query={query} date={day.date}
          onLogged={showLog}
          onLayout={event => { resultsTop.current = event.nativeEvent.layout.y; }}
          onNavigate={scrollToContent} />
      ) : log.state.kind === "ready" ? (
        <MealsWidget day={day} query="" saving={log.saving} error={log.error}
          onLayout={event => { resultsTop.current = event.nativeEvent.layout.y; }}
          onEdit={entry => { setView({ kind: "edit", entry }); scrollToContent(); }}
          onRemove={id => { void log.remove({ date: day.date, id }); }} />
      ) : null}
    </Screen>
  );
}
