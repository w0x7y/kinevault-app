import assert from "node:assert/strict";
import test from "node:test";
import { createCatalogDrafts } from "../src/food/catalog-drafts.ts";
import { createProductImportFlow } from "../src/food/product-import-flow.ts";
import type { BrandedProduct } from "../src/food/product-model.ts";

const barcode = "3017620422003";
const otherBarcode = "7290004131074";
const context = { active: true, scopeKey: "2026-10-02" };
function product(code = barcode): BrandedProduct {
  return {
    barcode: code,
    name: "Cereal",
    brand: "Label brand",
    volumeBased: false,
    draft: {
      name: "Cereal",
      servingGrams: "100",
      calories: "300",
      carbs: "45",
      protein: "10",
      fat: "",
      details: { fiber: "0" },
    },
  };
}
function fixture() {
  const drafts = createCatalogDrafts();
  const requests: {
    barcode: string;
    signal: AbortSignal;
    resolve: (value: BrandedProduct | null) => void;
    reject: (error: unknown) => void;
  }[] = [];
  // Deliberately ignores abort: stale-response exclusion belongs to the workflow.
  const lookup = {
    lookupProduct(input: { barcode: string; signal: AbortSignal }) {
      return new Promise<BrandedProduct | null>((resolve, reject) =>
        requests.push({ ...input, resolve, reject }),
      );
    },
  };
  const flow = createProductImportFlow({ lookup, drafts });
  function start() {
    flow.start();
    flow.setContext(context);
  }
  return { flow, drafts, requests, start, lookup };
}
function foodSession(drafts: ReturnType<typeof createCatalogDrafts>) {
  const session = drafts.getSnapshot().session;
  assert.equal(session?.kind, "food");
  if (!session || session.kind !== "food") throw new Error("Expected a food draft");
  return session;
}

test("construction is inert, snapshots are stable, and subscription cleanup works", async () => {
  const { flow, drafts, requests, start } = fixture();
  const initial = flow.getSnapshot();
  assert.equal(flow.getSnapshot(), initial);
  await flow.lookupBarcode(barcode);
  flow.enterManually();
  flow.scanAgain();
  assert.equal(requests.length, 0);
  assert.equal(drafts.getSnapshot().session, null);
  let updates = 0;
  const unsubscribe = flow.subscribe(() => updates++);
  start();
  start();
  assert.equal(flow.getSnapshot(), initial);
  const pending = flow.lookupBarcode(barcode);
  assert.equal(updates, 1);
  requests[0].resolve(null);
  await pending;
  assert.equal(updates, 2);
  unsubscribe();
  flow.scanAgain();
  assert.equal(updates, 2);
});

test("review adopts provider values and provenance through the real Catalog draft owner", async () => {
  const { flow, drafts, requests, start } = fixture();
  drafts.setMealIntent("dinner");
  start();
  const pending = flow.lookupBarcode(barcode);
  const result = { ...product(), volumeBased: true };
  requests[0].resolve(result);
  await pending;
  assert.deepEqual(flow.getSnapshot(), { kind: "draft" });
  const session = foodSession(drafts);
  assert.equal(session.mealIntent, "dinner");
  assert.equal(session.volumeBased, true);
  assert.deepEqual(session.draft, {
    ...result.draft,
    brand: result.brand,
    importSource: { provider: "open-food-facts", barcode, method: "barcode" },
  });
  assert.equal(drafts.getSnapshot().resumable.length, 1);
  result.draft.name = "Changed adapter result";
  assert.equal(foodSession(drafts).draft.name, "Cereal");
});

