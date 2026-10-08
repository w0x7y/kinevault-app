import { installAccountFixture } from "./helpers/account-fixture.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";

const baseURL = process.env.KINE_PREVIEW_URL || "http://localhost:8081";
const storageKey = "kinevault-track.custom-foods.v1";
const answers = {
  name: "Alex",
  goal: "maintain",
  activity: "moderate",
  age: "30",
  height: "180",
  weight: "80",
  sex: "male",
  estimateEnabled: true,
  eligible: true,
  customCalories: "",
};
const product = {
  code: "3017620422003",
  product_name: "Fixture cereal",
  brands: "FixtureBrand",
  nutriments: {
    "energy-kcal_100g": 300,
    carbohydrates_100g: 45,
    proteins_100g: 10,
    fat_100g: 5,
    sodium_100g: 0.1,
    fiber_100g: 0,
    "vitamin-d_100g": 0.000002,
  },
};
const button = (page, name) =>
  page.getByRole("button", {
    name: name === "Log food" || name === "Log meal" ? new RegExp(`^${name} to `) : name,
    exact: true,
  });
const field = (page, name) => page.getByRole("textbox", { name, exact: true });
const heading = (page, name) => page.getByRole("heading", { name, exact: true }).waitFor();
const catalog = (page) =>
  page.evaluate((key) => JSON.parse(window.accountFixture.getItem(key)), storageKey);
