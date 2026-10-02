import assert from "node:assert/strict";
import test from "node:test";
import { normalizeProductBarcode } from "../src/food/barcode.ts";
import { parseBrandedProduct } from "../src/food/product-model.ts";
import { OpenFoodFactsClient } from "../src/food/product-provider.ts";

const barcode = "3017620422003";
const product = { code: barcode, product_name: "Nutella", brands: "Ferrero", nutriments: {
  "energy-kcal_100g": 539, carbohydrates_100g: 57.5, proteins_100g: 6.3, fat_100g: 30.9,
} };
const lookup = (item: unknown = product) => new Response(JSON.stringify({ status: 1, product: item }));

test("standard barcode validation preserves leading zeros and rejects URLs, wrong formats and bad checksums", () => {
  assert.equal(normalizeProductBarcode(" 3017620422003 ", "ean13"), barcode);
  assert.equal(normalizeProductBarcode("0034000470693", "ean13"), "0034000470693");
  assert.equal(normalizeProductBarcode("034000470693", "upc_a"), "034000470693");
  assert.equal(normalizeProductBarcode("96385074", "ean8"), "96385074");
  assert.equal(normalizeProductBarcode("03017620422003", "itf14"), "03017620422003");
  for (const value of ["3017620422004", "00000000", "123", "https://example.com/3017620422003", "3017 620422003"]) {
    assert.equal(normalizeProductBarcode(value), null);
  }
  assert.equal(normalizeProductBarcode(barcode, "qr"), null);
  assert.equal(normalizeProductBarcode("96385074", "upc_e"), null);
  assert.equal(normalizeProductBarcode("034000470693", "ean13"), null);
});

test("UPC-E expands each zero-suppression pattern and validates the UPC-A check digit", () => {
  for (const [short, full] of [
    ["04252614", "042100005264"], ["01234505", "012000003455"],
    ["01234523", "012200003453"], ["01234531", "012300000451"],
    ["01234543", "012340000053"], ["01234558", "012345000058"],
    ["11234562", "112345000062"],
  ]) assert.equal(normalizeProductBarcode(short, "upc_e"), full);
  assert.equal(normalizeProductBarcode("04252615", "upc_e"), null);
  assert.equal(normalizeProductBarcode("24252614", "upc_e"), null);
  assert.equal(normalizeProductBarcode("4252614", "upc_e"), null);
  assert.equal(normalizeProductBarcode("04252614", "ean8"), null);
});

test("product nutrition uses normalized units, preserves zero and leaves missing or malformed nutrients blank", () => {
  const result = parseBrandedProduct({ ...product, nutriments: {
    "energy-kj_100g": 418.4, "carbohydrates-total_100g": 12, carbohydrates_100g: 9,
    proteins_100g: 0, fat_100g: "", sodium_100g: 0.0428, sodium_unit: "mg",
    cholesterol_100g: 0.01, "vitamin-d_100g": 0.000005, calcium_100g: "0.12",
    fiber_100g: null, sugars_100g: false, "saturated-fat_100g": -1,
    caffeine_100g: Infinity, alcohol_100g: 5, alcohol_unit: "% vol",
  } });
  assert.ok(result);
  assert.equal(result.draft.servingGrams, "100");
  assert.equal(result.draft.calories, "100");
  assert.equal(result.draft.carbs, "12");
  assert.equal(result.draft.protein, "0");
  assert.equal(result.draft.fat, "");
  assert.deepEqual(result.draft.details, {
    sodium: "42.8", cholesterol: "10", vitaminD: "5", calcium: "120",
  });
  assert.equal(result.volumeBased, false);
});

test("volume-based or explicitly absent nutrition is never presented as per-gram nutrition", () => {
  for (const patch of [{ product_quantity_unit: "ml" }, { serving_quantity_unit: "ml" },
    { quantity: "1 L" }, { quantity: "6 × 330 ml" }, { serving_size: "250 mL" },
    { no_nutrition_data: "on" }]) {
    const result = parseBrandedProduct({ ...product, ...patch });
    assert.ok(result);
    assert.deepEqual(result.draft, { name: "Nutella", servingGrams: "100", calories: "", carbs: "", protein: "", fat: "", details: {} });
  }
  assert.equal(parseBrandedProduct({ ...product, serving_quantity: 15, serving_quantity_unit: "g" })?.draft.calories, "539");
});

test("incomplete product labels remain editable while malformed records are filtered", () => {
  const result = parseBrandedProduct({ code: barcode });
  assert.ok(result);
  assert.equal(result.name, `Product ${barcode}`);
  assert.equal(result.brand, "");
  assert.equal(result.draft.protein, "");
  for (const value of [null, [], "food", {}, { code: 3017620422003 }, { ...product, code: "3017620422004" }]) {
    assert.equal(parseBrandedProduct(value), null);
  }
});

