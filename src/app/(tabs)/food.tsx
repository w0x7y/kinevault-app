import { useEffect, useRef, useState } from "react";
import { Keyboard, type ScrollView } from "react-native";
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
import type { CustomFood } from "../../food/custom-model";
import { useCustomFoods } from "../../food/custom-provider";
import { CustomFoodStatus } from "../../food/custom-status";
import { CreateItemForm } from "../../food/create-item-form";
import { FoodCreatedNotice } from "../../food/created-notice";
import type { CatalogKind, CustomMeal } from "../../food/meal-model.ts";

export default function FoodScreen() {
  const { day } = useDayActivity();
  return <FoodDay day={day} />;
}

function FoodDay({ day }: { day: ReturnType<typeof useDayActivity>["day"] }) {
  const [query, setQuery] = useState("");
  const [catalogKind, setCatalogKind] = useState<CatalogKind>("food");
  const [catalogEditing, setCatalogEditing] = useState(false);
  const [viewDate, setViewDate] = useState(day.date);
  const [view, setView] = useState<{ kind: "log" } | { kind: "edit"; entry: FoodEntry } | { kind: "macros" }
    | { kind: "create" } | { kind: "created"; food: CustomFood | CustomMeal; noticeOpen: boolean }>({ kind: "log" });
  const scrollRef = useRef<ScrollView>(null);
  const resultsTop = useRef(0);
  const log = useFoodLog();
  const custom = useCustomFoods();
  const createdMeal = view.kind === "created" && "ingredients" in view.food ? view.food : undefined;
  const editedMeal = view.kind === "edit" && custom.state.kind === "ready"
    ? custom.state.document.meals.find(meal => meal.customId === view.entry.customId) : undefined;
  // Day-specific views reset before rendering children; reusable-food drafts stay mounted.
  if (viewDate !== day.date) {
    setViewDate(day.date);
    if (!catalogEditing) {
      setQuery("");
      if (view.kind !== "create" && view.kind !== "created") setView({ kind: "log" });
    }
  }
  useEffect(() => { scrollRef.current?.scrollTo({ y: 0, animated: false }); }, [day.date]);
  function showLog() {
    setView({ kind: "log" });
    setQuery("");
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }
  function scrollToContent() {
    scrollRef.current?.scrollTo({ y: resultsTop.current, animated: false });
  }
  return (
    <Screen title="Food" showTitle={false} scrollRef={scrollRef} adjustKeyboardInsets>
      <SearchActions kind="food" query={query} onQueryChange={query => { setView({ kind: "log" }); setQuery(query); }}
        createDisabled={custom.state.kind !== "ready" || custom.saving || log.saving}
        searchDisabled={custom.saving || log.saving}
        catalogKind={catalogKind}
        onCatalogKindChange={kind => {
          setCatalogKind(kind);
          if (view.kind !== "create") { setView({ kind: "log" }); setQuery(""); }
        }}
        onCreateItem={() => { setQuery(""); setView({ kind: "create" }); scrollToContent(); }}
        macrosDisabled={log.state.kind !== "ready" || log.saving || custom.saving}
        onViewMacros={() => { setQuery(""); setView({ kind: "macros" }); scrollToContent(); }} />
      <FoodLogStatus />
      <CustomFoodStatus />
      {view.kind === "create" ? (
        <Panel onLayout={event => { resultsTop.current = event.nativeEvent.layout.y; scrollToContent(); }}>
          <CreateItemForm kind={catalogKind} onCancel={showLog} onSaved={food => {
            Keyboard.dismiss();
            setView({ kind: "created", food, noticeOpen: true });
            scrollToContent();
          }} />
        </Panel>
      ) : view.kind === "created" ? (
        <Panel onLayout={event => { resultsTop.current = event.nativeEvent.layout.y; scrollToContent(); }}>
          <FoodNutritionDetail target={{ kind: "add", food: view.food }} date={day.date}
            onCatalogEditChange={setCatalogEditing}
            customMeal={createdMeal}
            onBack={showLog} backLabel="Back to food log" onSaved={showLog} />
        </Panel>
      ) : log.state.kind === "ready" && view.kind === "edit" ? (
        <Panel onLayout={event => { resultsTop.current = event.nativeEvent.layout.y; scrollToContent(); }}>
          <FoodNutritionDetail target={{ kind: "edit", entry: view.entry }} customMeal={editedMeal} date={day.date} onBack={showLog} onSaved={showLog} />
        </Panel>
      ) : log.state.kind === "ready" && view.kind === "macros" ? (
        <DailyMacros day={day} onBack={showLog}
          onLayout={event => { resultsTop.current = event.nativeEvent.layout.y; scrollToContent(); }} />
      ) : query.trim() || catalogKind === "meal" ? (
        <FoodSearchResults key={`${catalogKind}-${query}`} kind={catalogKind} query={query} date={day.date}
          onCatalogEditChange={setCatalogEditing}
          onLogged={showLog}
          onLayout={event => { resultsTop.current = event.nativeEvent.layout.y; }}
          onNavigate={scrollToContent} />
      ) : log.state.kind === "ready" ? (
        <MealsWidget day={day} query="" saving={log.saving} error={log.error}
          onLayout={event => { resultsTop.current = event.nativeEvent.layout.y; }}
          onEdit={entry => { setView({ kind: "edit", entry }); scrollToContent(); }}
          onRemove={id => { void log.remove({ date: day.date, id }); }} />
      ) : null}
      {view.kind === "created" && view.noticeOpen && <FoodCreatedNotice kind={createdMeal ? "meal" : "food"} onDismiss={() => {
        setView(current => current.kind === "created" ? { ...current, noticeOpen: false } : current);
      }} />}
    </Screen>
  );
}