async function open(t, { deferredCamera = false, cameraMountError = false, foods = [] } = {}) {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(
    ({ answers, foods }) => {
      if (!sessionStorage.getItem("food-expansion-seeded")) {
        localStorage.clear();
        localStorage.setItem(
          "kinevault-track.profile.v1",
          JSON.stringify({ version: 1, kind: "complete", answers }),
        );
        localStorage.setItem(
          "kinevault-track.custom-foods.v1",
          JSON.stringify({ version: 1, foods, meals: [] }),
        );
        sessionStorage.setItem("food-expansion-seeded", "true");
      }
    },
    { answers, foods },
  );
  if (deferredCamera)
    await context.addInitScript(
      ({ cameraMountError }) => {
        const fixture = { requests: 0, tracks: [], resolvePermission: null };
        window.__foodCameraFixture = fixture;
        const stream = () => {
          const canvas = document.createElement("canvas");
          canvas.width = 320;
          canvas.height = 240;
          canvas.getContext("2d").fillRect(0, 0, 320, 240);
          const media = canvas.captureStream(1);
          fixture.tracks.push(...media.getTracks());
          return media;
        };
        navigator.mediaDevices.enumerateDevices = async () => [
          {
            kind: "videoinput",
            label: "Fixture back camera",
            deviceId: "fixture-back",
            groupId: "fixture",
          },
        ];
        navigator.mediaDevices.getUserMedia = async (constraints) => {
          assertNoAudio(constraints);
          fixture.requests++;
          if (fixture.requests === 1)
            return new Promise((resolve) => {
              fixture.resolvePermission = () => resolve(stream());
            });
          if (cameraMountError) throw new Error("Fixture camera mount failure after permission");
          return stream();
        };
        function assertNoAudio(constraints) {
          if (constraints.audio) throw new Error("Food scanner requested audio");
        }
        const original = navigator.permissions.query.bind(navigator.permissions);
        navigator.permissions.query = async (descriptor) =>
          descriptor.name === "camera" ? { state: "prompt" } : original(descriptor);
      },
      { cameraMountError },
    );
  await installAccountFixture(context);
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.setDefaultNavigationTimeout(30000);
  await page.goto(baseURL);
  await page.getByRole("tab", { name: "Food", exact: true }).click();
  await heading(page, "Daily food log");
  return page;
}
async function dismissCreated(page) {
  await page.getByText("Saved to your foods", { exact: true }).waitFor();
  assert.equal(await page.getByRole("dialog").count(), 0);
}
async function scan(page, code) {
  await button(page, "Scan food barcode").click();
  await heading(page, "Scan food barcode");
  await field(page, "Product barcode").fill(code);
  await button(page, "Look up barcode").click();
}
async function fillMacros(page) {
  for (const [name, value] of [
    ["Calories (kcal)", "200"],
    ["Carbs (g)", "30"],
    ["Protein (g)", "10"],
    ["Fat (g)", "4"],
  ])
    await field(page, name).fill(value);
}
const json = (route, body, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

test("detailed nutrients preserve collapsed drafts, validate, save/edit/reload and calculate meal overrides", async (t) => {
  const page = await open(t);
  await button(page, "Create food/meal").click();
  await field(page, "Food name").fill("Detailed oats");
  await fillMacros(page);
  await button(page, "More nutrients").click();
  await field(page, "Sodium (mg)").fill("-1");
  await field(page, "Fiber (g)").fill("0");
  await field(page, "Vitamins D (mcg)").fill("2");
  await button(page, "More nutrients").click();
  assert.equal(await field(page, "Sodium (mg)").count(), 0);
  await button(page, "Save food").click();
  await field(page, "Sodium (mg)").waitFor();
  assert.equal(await field(page, "Sodium (mg)").inputValue(), "-1");
  await page.getByRole("alert").filter({ hasText: "Enter a number" }).first().waitFor();
  assert.equal(await field(page, "Fiber (g)").inputValue(), "0");
  await field(page, "Sodium (mg)").fill("150");
  await button(page, "More nutrients").click();
  await button(page, "Save food").click();
  await dismissCreated(page);
  let saved = (await catalog(page)).foods[0];
  assert.equal(saved.details.sodium, 150);
  assert.equal(saved.details.fiber, 0);
  assert.equal(saved.details.calcium, null);
  await button(page, "Edit food").click();
  assert.equal(await field(page, "Sodium (mg)").inputValue(), "150");
  await field(page, "Sodium (mg)").fill("200");
  await button(page, "Save food changes").click();
  await heading(page, "Detailed oats");
  await button(page, "Log food").click();
  await heading(page, "Daily food log");
  await button(page, "View macros for the day").click();
  assert.match(await page.getByTestId("daily-nutrient-carbs").innerText(), /30/);
  await page.reload();
  await field(page, "Search foods").fill("Detailed oats");
  await button(page, "View nutrition for Detailed oats, custom food").click();
  await button(page, "Edit food").click();
  assert.equal(await field(page, "Sodium (mg)").inputValue(), "200");
  await button(page, "Cancel").click();
  await button(page, "Create food/meal").click();
  await page
    .getByTestId("food-creation-switch")
    .getByRole("button", { name: "Meal", exact: true })
    .click();
  await field(page, "Meal name").fill("Detailed bowl");
  await field(page, "Search ingredients").fill("Detailed oats");
  await button(page, "Add Detailed oats to meal, custom food").click();
  await button(page, "More nutrients").click();
  assert.equal(await field(page, "Sodium (mg)").inputValue(), "200");
  await field(page, "Sodium (mg)").fill("25");
  await field(page, "Calcium (mg)").fill("0");
  await field(page, "Sodium (mg)").fill("");
  await button(page, "More nutrients").click();
  await button(page, "Save meal").click();
  await page.getByText("Saved to your meals", { exact: true }).waitFor();
  assert.equal(await page.getByRole("dialog").count(), 0);
  let meal = (await catalog(page)).meals[0];
  assert.equal(meal.details.sodium, 200);
  assert.deepEqual(meal.detailOverrides, { calcium: 0 });
  await button(page, "Edit meal").click();
  await field(page, "Sodium (mg)").fill("25");
  await button(page, "Save meal changes").click();
  await heading(page, "Detailed bowl");
  await page.reload();
  await field(page, "Search foods").fill("Detailed bowl");
  await button(page, "View nutrition for Detailed bowl, custom meal").click();
  await button(page, "Edit meal").click();
  assert.equal(await field(page, "Sodium (mg)").inputValue(), "25");
  await button(page, "Use calculated detailed nutrients").click();
  assert.equal(await field(page, "Sodium (mg)").inputValue(), "200");
  await button(page, "Save meal changes").click();
  await heading(page, "Detailed bowl");
  meal = (await catalog(page)).meals[0];
  assert.equal(meal.details.calcium, null);
  assert.deepEqual(meal.detailOverrides ?? {}, {});
});

test("manual barcode lookup opens an editable unsaved draft, retries save and preserves scan badge and brand after reload", async (t) => {
  const page = await open(t);
  let requests = 0;
  await page.route("https://world.openfoodfacts.org/api/v2/product/**", (route) => {
    requests++;
    return json(route, { status: 1, product });
  });
  await scan(page, "https://example.com");
  await page.getByRole("alert").filter({ hasText: "valid EAN or UPC" }).waitFor();
  assert.equal(requests, 0);
  await field(page, "Product barcode").fill(product.code);
  await button(page, "Look up barcode").click();
  await heading(page, "Review imported food");
  assert.equal(requests, 1);
  assert.equal(await page.locator("video").count(), 0);
  assert.equal((await catalog(page))?.foods?.length ?? 0, 0);
  assert.equal(await field(page, "Calories (kcal)").inputValue(), "300");
  assert.equal(await field(page, "Fiber (g)").inputValue(), "0");
  assert.equal(await field(page, "Calcium (mg)").inputValue(), "");
  assert.equal(await field(page, "Sodium (mg)").inputValue(), "100");
  assert.equal(
    await page.getByRole("link", { name: "Data from Open Food Facts", exact: true }).count(),
    1,
  );
  await field(page, "Food name").fill("Renamed cereal");
  await field(page, "Brand (optional)").fill("EditedBrand");
  await field(page, "Carbs (g)").fill("40");
  await page.evaluate((key) => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (nextKey, value) {
      if (nextKey.endsWith(key)) {
        Storage.prototype.setItem = original;
        throw new Error("Fixture save failure");
      }
      return original.call(this, nextKey, value);
    };
  }, storageKey);
  await button(page, "Save food").click();
  await page.getByRole("alert").filter({ hasText: "Couldn't save" }).waitFor();
  assert.equal(await field(page, "Food name").inputValue(), "Renamed cereal");
  await button(page, "Save food").click();
  await dismissCreated(page);
  assert.equal(
    await page.evaluate(() => window.accountFixture.getItem("kinevault-track.food-log.v1")),
    null,
  );
  await page.reload();
  await field(page, "Search foods").fill("EditedBrand");
  await button(
    page,
    "View nutrition for Renamed cereal, custom food, imported by barcode",
  ).waitFor();
  assert.equal(await page.getByTestId("scanned-food-icon").count(), 1);
  await button(page, "View nutrition for Renamed cereal, custom food, imported by barcode").click();
  await button(page, "Edit food").click();
  assert.equal(await field(page, "Brand (optional)").inputValue(), "EditedBrand");
  await field(page, "Brand (optional)").fill("SecondBrand");
  await button(page, "Save food changes").click();
  await heading(page, "Renamed cereal");
  assert.equal((await catalog(page)).foods[0].importSource.method, "barcode");
});

