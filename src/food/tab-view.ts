import type { FoodEntry } from "../daily/model.ts";
import type { CatalogFood } from "./catalog.ts";
import type { CatalogDraftHandle, CatalogDrafts } from "./catalog-drafts.ts";
import type { CustomFood } from "./custom-model.ts";
import type { createCustomFoodPersistence } from "./custom-persistence.ts";
import type { createFoodLogPersistence } from "./log-persistence.ts";
import type { FoodSaveTarget } from "./log-model.ts";
import { createFoodLoggingAttempt, type FoodLoggingAttempt } from "./logging-attempt.ts";
import type { CustomMeal } from "./meal-model.ts";
import {
  createProductImportFlow,
  type ProductImportFlow,
  type ProductImportState,
  type ProductLookup,
} from "./product-import-flow.ts";

type FoodLog = Pick<
  ReturnType<typeof createFoodLogPersistence>,
  "getSnapshot" | "subscribe" | "add" | "edit" | "findFood"
>;
type Catalog = Pick<ReturnType<typeof createCustomFoodPersistence>, "getSnapshot" | "subscribe">;
type Drafts = Pick<
  CatalogDrafts,
  "destination" | "resetDestination" | "openCreation" | "open" | "resume" | "removeSaved"
>;

type FoodDetailPage = {
  kind: "detail";
  key: number;
  /** Back returns to the search results, or to the food log for a created item or a logged entry. */
  origin: "search" | "created" | "entry";
  attempt: FoodLoggingAttempt;
  /** The saved item was just created or edited on this page. */
  saved: boolean;
  /** The saved item's Catalog draft is open over its details. */
  editor: boolean;
};
export type FoodImportPage = {
  kind: "import";
  key: number;
  flow: ProductImportFlow;
  state: ProductImportState;
};
/** What the Food tab shows over its food log. */
export type FoodTabPage =
  | { kind: "log" }
  | { kind: "macros" | "create" | "resume"; key: number }
  | FoodImportPage
  | FoodDetailPage;
type FoodTabSnapshot = Readonly<{
  query: string;
  page: FoodTabPage;
  /** The page over the log shows while the tab is focused. Away, it keeps its state. */
  sheet: boolean;
  /** The page's current step. Each new step starts at the top of the page. */
  step: string;
  /** Resumable drafts are offered unless a draft is already open. */
  resumable: boolean;
  /** Counts returns to the top of the food log. */
  logTop: number;
  /** A food-log or catalog write locks search, resuming and logged entries. */
  busy: boolean;
  /** Scan and Create also need loaded Custom foods. */
  createDisabled: boolean;
  /** Daily macros also needs the loaded food log. */
  macrosDisabled: boolean;
}>;

/** Catalog views belong to reusable foods, not the Selected day, so they survive a day change. */
function catalogView(page: FoodTabPage) {
  if (page.kind === "detail") return page.origin === "created" || page.editor;
  return page.kind === "create" || page.kind === "resume" || page.kind === "import";
}
function stepOf(page: FoodTabPage) {
  if (page.kind === "detail") return page.editor ? "editor" : "detail";
  return page.kind === "import" ? `import-${page.state.kind}` : page.kind;
}

/**
 * Owns the Food tab's view decisions: the search query, the page over the food log and the
 * owners behind it (a Logging attempt, a Product import), and what a day change, leaving the
 * tab, saving or deleting does to them. Pages keep their owners while the tab is away, so a
 * page hidden then shown again resumes where it was.
 */
