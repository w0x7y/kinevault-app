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
  "getSnapshot" | "subscribe" | "add" | "edit" | "remove" | "findFood"
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
/** Removing a logged entry: its confirmation is open, its removal runs, or the removal failed. */
export type FoodEntryRemoval = Readonly<{
  id: string;
  date: string;
  state: "armed" | "removing" | "failed";
}>;
type FoodTabSnapshot = Readonly<{
  query: string;
  page: FoodTabPage;
  /** The page over the log shows while the tab is focused and, for a logged entry's details or
   * Daily macros, the food log is loaded. Away, it keeps its state. */
  sheet: boolean;
  /** The page's current step. Each new step starts at the top of the page. */
  step: string;
  /** Resumable drafts are offered unless a draft is already open. */
  resumable: boolean;
  /** Counts returns to the top of the food log. */
  logTop: number;
  /** The one logged entry being removed, if any. */
  removal: FoodEntryRemoval | null;
  /** A food-log or catalog write, or an entry's removal from its confirmation on, locks
   * search, resuming and logged entries. */
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
  let removal: FoodEntryRemoval | null = null;
  let sequence = 0;
  let running = false;
  let detach: (() => void) | undefined;
  let detachFlow: (() => void) | undefined;
  let snapshot = build();

  function build(): FoodTabSnapshot {
    const saved = log.getSnapshot();
    const custom = catalog.getSnapshot();
    const busy = saved.saving || custom.saving || removal?.state === "removing";
    const needsLog = page.kind === "macros" || (page.kind === "detail" && page.origin === "entry");
    return {
      query,
      page,
      sheet: focused && page.kind !== "log" && (!needsLog || saved.state.kind === "ready"),
      step: stepOf(page),
      resumable: !(
        page.kind === "resume" ||
        page.kind === "import" ||
        (page.kind === "detail" && page.editor)
      ),
      logTop,
      removal,
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
      next.sheet === snapshot.sheet &&
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
  /** Closes an entry's confirmation unless its removal is running. */
  function disarm() {
    if (removal?.state !== "removing") removal = null;
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
      disarm();
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
      disarm();
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
      disarm();
      showDetail("entry", { kind: "edit", entry });
    },
    /** Opens a logged entry's removal confirmation; another closed confirmation closes. */
    armRemoval(id: string) {
      if (snapshot.busy) return;
      removal = { id, date: day, state: "armed" };
      publish();
    },
    cancelRemoval() {
      if (removal?.state === "removing") return;
      removal = null;
      publish();
    },
    /**
     * Removes the armed entry. Everything that writes stays locked from here until the removal
     * settles, `leave` (the entry's fade) included, so another entry can't start in between.
     * A refused removal stays armed; one that throws stays armed with its failure.
     */
    async confirmRemoval(leave: () => Promise<void> = async () => {}) {
      if (!removal || removal.state === "removing" || snapshot.busy) return false;
      const attempt: FoodEntryRemoval = { ...removal, state: "removing" };
      removal = attempt;
      publish();
      let removed = false;
      let failed = false;
      try {
        await leave();
        removed = await log.remove({ date: attempt.date, id: attempt.id });
      } catch {
        failed = true;
      }
      removal = removed ? null : { ...attempt, state: failed ? "failed" : "armed" };
      publish();
      return removed;
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