for (const outcome of ["resolve", "reject"] as const) {
  test(`overlapping lookup ignores old ${outcome} after the replacement adopts a draft`, async () => {
    const { flow, drafts, requests, start } = fixture();
    start();
    const first = flow.lookupBarcode(barcode);
    const second = flow.lookupBarcode(otherBarcode);
    assert.equal(requests[0].signal.aborted, true);
    assert.equal(requests[1].signal.aborted, false);
    requests[1].resolve(product(otherBarcode));
    await second;
    const adopted = foodSession(drafts);
    if (outcome === "resolve") requests[0].resolve(product());
    else requests[0].reject(new Error("Old error"));
    await first;
    assert.deepEqual(flow.getSnapshot(), { kind: "draft" });
    assert.equal(foodSession(drafts), adopted);
    assert.equal(drafts.getSnapshot().resumable.length, 1);
  });

  for (const interruption of ["cancel", "stop", "day", "inactive", "scan"] as const) {
    test(`${interruption} prevents late ${outcome} from reopening review`, async () => {
      const { flow, drafts, requests, start } = fixture();
      start();
      const pending = flow.lookupBarcode(barcode);
      switch (interruption) {
        case "cancel":
          flow.cancel();
          break;
        case "stop":
          flow.stop();
          break;
        case "day":
          flow.setContext({ ...context, scopeKey: "2026-10-01" });
          break;
        case "inactive":
          flow.setContext({ ...context, active: false });
          break;
        case "scan":
          flow.scanAgain();
          break;
      }
      assert.equal(requests[0].signal.aborted, true);
      const interrupted = flow.getSnapshot();
      if (interruption === "cancel" || interruption === "scan")
        assert.equal(interrupted.kind, "scanner");
      else
        assert.deepEqual(interrupted, {
          kind: "error",
          barcode,
          message: "Lookup cancelled. Retry when you're ready.",
        });
      if (outcome === "resolve") requests[0].resolve(product());
      else requests[0].reject(new Error("Late failure"));
      await pending;
      assert.equal(flow.getSnapshot(), interrupted);
      assert.equal(drafts.getSnapshot().session, null);
      assert.equal(drafts.getSnapshot().resumable.length, 0);
    });
  }
}

test("unchanged lifecycle facts do not interrupt a request; inactive retry waits for activity", async () => {
  const { flow, drafts, requests, start } = fixture();
  start();
  const first = flow.lookupBarcode(barcode);
  const loading = flow.getSnapshot();
  flow.setContext({ ...context });
  assert.equal(flow.getSnapshot(), loading);
  assert.equal(requests[0].signal.aborted, false);
  flow.setContext({ ...context, active: false });
  await flow.retry();
  await flow.lookupBarcode(otherBarcode);
  assert.equal(requests.length, 1);
  flow.setContext(context);
  const retry = flow.retry();
  assert.equal(requests.length, 2);
  assert.equal(requests[1].barcode, barcode);
  requests[0].resolve(product());
  await first;
  assert.equal(flow.getSnapshot().kind, "loading");
  assert.equal(drafts.getSnapshot().session, null);
  requests[1].resolve(product());
  await retry;
  assert.equal(flow.getSnapshot().kind, "draft");
});

test("lookup failure retries the same barcode and missing entry adopts blank manual provenance", async () => {
  const { flow, drafts, requests, start } = fixture();
  start();
  const first = flow.lookupBarcode(barcode);
  requests[0].reject(new Error("Provider unavailable"));
  await first;
  assert.deepEqual(flow.getSnapshot(), { kind: "error", barcode, message: "Provider unavailable" });
  const retry = flow.retry();
  assert.equal(requests[1].barcode, barcode);
  requests[1].resolve(null);
  await retry;
  assert.deepEqual(flow.getSnapshot(), { kind: "missing", barcode });
  assert.equal(drafts.getSnapshot().session, null);
  flow.enterManually();
  assert.deepEqual(flow.getSnapshot(), { kind: "draft" });
  assert.equal(foodSession(drafts).volumeBased, false);
  assert.deepEqual(foodSession(drafts).draft, {
    name: "",
    brand: "",
    servingGrams: "100",
    calories: "",
    carbs: "",
    protein: "",
    fat: "",
    details: undefined,
    importSource: { provider: "manual", barcode, method: "barcode" },
  });
});