test("barcode missing/error/retry/manual entry and cancellation never save or resurrect stale drafts", async (t) => {
  const page = await open(t);
  let fail = true;
  let release;
  let received;
  const pending = new Promise((resolve) => {
    received = resolve;
  });
  await page.route("https://world.openfoodfacts.org/api/v2/product/**", async (route) => {
    const code = /product\/(\d+)/.exec(route.request().url())[1];
    if (code === "7290004131074") {
      received();
      await new Promise((resolve) => {
        release = resolve;
      });
      return json(route, {
        status: 1,
        product: { ...product, code, product_name: "Stale milk" },
      }).catch(() => {});
    }
    if (fail) {
      fail = false;
      return json(route, {}, 503);
    }
    return json(route, { status: 0 });
  });
  await scan(page, product.code);
  await heading(page, "Barcode lookup failed");
  await button(page, "Retry barcode lookup").click();
  await heading(page, "Product not found");
  await button(page, "Enter food manually").click();
  assert.equal(await field(page, "Food name").inputValue(), "");
  assert.equal(await field(page, "Calories (kcal)").inputValue(), "");
  assert.equal(await page.getByRole("link", { name: "Data from Open Food Facts" }).count(), 0);
  await field(page, "Food name").fill("Manual scanned food");
  await fillMacros(page);
  await button(page, "Save food").click();
  await dismissCreated(page);
  assert.equal((await catalog(page)).foods[0].importSource.provider, "manual");
  await scan(page, "7290004131074");
  await pending;
  await field(page, "Search foods").fill("apple");
  release();
  await page.getByTestId("food-result").first().waitFor();
  assert.equal(await page.getByTestId("food-import-draft").count(), 0);
  assert.equal((await catalog(page)).foods.length, 1);
  await button(page, "Scan food barcode").click();
  await page.getByRole("tab", { name: "Home", exact: true }).click();
  await page.getByRole("tab", { name: "Food", exact: true }).click();
  assert.equal(await page.getByTestId("food-barcode-scanner").count(), 0);
});