test("lookup distinguishes absent products from HTTP and malformed-provider failures without retrying", async () => {
  const absent = new OpenFoodFactsClient({ fetch: async () => new Response(JSON.stringify({ status: 0, status_verbose: "product not found" })) });
  assert.equal(await absent.lookupProduct({ barcode }), null);
  const absent404 = new OpenFoodFactsClient({ fetch: async () => new Response(JSON.stringify({ status: 0 }), { status: 404 }) });
  assert.equal(await absent404.lookupProduct({ barcode }), null);
  for (const response of [new Response("busy", { status: 503 }), new Response("bad json"),
    new Response(JSON.stringify({ status: 1 })), new Response(JSON.stringify({ status: 1, product: null }))]) {
    let calls = 0;
    const client = new OpenFoodFactsClient({ fetch: async () => { calls++; return response; } });
    await assert.rejects(client.lookupProduct({ barcode }));
    assert.equal(calls, 1);
  }
});

test("cached imports stay independent from edited drafts and expire before refetching", async () => {
  let now = 0;
  let calls = 0;
  const client = new OpenFoodFactsClient({ now: () => now, fetch: async () => { calls++; return lookup(); } });
  const first = await client.lookupProduct({ barcode });
  assert.ok(first);
  first.draft.protein = "999";
  assert.equal((await client.lookupProduct({ barcode }))?.draft.protein, "6.3");
  assert.equal(calls, 1);
  now = 300_001;
  assert.equal((await client.lookupProduct({ barcode }))?.draft.protein, "6.3");
  assert.equal(calls, 2);
});

test("lookup has a rolling budget and failures consume issued requests", async () => {
  let now = 0;
  let calls = 0;
  const client = new OpenFoodFactsClient({ now: () => now, fetch: async () => { calls++; return new Response("unavailable", { status: 503 }); } });
  for (let index = 0; index < 15; index++) await assert.rejects(client.lookupProduct({ barcode }));
  await assert.rejects(client.lookupProduct({ barcode }), /wait|minute|limit/i);
  assert.equal(calls, 15);
  now = 60_001;
  await assert.rejects(client.lookupProduct({ barcode }), /503/);
  assert.equal(calls, 16);
});