export function createFoodTabView({
  date,
  drafts,
  log,
  catalog,
  lookup,
}: {
  date: string;
  drafts: Drafts;
  log: FoodLog;
  catalog: Catalog;
  lookup: ProductLookup;
}) {
  const listeners = new Set<() => void>();
  let day = date;
  let query = "";
  let page: FoodTabPage = { kind: "log" };
  let focused = false;
  let foreground = true;
  let logTop = 0;
  let sequence = 0;
  let running = false;
  let detach: (() => void) | undefined;
  let detachFlow: (() => void) | undefined;
  let snapshot = build();

  function build(): FoodTabSnapshot {
    const saved = log.getSnapshot();
    const custom = catalog.getSnapshot();
    const busy = saved.saving || custom.saving;
    return {
      query,
      page,
      sheet: focused && page.kind !== "log",
      step: stepOf(page),
      resumable: !(
        page.kind === "resume" ||
        page.kind === "import" ||
        (page.kind === "detail" && page.editor)
      ),
      logTop,
      busy,
      createDisabled: busy || custom.state.kind !== "ready",
      macrosDisabled: busy || saved.state.kind !== "ready",
    };
  }
  function publish() {
    snapshot = build();
    for (const listener of listeners) listener();
  }
  function follow() {
    const next = build();
    if (
      next.busy === snapshot.busy &&
      next.createDisabled === snapshot.createDisabled &&
      next.macrosDisabled === snapshot.macrosDisabled
    )
      return;
    snapshot = next;
    for (const listener of listeners) listener();
  }
  // Leaving a page retires its owners: a later save result or lookup can't reach another page.
  function show(next: FoodTabPage) {
    if (page.kind === "detail" && (next.kind !== "detail" || next.attempt !== page.attempt))
      page.attempt.close();
    if (page.kind === "import" && (next.kind !== "import" || next.flow !== page.flow)) {
      detachFlow?.();
      detachFlow = undefined;
      page.flow.stop();
    }
    page = next;
  }
  function showLog() {
    show({ kind: "log" });
    query = "";
    logTop++;
    drafts.resetDestination();
    publish();
  }
  function showDetail(origin: FoodDetailPage["origin"], target: FoodSaveTarget, saved = false) {
    const attempt = createFoodLoggingAttempt({
      target,
      date: day,
      log,
      catalog,
      destination: drafts.destination,
    });
    if (running) attempt.start();
    show({ kind: "detail", key: ++sequence, origin, attempt, saved, editor: false });
    publish();
  }
  function current(attempt: FoodLoggingAttempt) {
    return page.kind === "detail" && page.attempt === attempt;
  }
  function context() {
    return { active: focused && foreground, scopeKey: day };
  }
  function back() {
    if (page.kind === "detail" && page.editor) {
      page = { ...page, editor: false };
      return publish();
    }
    if (page.kind === "detail" && page.origin === "search") {
      show({ kind: "log" });
      return publish();
    }
    if (page.kind === "import") page.flow.cancel();
    showLog();
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    start() {
      if (running) return;
      running = true;
      const stops = [log.subscribe(follow), catalog.subscribe(follow)];
      detach = () => stops.forEach((stop) => stop());
      if (page.kind === "detail") page.attempt.start();
      if (page.kind === "import") {
        page.flow.start();
        page.flow.setContext(context());
      }
      publish();
    },
    stop() {
      if (!running) return;
      running = false;
      detach?.();
      detach = undefined;
      if (page.kind === "detail") page.attempt.close();
      if (page.kind === "import") page.flow.stop();
    },
    /** Day-specific views return to the new day's log; catalog views follow the new day. */
    setDay(date: string) {
      if (date === day) return;
      day = date;
      if (catalogView(page)) {
        if (page.kind === "detail") page.attempt.setDate(date);
        if (page.kind === "import") page.flow.setContext(context());
      } else {
        show({ kind: "log" });
        query = "";
        drafts.resetDestination();
      }
      publish();
    },
    /** Leaving the tab interrupts a lookup and closes the scanner; other pages wait hidden. */
    setPresence(next: { focused: boolean; foreground: boolean }) {
      if (next.focused === focused && next.foreground === foreground) return;
      focused = next.focused;
      foreground = next.foreground;
      if (page.kind === "import") {
        page.flow.setContext(context());
        if (!focused && page.state.kind === "scanner") return back();
      }
      publish();
    },
    search(text: string) {
      show({ kind: "log" });
      query = text;
      publish();
    },
    create() {
      drafts.openCreation();
      show({ kind: "create", key: ++sequence });
      query = "";
      publish();
    },
    macros() {
      show({ kind: "macros", key: ++sequence });
      query = "";
      publish();
    },
    resume(handle: CatalogDraftHandle) {
      if (!drafts.resume(handle)) return;
      show({ kind: "resume", key: ++sequence });
      query = "";
      publish();
    },
    /** Opens a Product import, when Custom foods can take one and the tab is in use. */
    scan() {
      if (build().createDisabled || !focused || !foreground) return false;
      const flow = createProductImportFlow({ lookup, drafts });
      if (running) flow.start();
      flow.setContext(context());
      show({ kind: "import", key: ++sequence, flow, state: flow.getSnapshot() });
      detachFlow = flow.subscribe(() => {
        if (page.kind !== "import" || page.flow !== flow) return;
        page = { ...page, state: flow.getSnapshot() };
        publish();
      });
      query = "";
      publish();
      return true;
    },
    select(food: CatalogFood) {
      showDetail("search", { kind: "add", food });
    },
    editEntry(entry: FoodEntry) {
      showDetail("entry", { kind: "edit", entry });
    },
    /** A creation, resumed draft or import review was saved: the saved item opens, ready to log. */
    created(item: CustomFood | CustomMeal) {
      if (page.kind !== "create" && page.kind !== "resume" && page.kind !== "import") return;
      showDetail("created", { kind: "add", food: item }, true);
    },
    back,
    /** Opens the detail's saved item in its Catalog draft, restoring that draft's destination. */
    editCatalog() {
      if (page.kind !== "detail" || page.editor) return;
      const { item, target } = page.attempt.getSnapshot();
      if (!item || target.kind !== "add") return;
      drafts.open(
        item.kind === "meal"
          ? { kind: "edit-meal", item: item.food }
          : { kind: "edit-food", item: item.food },
      );
      page = { ...page, editor: true };
      publish();
    },
    catalogSaved(item: CustomFood | CustomMeal) {
      if (page.kind !== "detail" || !page.editor) return;
      page.attempt.catalogSaved(item);
      page = { ...page, editor: false, saved: true };
      publish();
    },
    /** Logs the detail's attempt; a durable success returns to the food log. */
    async submit() {
      if (page.kind !== "detail") return false;
      const { attempt } = page;
      const saved = await attempt.submit();
      if (saved && current(attempt)) showLog();
      return saved;
    },
    /** Deletes the detail's saved item; a durable success leaves its details. */
    async deleteItem() {
      if (page.kind !== "detail") return false;
      const { attempt } = page;
      const { item } = attempt.getSnapshot();
      if (!item) return false;
      const removed = await drafts.removeSaved(item.food, attempt);
      if (removed && current(attempt)) back();
      return removed;
    },
  };
}
export type FoodTabView = ReturnType<typeof createFoodTabView>;