test("barcode imports leave unknown and volume nutrition blank until reviewed", async (t) => {
  const page = await open(t);
  const volumeCode = "7290004131074";
  await page.route("**/api/v2/product/**", (route) => {
    const volume = route.request().url().includes(volumeCode);
    return json(route, {
      status: 1,
      product: volume
        ? { ...product, code: volumeCode, quantity: "1 L" }
        : { ...product, nutriments: { ...product.nutriments, fat_100g: null } },
    });
  });
  await scan(page, product.code);
  await heading(page, "Review imported food");
  assert.equal(await field(page, "Fat (g)").inputValue(), "");
  await button(page, "Save food").click();
  await page.getByRole("alert").filter({ hasText: "Enter a number" }).waitFor();
  await field(page, "Fat (g)").fill("0");
  await button(page, "Save food").click();
  await dismissCreated(page);
  assert.equal((await catalog(page)).foods[0].per100g.fat, 0);
  await scan(page, volumeCode);
  await page.getByText(/This product lists volume amounts/).waitFor();
  for (const name of ["Calories (kcal)", "Carbs (g)", "Protein (g)", "Fat (g)"])
    assert.equal(await field(page, name).inputValue(), "");
  await button(page, "Cancel").click();
  assert.equal((await catalog(page)).foods.length, 1);
});

test("day changes and tab blur cancel pending barcode requests and retain editable import drafts", async (t) => {
  const page = await open(t);
  let release;
  let received;
  let fulfilled;
  let started = new Promise((resolve) => {
    received = resolve;
  });
  let finished = new Promise((resolve) => {
    fulfilled = resolve;
  });
  await page.route("**/api/v2/product/**", async (route) => {
    received();
    await new Promise((resolve) => {
      release = resolve;
    });
    await json(route, { status: 1, product }).catch(() => {});
    fulfilled();
  });
  await scan(page, product.code);
  await started;
  await button(page, "Expand calendar").click();
  await button(page, "Select previous day").click();
  await button(page, "Collapse calendar").click();
  await button(page, "Retry barcode lookup").waitFor();
  release();
  await finished;
  assert.equal(await page.getByTestId("food-import-draft").count(), 0);

  started = new Promise((resolve) => {
    received = resolve;
  });
  finished = new Promise((resolve) => {
    fulfilled = resolve;
  });
  await button(page, "Retry barcode lookup").click();
  await started;
  await page.getByRole("tab", { name: "Home", exact: true }).click();
  release();
  await finished;
  await page.getByRole("tab", { name: "Food", exact: true }).click();
  await button(page, "Retry barcode lookup").waitFor();
  assert.equal(await page.getByTestId("food-import-draft").count(), 0);
  assert.equal((await catalog(page)).foods.length, 0);

  await page.route("**/api/v2/product/**", (route) => json(route, { status: 1, product }));
  await button(page, "Retry barcode lookup").click();
  await heading(page, "Review imported food");
  await field(page, "Food name").fill("Kept import draft");
  await button(page, "Expand calendar").click();
  await button(page, "Select previous day").click();
  await button(page, "Collapse calendar").click();
  assert.equal(await field(page, "Food name").inputValue(), "Kept import draft");
  await button(page, "Cancel").click();
  assert.equal((await catalog(page)).foods.length, 0);
});

test("deferred camera permission never mounts in background, resumes safely and releases its stream on cancel/background", async (t) => {
  const page = await open(t, { deferredCamera: true });
  const visibility = (value) =>
    page.evaluate((value) => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => value });
      document.dispatchEvent(new Event("visibilitychange"));
    }, value);
  await button(page, "Scan food barcode").click();
  await heading(page, "Scan food barcode");
  await page.waitForFunction(() => window.__foodCameraFixture.requests === 1);
  await visibility("hidden");
  await page.evaluate(() => window.__foodCameraFixture.resolvePermission());
  // Granted-hook rendering must settle while AppState still reports background.
  await page.waitForFunction(
    () =>
      document.querySelector('[data-testid="food-barcode-scanner"]') &&
      !document.querySelector('[aria-label="Allow camera"]'),
  );
  assert.equal(await page.locator("video").count(), 0);
  assert.equal(await page.evaluate(() => window.__foodCameraFixture.requests), 1);
  await visibility("visible");
  await page.locator("video").waitFor({ state: "attached" });
  await page.waitForFunction(() => window.__foodCameraFixture.requests > 1);
  await button(page, "Cancel scan").click();
  await heading(page, "Daily food log");
  await page.waitForFunction(() =>
    window.__foodCameraFixture.tracks.every((track) => track.readyState === "ended"),
  );
  assert.equal(await page.locator("video").count(), 0);

  await button(page, "Scan food barcode").click();
  await page.locator("video").waitFor({ state: "attached" });
  await visibility("hidden");
  await page.getByTestId("food-barcode-scanner").waitFor({ state: "detached" });
  await page.waitForFunction(() =>
    window.__foodCameraFixture.tracks.every((track) => track.readyState === "ended"),
  );
  await visibility("visible");
  await heading(page, "Daily food log");
  assert.equal(await page.locator("video").count(), 0);
});