test("aborted callers and timed-out requests cannot publish or cache late responses", async () => {
  let finish: (response: Response) => void = () => { throw new Error("request not started"); };
  const controller = new AbortController();
  const client = new OpenFoodFactsClient({ fetch: () => new Promise(resolve => { finish = resolve; }) });
  const pending = client.lookupProduct({ barcode, signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
  finish(lookup());
  await Promise.resolve();
  await assert.rejects(client.lookupProduct({ barcode, signal: controller.signal }), { name: "AbortError" });
  const timeout = new OpenFoodFactsClient({ timeoutMs: 5, fetch: () => new Promise(() => {}) });
  await assert.rejects(timeout.lookupProduct({ barcode }), /timed out/i);
});

test("hexadecimal numeric strings and volume percentages are not imported as nutrient amounts", () => {
  const result = parseBrandedProduct({ ...product, nutriments: { fat_100g: "0x10", proteins_100g: "1e999", sodium_100g: true, fiber_100g: " 0 " } });
  assert.ok(result);
  assert.equal(result.draft.fat, "");
  assert.equal(result.draft.protein, "");
  assert.deepEqual(result.draft.details, { fiber: "0" });
});

test("a cancelled request does not populate the cache even when the transport resolves late", async () => {
  let finish: (response: Response) => void = () => {};
  let calls = 0;
  const client = new OpenFoodFactsClient({ fetch: async () => {
    calls++;
    if (calls === 1) return new Promise(resolve => { finish = resolve; });
    return lookup({ ...product, product_name: "Current product" });
  } });
  const controller = new AbortController();
  const pending = client.lookupProduct({ barcode, signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
  finish(lookup({ ...product, product_name: "Stale product" }));
  await Promise.resolve();
  assert.equal((await client.lookupProduct({ barcode }))?.name, "Current product");
  assert.equal(calls, 2);
});

test("cancelling a cached not-found lookup still rejects instead of publishing stale absence", async () => {
  const client = new OpenFoodFactsClient({ fetch: async () => new Response(JSON.stringify({ status: 0 })) });
  assert.equal(await client.lookupProduct({ barcode }), null);
  const controller = new AbortController();
  const cached = client.lookupProduct({ barcode, signal: controller.signal });
  controller.abort();
  await assert.rejects(cached, { name: "AbortError" });
});

test("tiny known nutrition remains a decimal accepted by the editable form", () => {
  assert.equal(parseBrandedProduct({ ...product, nutriments: { fat_100g: 1e-8 } })?.draft.fat, "0.00000001");
});

test("a valid barcode lookup cannot return a different product identity", async () => {
  const client = new OpenFoodFactsClient({ fetch: async () => lookup({ ...product, code: "0034000470693" }) });
  await assert.rejects(client.lookupProduct({ barcode }), /invalid product data/i);
});

test("bounded cache evicts old entries before their freshness period ends", async () => {
  let now = 0;
  let calls = 0;
  const client = new OpenFoodFactsClient({ now: () => now, fetch: async (url) => {
    calls++;
    const requested = new URL(url).pathname.split("/").at(-1)?.replace(".json", "");
    return lookup({ ...product, code: requested });
  } });
  // Independent fixture generator for a batch of distinct GTINs, not the production validator.
  const fixtures = Array.from({ length: 51 }, (_, index) => {
    const payload = String(900000000000 + index);
    const sum = [...payload].reduce((total, digit, position) => total + Number(digit) * (position % 2 === 0 ? 1 : 3), 0);
    return payload + String((10 - sum % 10) % 10);
  });
  for (let batch = 0; batch < 4; batch++) {
    for (const code of fixtures.slice(batch * 15, (batch + 1) * 15)) await client.lookupProduct({ barcode: code });
    now += 60_001;
  }
  assert.equal(calls, 51);
  await client.lookupProduct({ barcode: fixtures[1] });
  assert.equal(calls, 51);
  await client.lookupProduct({ barcode: fixtures[0] });
  assert.equal(calls, 52);
});

test("browser transport failures show a useful connection error without retrying", async () => {
  let calls = 0;
  const client = new OpenFoodFactsClient({ fetch: async () => {
    calls++;
    throw new TypeError("Failed to fetch");
  } });
  await assert.rejects(client.lookupProduct({ barcode }), {
    message: "Could not reach Open Food Facts. Check your connection or try again later.",
  });
  assert.equal(calls, 1);
});

test("barcode lookup sends only the requested product endpoint with provider identity", async () => {
  const requests: string[] = [];
  let identity = "";
  const client = new OpenFoodFactsClient({ fetch: async (url, init) => {
    requests.push(url);
    identity = new Headers(init?.headers).get("X-User-Agent") ?? "";
    return lookup();
  } });
  assert.equal((await client.lookupProduct({ barcode }))?.barcode, barcode);
  assert.equal(requests.length, 1);
  const request = new URL(requests[0]!);
  assert.equal(request.origin, "https://world.openfoodfacts.org");
  assert.equal(request.pathname, `/api/v2/product/${barcode}.json`);
  assert.match(identity, /KineVaultTrack\/1\.0/);
});


test("field-projected barcode lookup preserves beverage per-100ml nutrition and rejects volume sauce classification", async () => {
  const label = { code: barcode, product_name: "Label product", quantity: "330 ml", categories_tags: ["en:beverages"], nutriments: {
    "energy-kcal_100g": 40, carbohydrates_100g: 10, proteins_100g: 0, fat_100g: 0,
    calcium_100g: 0.12, sodium_100g: 0, "vitamin-d_100g": 0.000005,
  } };
  for (const categories_tags of [["en:beverages"], ["en:sauces"]]) {
    const source = { ...label, categories_tags };
    const client = new OpenFoodFactsClient({ fetch: async url => {
      const requested = new URL(url).searchParams.get("fields")?.split(",") ?? [];
      return lookup(Object.fromEntries(Object.entries(source).filter(([key]) => requested.includes(key))));
    } });
    const result = await client.lookupProduct({ barcode });
    assert.ok(result);
    assert.equal(result.volumeBased, true);
    if (categories_tags[0] === "en:beverages") {
      assert.equal(result.draft.drink, true);
      assert.equal(result.draft.calories, "40");
      assert.equal(result.draft.carbs, "10");
      assert.equal(result.draft.protein, "0");
      assert.equal(result.draft.fat, "0");
      assert.deepEqual(result.draft.details, { calcium: "120", sodium: "0", vitaminD: "5" });
    } else {
      assert.equal(result.draft.drink, undefined);
      for (const key of ["calories", "carbs", "protein", "fat"] as const) assert.equal(result.draft[key], "");
      assert.deepEqual(result.draft.details, {});
    }
  }
});
