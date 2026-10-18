import {
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { AppState, Keyboard, type ScrollView } from "react-native";
import { useIsFocused } from "expo-router";
import { Screen, ScreenTitle } from "../../components/ui";
import { SheetPage } from "../../components/sheet-page";
import { StepFade } from "../../components/motion";
import { spacing } from "../../theme/tokens";
import { useDayActivity } from "../../daily/use-day";
import { SearchActions } from "../../daily/search-actions";
import { MealsWidget } from "../../daily/meals-widget";
import { FoodSearchResults } from "../../food/search-results";
import { FoodLogStatus } from "../../food/log-status";
import { useFoodLog, useFoodLogPersistence } from "../../food/log-provider";
import { FoodCatalogEditor, FoodNutritionDetail } from "../../food/nutrition-detail";
import { DailyMacros } from "../../food/daily-macros";
import type { FoodEntry } from "../../daily/model";
import type { CustomFood } from "../../food/custom-model";
import { useCustomFoodPersistence, useCustomFoods } from "../../food/custom-provider";
import { CustomFoodStatus } from "../../food/custom-status";
import type { CustomMeal } from "../../food/meal-model.ts";
import { FoodProductImport } from "../../food/product-import";
import { productClient } from "../../food/product-provider.ts";
import { createCatalogDrafts } from "../../food/catalog-drafts.ts";
import { createFoodTabView, type FoodTabView } from "../../food/tab-view.ts";
import { FoodDraftProvider, useFoodDrafts } from "../../food/draft-provider";
import { CatalogDraftPage } from "../../food/catalog-draft-page";
import { ResumeDraft } from "../../food/resume-draft";

export default function FoodScreen() {
  const activity = useDayActivity();
  const log = useFoodLogPersistence();
  const catalog = useCustomFoodPersistence();
  // Catalog drafts and the tab's view live as long as the screen; pages come and go.
  const [{ drafts, tab }] = useState(() => {
    const drafts = createCatalogDrafts({ store: catalog });
    const tab = createFoodTabView({
      date: activity.date,
      drafts,
      log,
      catalog,
      lookup: productClient,
    });
    return { drafts, tab };
  });
  return (
    <FoodDraftProvider owner={drafts}>
      <FoodDay activity={activity} tab={tab} />
    </FoodDraftProvider>
  );
}

function FoodDay({
  activity,
  tab,
}: {
  activity: ReturnType<typeof useDayActivity>;
  tab: FoodTabView;
}) {
  const { date, food, nutrition } = activity;
  const view = useSyncExternalStore(tab.subscribe, tab.getSnapshot, tab.getSnapshot);
  const { page } = view;
  const drafts = useFoodDrafts();
  const focused = useIsFocused();
  const [foreground, setForeground] = useState(AppState.currentState !== "background");
  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active" || state === "background") setForeground(state === "active");
    });
    return () => listener.remove();
  }, []);
  useLayoutEffect(() => {
    tab.start();
    return tab.stop;
  }, [tab]);
  useLayoutEffect(() => tab.setPresence({ focused, foreground }), [tab, focused, foreground]);
  useLayoutEffect(() => tab.setDay(date), [tab, date]);
  const scrollRef = useRef<ScrollView>(null);
  const pageScroll = useRef<ScrollView>(null);
  const resultsTop = useRef(0);
  const log = useFoodLog();
  const custom = useCustomFoods();
  // A new day starts at the top of its log, and so does each return to the log.
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [date]);
  useLayoutEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [view.logTop]);
  // Each step on the page over the log replaces the last, so it starts at the top too.
  useLayoutEffect(() => {
    pageScroll.current?.scrollTo({ y: 0, animated: false });
  }, [view.step]);
  function scrollToResults() {
    scrollRef.current?.scrollTo({ y: resultsTop.current, animated: false });
  }
  function created(item: CustomFood | CustomMeal) {
    Keyboard.dismiss();
    tab.created(item);
  }
  const showingLog = !view.query.trim() && food.kind === "ready";
  const fresh = useFreshEntries(food.kind === "ready" ? food.day : null, date, {
    focused,
    showingLog,
  });
  const body =
    page.kind === "resume" || page.kind === "create" ? (
      drafts.session && (
        <CatalogDraftPage
          key={page.key}
          session={drafts.session}
          creation={page.kind === "create"}
          closeLabel="Back to food log"
          onClose={tab.back}
          onSaved={created}
        />
      )
    ) : page.kind === "import" ? (
      <FoodProductImport
        page={page}
        active={focused && foreground}
        onClose={tab.back}
        onSaved={created}
      />
    ) : page.kind === "detail" && page.editor ? (
      <FoodCatalogEditor
        attempt={page.attempt}
        onClose={tab.back}
        onSaved={(item) => {
          Keyboard.dismiss();
          tab.catalogSaved(item);
        }}
      />
    ) : page.kind === "detail" ? (
      <FoodNutritionDetail
        key={page.key}
        attempt={page.attempt}
        backLabel={page.origin === "search" ? "Back to food results" : "Back to food log"}
        saved={page.saved}
        onBack={tab.back}
        onLog={() => void tab.submit()}
        onEditCatalog={tab.editCatalog}
        onDeleteItem={tab.deleteItem}
      />
    ) : page.kind === "macros" ? (
      <DailyMacros activity={activity} onBack={tab.back} />
    ) : null;
  const calorieSummary =
    nutrition === null
      ? null
      : nutrition.calories.target === null
        ? `${nutrition.calories.eaten.toLocaleString()} kcal`
        : `${nutrition.calories.eaten.toLocaleString()} / ${nutrition.calories.target.toLocaleString()} kcal`;
  return (
    <Screen title="Food" showTitle={false} scrollRef={scrollRef} adjustKeyboardInsets>
      <ScreenTitle title="Daily food log" trailing={calorieSummary} />
      <SearchActions
        kind="food"
        query={view.query}
        onQueryChange={tab.search}
        createDisabled={view.createDisabled}
        searchDisabled={view.busy}
        onCreateItem={tab.create}
        onScanBarcode={() => {
          if (tab.scan()) Keyboard.dismiss();
        }}
        macrosDisabled={view.macrosDisabled}
        onViewMacros={tab.macros}
      />
      <FoodLogStatus />
      {(log.state.kind !== "loading" || custom.state.kind !== "loading") && <CustomFoodStatus />}
      {view.resumable &&
        drafts.resumable.map((summary) => (
          <ResumeDraft
            key={summary.key}
            name={summary.name}
            disabled={view.busy}
            onPress={() => tab.resume(summary.handle)}
          />
        ))}
      {view.query.trim() ? (
        <FoodSearchResults
          key={view.query}
          query={view.query}
          onSelect={(food) => {
            Keyboard.dismiss();
            tab.select(food);
          }}
          onLayout={(event) => {
            resultsTop.current = event.nativeEvent.layout.y;
          }}
          onNavigate={scrollToResults}
        />
      ) : food.kind === "ready" ? (
        <MealsWidget
          // A new day starts its own list, so its cards appear in place rather than gliding.
          key={date}
          day={food.day}
          fresh={fresh}
          query=""
          saving={view.busy}
          error={log.error}
          onLayout={(event) => {
            resultsTop.current = event.nativeEvent.layout.y;
          }}
          removal={view.removal}
          onEdit={tab.editEntry}
          onArm={tab.armRemoval}
          onCancel={tab.cancelRemoval}
          onConfirm={(leave) => void tab.confirmRemoval(leave)}
        />
      ) : null}
      {/* Every flow opens on one page over the log. Its steps (create, then the saved item)
          replace each other on that page; leaving a draft keeps it to resume. The page steps
          aside while the tab is away and returns with it. */}
      {view.sheet && body && (
        <SheetPage
          title="Food"
          closeLabel="Back to food log"
          onClose={tab.back}
          scrollRef={pageScroll}
        >
          <StepFade step={view.step} style={{ gap: spacing.layout }}>
            {body}
          </StepFade>
        </SheetPage>
      )}
    </Screen>
  );
}

/**
 * Entries logged while the food log is on screen (or on its way back, after a search), so only
 * those rise into their meal. Entries already there when the tab opens or the day changes, or
 * added while the tab was away, are simply there.
 */
function useFreshEntries(
  day: { foods: FoodEntry[] } | null,
  date: string,
  { focused, showingLog }: { focused: boolean; showingLog: boolean },
): ReadonlySet<string> {
  const seen = useRef<{ date: string; ids: Set<string> } | null>(null);
  const [, settle] = useReducer((count: number) => count + 1, 0);
  const fresh = new Set<string>();
  const known = seen.current?.date === date ? seen.current.ids : null;
  if (day && known && focused && showingLog)
    for (const entry of day.foods) if (!known.has(entry.id)) fresh.add(entry.id);
  useEffect(() => {
    if (!day) return;
    if (seen.current?.date !== date)
      seen.current = { date, ids: new Set(day.foods.map((entry) => entry.id)) };
    // While a search covers the log, a food logged from it stays new until the log shows it.
    else if (showingLog || !focused) for (const entry of day.foods) seen.current.ids.add(entry.id);
    // Once shown, a new entry's meal card rejoins the glide of later reflows.
    if (fresh.size) settle();
  });
  return fresh;
}