test("a real camera mount failure retains manual barcode lookup and does not issue duplicate requests", async (t) => {
  const page = await open(t, { deferredCamera: true, cameraMountError: true });
  let requests = 0;
  await page.route("https://world.openfoodfacts.org/api/v2/product/**", (route) => {
    requests++;
    return json(route, { status: 1, product });
  });
  await button(page, "Scan food barcode").click();
  await page.waitForFunction(() => window.__foodCameraFixture.resolvePermission);
  await page.evaluate(() => window.__foodCameraFixture.resolvePermission());
  await page
    .getByText("Camera unavailable. You can enter the barcode manually.", { exact: true })
    .waitFor();
  assert.equal(await page.locator("video").count(), 0);
  await field(page, "Product barcode").fill("https://example.com/3017620422003");
  await button(page, "Look up barcode").click();
  await page
    .getByText("Enter a valid EAN or UPC product barcode. QR codes aren't supported.", {
      exact: true,
    })
    .waitFor();
  assert.equal(requests, 0);
  await field(page, "Product barcode").fill(product.code);
  await button(page, "Look up barcode").dblclick();
  await heading(page, "Review imported food");
  assert.equal(requests, 1);
  assert.equal((await catalog(page))?.foods?.length ?? 0, 0);
  await button(page, "Cancel").click();
  await heading(page, "Daily food log");
});

test("barcode-imported smart-apostrophe labels remain searchable offline after reload", async (t) => {
  const page = await open(t);
  const item = { ...product, product_name: "McDonald’s hamburger", brands: "McDonald’s" };
  let requests = 0;
  await page.route("**/api/v2/product/**", (route) => {
    requests++;
    return json(route, { status: 1, product: item });
  });
  await scan(page, item.code);
  await heading(page, "Review imported food");
  assert.equal(await field(page, "Food name").inputValue(), item.product_name);
  await button(page, "Save food").click();
  await dismissCreated(page);
  assert.equal((await catalog(page)).foods[0].name, item.product_name);
  assert.equal((await catalog(page)).foods[0].brand, item.brands);
  await page.reload();
  await field(page, "Search foods").waitFor();
  await page.context().setOffline(true);
  for (const query of ["McDonald's", "McDonald’s", "McDonald＇s\u00a0hamburger"]) {
    await field(page, "Search foods").fill(query);
    await button(
      page,
      "View nutrition for McDonald’s hamburger, custom food, imported by barcode",
    ).waitFor();
  }
  assert.equal(requests, 1);
});

test("Scan reopens from review and cancels the previous lookup", async (t) => {
  const page = await open(t);
  let release;
  let received;
  let fulfilled;
  const started = new Promise((resolve) => {
    received = resolve;
  });
  const finished = new Promise((resolve) => {
    fulfilled = resolve;
  });
  await page.route("https://world.openfoodfacts.org/api/v2/product/**", async (route) => {
    const code = /product\/(\d+)/.exec(route.request().url())[1];
    if (code !== "7290004131074") return json(route, { status: 1, product });
    received();
    await new Promise((resolve) => {
      release = resolve;
    });
    await json(route, {
      status: 1,
      product: { ...product, code, product_name: "Old pending product" },
    }).catch(() => {});
    fulfilled();
  });

  await scan(page, product.code);
  await heading(page, "Review imported food");
  await field(page, "Food name").fill("Discarded scan draft");
  await button(page, "Scan food barcode").click();
  await heading(page, "Scan food barcode");
  assert.equal(await page.getByTestId("food-import-draft").count(), 0);
  assert.equal(await field(page, "Product barcode").inputValue(), "");

  const aborted = page.waitForEvent("requestfailed", {
    predicate: (request) => request.url().includes("/product/7290004131074"),
  });
  await scan(page, "7290004131074");
  await started;
  await page.getByRole("progressbar", { name: "Looking up barcode...", exact: true }).waitFor();
  await button(page, "Scan food barcode").click();
  await heading(page, "Scan food barcode");
  const failedRequest = await aborted;
  assert.match(failedRequest.failure().errorText, /ABORTED|cancel/i);
  release();
  await finished;
  assert.equal(await page.getByTestId("food-barcode-scanner").count(), 1);
  assert.equal(await page.getByTestId("food-import-draft").count(), 0);
  assert.equal(await field(page, "Product barcode").inputValue(), "");
  assert.equal((await catalog(page))?.foods?.length ?? 0, 0);
  assert.equal(
    await page.evaluate(() => window.accountFixture.getItem("kinevault-track.food-log.v1")),
    null,
  );
});

