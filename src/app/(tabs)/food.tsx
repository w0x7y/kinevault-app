import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Keyboard, type ScrollView } from "react-native";
import { useFocusEffect } from "expo-router";
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
import type { CustomMeal } from "../../food/meal-model.ts";
import { FoodProductImport } from "../../food/product-import";

import { FoodDraftProvider, useFoodDrafts } from "../../food/draft-provider";
import { CreateFoodForm } from "../../food/create-form";
import { CreateMealForm } from "../../food/create-meal-form";
import { FoodButton } from "../../food/food-button";
import { AppText } from "../../components/ui";

export default function FoodScreen() {
  const activity = useDayActivity();
  return <FoodDraftProvider><FoodDay activity={activity} /></FoodDraftProvider>;
}

function FoodDay({ activity }: { activity: ReturnType<typeof useDayActivity> }) {
  const { date, food } = activity;
  const drafts = useFoodDrafts();
  const { mealIntent, setMealIntent } = drafts;
  const [query, setQuery] = useState("");
  const [catalogEditing, setCatalogEditing] = useState(false);
  const [viewDate, setViewDate] = useState(date);
  const [view, setView] = useState<{ kind: "log" } | { kind: "edit"; entry: FoodEntry } | { kind: "macros" }
    | { kind: "resume"; key: number } | { kind: "create" } | { kind: "import"; session: number }
    | { kind: "created"; food: CustomFood | CustomMeal }>({ kind: "log" });
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  const [foreground, setForeground] = useState(AppState.currentState !== "background");
  useEffect(() => {
    const listener = AppState.addEventListener("change", state => {
      if (state === "active" || state === "background") setForeground(state === "active");
    });
    return () => listener.remove();
  }, []);
  const scrollRef = useRef<ScrollView>(null);
  const resultsTop = useRef(0);
  const importSession = useRef(0);
  const log = useFoodLog();
  const custom = useCustomFoods();
  // Day-specific views reset before rendering children; reusable-food drafts stay mounted.
  if (viewDate !== date) {
    setViewDate(date);
    if (!catalogEditing) {
      setQuery("");
      if (view.kind !== "create" && view.kind !== "created" && view.kind !== "import" && view.kind !== "resume") {
        setView({ kind: "log" });
      }
    }
  }
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    if (!catalogEditing && view.kind !== "create" && view.kind !== "created" && view.kind !== "import" && view.kind !== "resume") {
      setMealIntent("breakfast");
    }
  }, [date]);
  function showLog() {
    setView({ kind: "log" });
    setMealIntent("breakfast");
    setQuery("");
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }
  function scrollToContent() {
    scrollRef.current?.scrollTo({ y: resultsTop.current, animated: false });
  }
  function created(food: CustomFood | CustomMeal) {
    Keyboard.dismiss();
    setView({ kind: "created", food });
    scrollToContent();
  }
  function openImport() {
    if (custom.state.kind !== "ready" || custom.saving || log.saving || !focused || !foreground) return;
    Keyboard.dismiss(); setQuery("");
    setView({ kind: "import", session: ++importSession.current });
    scrollToContent();
  }
  return (
    <Screen title="Food" showTitle={false} scrollRef={scrollRef} adjustKeyboardInsets>
      <SearchActions kind="food" query={query} onQueryChange={query => { setView({ kind: "log" }); setQuery(query); }}
        createDisabled={custom.state.kind !== "ready" || custom.saving || log.saving}
        searchDisabled={custom.saving || log.saving}
        onCreateItem={() => { drafts.openCreation(); setQuery(""); setView({ kind: "create" }); scrollToContent(); }}
        onScanBarcode={openImport}
        macrosDisabled={food.kind !== "ready" || log.saving || custom.saving}
        onViewMacros={() => { setQuery(""); setView({ kind: "macros" }); scrollToContent(); }} />
      <FoodLogStatus />
      {(log.state.kind !== "loading" || custom.state.kind !== "loading") && <CustomFoodStatus />}
      {!catalogEditing && view.kind !== "resume" && view.kind !== "import" && drafts.resumable.map(summary =>
        <FoodButton key={summary.key} label={`Resume draft: ${summary.name}`}
          disabled={custom.saving || log.saving} onPress={() => { drafts.resume(summary.handle); setQuery(""); setView({ kind: "resume", key: summary.key }); scrollToContent(); }} />)}
      {view.kind === "resume" ? (
        <Panel key={view.key}>
          {drafts.session?.kind === "meal" ? <CreateMealForm session={drafts.session} onCancel={showLog} onSaved={created} /> : drafts.session?.kind === "food" ? <>
            {drafts.session.draft.importSource && <AppText variant="heading" accessibilityRole="header">Review imported food</AppText>}
            <CreateFoodForm session={drafts.session} onCancel={showLog} onSaved={created} />
          </> : null}
        </Panel>
      ) : view.kind === "import" ? (
        <Panel onLayout={event => { resultsTop.current = event.nativeEvent.layout.y; scrollToContent(); }}>
          <FoodProductImport key={view.session} active={focused && foreground} focused={focused} scopeKey={date}
            onCancel={showLog} onSaved={created} />
        </Panel>
      ) : view.kind === "create" ? (
        <Panel onLayout={event => { resultsTop.current = event.nativeEvent.layout.y; scrollToContent(); }}>
          <CreateItemForm onCancel={showLog} onSaved={created} />
        </Panel>
      ) : view.kind === "created" ? (
        <Panel onLayout={event => { resultsTop.current = event.nativeEvent.layout.y; scrollToContent(); }}>
          <FoodNutritionDetail initialMeal={mealIntent} savedCatalog target={{ kind: "add", food: view.food }} date={date}
            onCatalogEditChange={setCatalogEditing}
            onBack={showLog} backLabel="Back to food log" onSaved={showLog} />
        </Panel>
      ) : food.kind === "ready" && view.kind === "edit" ? (
        <Panel onLayout={event => { resultsTop.current = event.nativeEvent.layout.y; scrollToContent(); }}>
          <FoodNutritionDetail target={{ kind: "edit", entry: view.entry }} date={date} onBack={showLog} onSaved={showLog} />
        </Panel>
      ) : food.kind === "ready" && view.kind === "macros" ? (
        <DailyMacros day={food.day} onBack={showLog}
          onLayout={event => { resultsTop.current = event.nativeEvent.layout.y; scrollToContent(); }} />
      ) : query.trim() ? (
        <FoodSearchResults initialMeal={mealIntent} key={query} query={query} date={date}
          onCatalogEditChange={setCatalogEditing}
          onLogged={showLog}
          onLayout={event => { resultsTop.current = event.nativeEvent.layout.y; }}
          onNavigate={scrollToContent} />
      ) : food.kind === "ready" ? (
        <MealsWidget day={food.day} query="" saving={log.saving || custom.saving} error={log.error}
          onLayout={event => { resultsTop.current = event.nativeEvent.layout.y; }}
          onEdit={entry => { setView({ kind: "edit", entry }); scrollToContent(); }}
          onRemove={id => log.remove({ date, id })} />
      ) : null}
    </Screen>
  );
}
