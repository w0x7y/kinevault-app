import type { CatalogDrafts } from "./catalog-drafts.ts";
import type { BrandedProduct } from "./product-model.ts";

export type ProductImportState =
  | { kind: "scanner" }
  | { kind: "loading"; barcode: string }
  | { kind: "missing"; barcode: string }
  | { kind: "error"; barcode: string; message: string }
  | { kind: "draft" };
type Context = { active: boolean; scopeKey: string };
type Lookup = {
  lookupProduct(input: { barcode: string; signal: AbortSignal }): Promise<BrandedProduct | null>;
};

/** One Scan journey. Catalog drafts own editable input; this owner only adopts it. */
export function createProductImportFlow({
  lookup,
  drafts,
}: {
  lookup: Lookup;
  drafts: Pick<CatalogDrafts, "open">;
}) {
  let state: ProductImportState = { kind: "scanner" };
  let running = false;
  let context: Context | undefined;
  let request: AbortController | undefined;
  let intention = 0;
  const listeners = new Set<() => void>();
  function publish(next: ProductImportState) {
    state = next;
    listeners.forEach((listener) => listener());
  }
  function invalidate() {
    // Abort dispatches adapter callbacks synchronously. A newer intention must
    // win even before its replacement controller or snapshot has been installed.
    const id = ++intention;
    const previous = request;
    request = undefined;
    previous?.abort();
    return id;
  }
  function interrupt() {
    const id = invalidate();
    if (id === intention && state.kind === "loading")
      publish({
        kind: "error",
        barcode: state.barcode,
        message: "Lookup cancelled. Retry when you're ready.",
      });
  }
  async function lookupBarcode(barcode: string) {
    if (!running || !context?.active) return;
    const id = invalidate();
    if (id !== intention) return;
    const controller = new AbortController();
    request = controller;
    const current = () =>
      running && id === intention && request === controller && !controller.signal.aborted;
    publish({ kind: "loading", barcode });
    if (!current()) return;
    try {
      const product = await lookup.lookupProduct({ barcode, signal: controller.signal });
      if (!current()) return;
      if (!product) {
        request = undefined;
        publish({ kind: "missing", barcode });
        return;
      }
      drafts.open({
        kind: "import",
        volumeBased: product.volumeBased,
        draft: {
          ...product.draft,
          brand: product.brand,
          importSource: {
            provider: "open-food-facts",
            barcode: product.barcode,
            method: "barcode",
          },
        },
      });
      if (!current()) return;
      request = undefined;
      publish({ kind: "draft" });
    } catch (error) {
      if (!current()) return;
      request = undefined;
      publish({
        kind: "error",
        barcode,
        message:
          error instanceof Error
            ? error.message
            : "Couldn't look up this product. Try again or enter it manually.",
      });
    }
  }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    start() {
      running = true;
    },
    stop() {
      running = false;
      interrupt();
    },
    setContext(next: Context) {
      const changed =
        context && (context.active !== next.active || context.scopeKey !== next.scopeKey);
      context = { ...next };
      if (changed) interrupt();
    },
    lookupBarcode,
    retry() {
      return state.kind === "error" ? lookupBarcode(state.barcode) : Promise.resolve();
    },
    enterManually() {
      if (!running || (state.kind !== "missing" && state.kind !== "error")) return;
      const barcode = state.barcode;
      const id = invalidate();
      if (id !== intention) return;
      drafts.open({
        kind: "import",
        volumeBased: false,
        draft: {
          name: "",
          brand: "",
          servingGrams: "100",
          calories: "",
          carbs: "",
          protein: "",
          fat: "",
          importSource: { provider: "manual", barcode, method: "barcode" },
        },
      });
      if (running && id === intention) publish({ kind: "draft" });
    },
    scanAgain() {
      if (!running) return;
      const id = invalidate();
      if (id === intention) publish({ kind: "scanner" });
    },
    cancel() {
      running = false;
      const id = invalidate();
      if (id === intention) publish({ kind: "scanner" });
    },
  };
}