test("Search and Scan use 75/25 widths and local results offer no online search actions", async (t) => {
  const page = await open(t);
  const requests = [];
  await page.route("https://world.openfoodfacts.org/**", (route) => {
    requests.push(new URL(route.request().url()).pathname);
    return json(route, { status: 1, product });
  });
  const searchBox = await page.getByTestId("food-search-box").boundingBox();
  const scanBox = await button(page, "Scan food barcode").boundingBox();
  assert.ok(Math.abs(searchBox.width / scanBox.width - 3) < 0.04);
  assert.ok(scanBox.height >= 44);
  assert.equal(await button(page, "Search brands online").count(), 0);
  assert.equal(await page.getByText("Brands", { exact: true }).count(), 0);
  for (const query of ["MissingFixtureBrand", "drpeper", "McDonalds"]) {
    await field(page, "Search foods").fill(query);
    await page.getByTestId("food-catalog-results").waitFor();
    assert.equal(await button(page, "Find a branded product online").count(), 0);
    assert.equal(await field(page, "Brand name").count(), 0);
  }
  assert.deepEqual(requests, []);
  await scan(page, product.code);
  await heading(page, "Review imported food");
  assert.deepEqual(requests, [`/api/v2/product/${product.code}.json`]);
  await button(page, "Cancel").click();
  assert.equal((await catalog(page)).foods.length, 0);
});

test("legacy stored imports stay unbadged through edits, reload and offline ingredient search", async (t) => {
  const legacy = {
    customId: "legacy-import",
    name: "Cherry cola zero",
    brand: "Fixture Brand",
    category: "Custom food",
    per100g: { calories: 2, carbs: 0, protein: 0, fat: 0 },
    portions: [{ label: "1 serving", grams: 100 }],
    importSource: { provider: "open-food-facts", barcode: product.code, method: "brand" },
  };
  const page = await open(t, { foods: [legacy] });
  await field(page, "Search foods").fill("Fixture Brand");
  await button(page, "View nutrition for Cherry cola zero, custom food").click();
  assert.equal(await page.getByTestId("scanned-food-icon").count(), 0);
  await button(page, "Edit food").click();
  assert.equal(await field(page, "Brand (optional)").inputValue(), legacy.brand);
  await field(page, "Brand (optional)").fill("Fixture Brand label");
  await page.getByRole("link", { name: /Open Food Facts/ }).waitFor();
  await button(page, "Save food changes").click();
  await page.getByText("Saved to your foods", { exact: true }).waitFor();
  assert.deepEqual((await catalog(page)).foods[0].importSource, {
    ...legacy.importSource,
    method: "import",
  });
  assert.equal((await catalog(page)).foods[0].brand, "Fixture Brand label");
  assert.deepEqual((await catalog(page)).foods[0].per100g, legacy.per100g);
  await page.reload();
  await field(page, "Search foods").waitFor();
  await page.context().setOffline(true);
  for (const query of ["fixturebrand", "fixture-brand", "fixtur brand", "chery cola zero"]) {
    await field(page, "Search foods").fill(query);
    await button(page, "View nutrition for Cherry cola zero, custom food").waitFor();
  }
  assert.equal(await page.getByTestId("scanned-food-icon").count(), 0);
  await button(page, "View nutrition for Cherry cola zero, custom food").click();
  await button(page, "Edit food").click();
  assert.equal(await field(page, "Calories (kcal)").inputValue(), "2");
  assert.equal(await field(page, "Carbs (g)").inputValue(), "0");
  await button(page, "Cancel").click();
  await button(page, "Create food/meal").click();
  await page
    .getByTestId("food-creation-switch")
    .getByRole("button", { name: "Meal", exact: true })
    .click();
  await field(page, "Search ingredients").fill("fixturebrand zero");
  await button(page, "Add Cherry cola zero to meal, custom food").click();
  assert.equal(await field(page, "Calories (kcal)").inputValue(), "2");
  await button(page, "Cancel").click();
});