test("manual entry works after unknown lookup errors and cannot interrupt loading", async () => {
  const { flow, drafts, requests, start } = fixture();
  start();
  const pending = flow.lookupBarcode(barcode);
  flow.enterManually();
  assert.equal(flow.getSnapshot().kind, "loading");
  assert.equal(drafts.getSnapshot().session, null);
  requests[0].reject("Unexpected rejection");
  await pending;
  assert.deepEqual(flow.getSnapshot(), {
    kind: "error",
    barcode,
    message: "Couldn't look up this product. Try again or enter it manually.",
  });
  flow.enterManually();
  assert.equal(foodSession(drafts).draft.importSource?.provider, "manual");
});

for (const outcome of ["resolve", "reject"] as const) {
  test(`stop/start survives StrictMode replay and excludes a previous lifecycle's ${outcome}`, async () => {
    const { flow, drafts, requests, start } = fixture();
    start();
    flow.stop();
    start();
    assert.equal(requests.length, 0);
    const first = flow.lookupBarcode(barcode);
    flow.stop();
    flow.stop();
    await flow.retry();
    assert.equal(requests.length, 1);
    start();
    assert.equal(flow.getSnapshot().kind, "error");
    const second = flow.retry();
    if (outcome === "resolve") requests[0].resolve(product());
    else requests[0].reject(new Error("Previous lifecycle"));
    await first;
    assert.equal(flow.getSnapshot().kind, "loading");
    assert.equal(drafts.getSnapshot().session, null);
    requests[1].resolve(product());
    await second;
    assert.equal(flow.getSnapshot().kind, "draft");
  });
}

test("reviewed edits survive activity/day interruption, stop/restart, cancellation and a new Scan journey", async () => {
  const { flow, drafts, requests, start, lookup } = fixture();
  start();
  const pending = flow.lookupBarcode(barcode);
  requests[0].resolve(product());
  await pending;
  const session = foodSession(drafts);
  drafts.changeFood(session.handle, {
    ...session.draft,
    name: "Reviewed label",
    calories: "321",
    details: { fiber: "7" },
  });
  const edited = foodSession(drafts);
  flow.setContext({ active: false, scopeKey: "2026-10-01" });
  flow.stop();
  start();
  assert.equal(flow.getSnapshot().kind, "draft");
  assert.equal(foodSession(drafts), edited);
  flow.cancel();
  assert.equal(foodSession(drafts), edited);
  const reopened = createProductImportFlow({ lookup, drafts });
  reopened.start();
  reopened.setContext(context);
  assert.equal(reopened.getSnapshot().kind, "scanner");
  const refreshed = reopened.lookupBarcode(barcode);
  requests[1].resolve(product());
  await refreshed;
  assert.equal(reopened.getSnapshot().kind, "draft");
  assert.equal(foodSession(drafts), edited);
  assert.equal(drafts.getSnapshot().resumable.length, 1);
});

test("manual retained edits stay separate from reviewed provider drafts for the same barcode", async () => {
  const { flow, drafts, requests, start } = fixture();
  start();
  const missing = flow.lookupBarcode(barcode);
  requests[0].resolve(null);
  await missing;
  flow.enterManually();
  const manual = foodSession(drafts);
  drafts.changeFood(manual.handle, { ...manual.draft, name: "My label" });
  flow.scanAgain();
  const found = flow.lookupBarcode(barcode);
  requests[1].resolve(product());
  await found;
  assert.equal(foodSession(drafts).draft.importSource?.provider, "open-food-facts");
  flow.scanAgain();
  const missingAgain = flow.lookupBarcode(barcode);
  requests[2].resolve(null);
  await missingAgain;
  flow.enterManually();
  assert.equal(foodSession(drafts).handle, manual.handle);
  assert.equal(foodSession(drafts).draft.name, "My label");
  assert.equal(foodSession(drafts).draft.importSource?.provider, "manual");
  assert.equal(drafts.getSnapshot().resumable.length, 2);
});

test("a loading subscriber can cancel before the adapter starts work", async () => {
  const { flow, drafts, requests, start } = fixture();
  start();
  flow.subscribe(() => {
    if (flow.getSnapshot().kind === "loading") flow.cancel();
  });
  await flow.lookupBarcode(barcode);
  assert.equal(requests.length, 0);
  assert.equal(flow.getSnapshot().kind, "scanner");
  assert.equal(drafts.getSnapshot().session, null);
});

for (const manual of [false, true]) {
  test(`Catalog adoption can cancel the ${manual ? "manual" : "provider"} journey without reopening review`, async () => {
    const { flow, drafts, requests, start } = fixture();
    start();
    drafts.subscribe(() => flow.cancel());
    const pending = flow.lookupBarcode(barcode);
    requests[0].resolve(manual ? null : product());
    await pending;
    if (manual) flow.enterManually();
    assert.equal(flow.getSnapshot().kind, "scanner");
    assert.equal(drafts.getSnapshot().resumable.length, 1);
  });
}

for (const outcome of ["resolve", "reject"] as const) {
  for (const interruption of ["cancel", "stop", "inactive", "day"] as const) {
    test(`replacement abort listener ${interruption} wins before adapter work and late ${outcome}`, async () => {
      const { flow, drafts, requests, start } = fixture();
      start();
      const first = flow.lookupBarcode(barcode);
      requests[0].signal.addEventListener(
        "abort",
        () => {
          switch (interruption) {
            case "cancel":
              flow.cancel();
              break;
            case "stop":
              flow.stop();
              break;
            case "inactive":
              flow.setContext({ ...context, active: false });
              break;
            case "day":
              flow.setContext({ ...context, scopeKey: "2026-10-01" });
              break;
          }
        },
        { once: true },
      );
      const replacement = flow.lookupBarcode(otherBarcode);
      const winning = flow.getSnapshot();
      const expected =
        interruption === "cancel"
          ? { kind: "scanner" }
          : { kind: "error", barcode, message: "Lookup cancelled. Retry when you're ready." };
      // Settle even an erroneously issued replacement so the regression cannot hang.
      if (outcome === "resolve") requests[0].resolve(product());
      else requests[0].reject(new Error("Late first request"));
      requests.slice(1).forEach((request) => request.resolve(product(otherBarcode)));
      await Promise.all([first, replacement]);
      assert.deepEqual(winning, expected);
      assert.equal(requests.length, 1);
      assert.equal(flow.getSnapshot(), winning);
      assert.equal(drafts.getSnapshot().session, null);
      assert.equal(drafts.getSnapshot().resumable.length, 0);
    });
  }

  test(`scanAgain abort listener stop keeps the retryable barcode through late ${outcome} and restart`, async () => {
    const { flow, drafts, requests, start } = fixture();
    start();
    const pending = flow.lookupBarcode(barcode);
    requests[0].signal.addEventListener("abort", () => flow.stop(), { once: true });
    flow.scanAgain();
    const interrupted = flow.getSnapshot();
    if (outcome === "resolve") requests[0].resolve(product());
    else requests[0].reject(new Error("Late scan"));
    await pending;
    assert.deepEqual(interrupted, {
      kind: "error",
      barcode,
      message: "Lookup cancelled. Retry when you're ready.",
    });
    assert.equal(flow.getSnapshot(), interrupted);
    assert.equal(drafts.getSnapshot().session, null);
    start();
    const retry = flow.retry();
    assert.equal(requests.length, 2);
    assert.equal(requests[1].barcode, barcode);
    requests[1].resolve(product());
    await retry;
    assert.equal(flow.getSnapshot().kind, "draft");
  });
}
