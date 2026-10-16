import { readFileSync } from "node:fs";
import type { CatalogFood } from "../../src/food/catalog.ts";
import { createCatalogDrafts } from "../../src/food/catalog-drafts.ts";
import type { CustomFood } from "../../src/food/custom-model.ts";
import { createCustomFoodPersistence } from "../../src/food/custom-persistence.ts";
import { parseFoodLog } from "../../src/food/log-model.ts";
import { createFoodLogPersistence, type FoodLogStorage } from "../../src/food/log-persistence.ts";

export const dataset: { foods: CatalogFood[] } = JSON.parse(
  readFileSync(new URL("../../assets/food/usda-fndds.json", import.meta.url), "utf8"),
);
export const findFood = (id: number) => dataset.foods.find((food) => food.fdcId === id);
export const flush = () => new Promise((resolve) => setImmediate(resolve));

function gate() {
  let open!: (failed?: boolean) => void;
  const promise = new Promise<void>((resolve, reject) => {
    open = (failed = false) => (failed ? reject(new Error("Unavailable")) : resolve());
  });
  return { promise, open };
}

/** Durable storage for one document. Reads and writes can be held or failed, and
 * another device can replace the document and notify this one. */
export function memory(initial: string | null = null) {
  let raw = initial;
  const external = new Set<() => void>();
  const held: { read?: Promise<void>; write?: Promise<void> } = {};
  let writes = 0;
  const storage: FoodLogStorage = {
    async getItem() {
      await held.read;
      return raw;
    },
    async setItem(_key, value) {
      writes++;
      const wait = held.write;
      held.write = undefined;
      await wait;
      raw = value;
    },
    subscribeItem(_key, listener) {
      external.add(listener);
      return () => {
        external.delete(listener);
      };
    },
  };
  return {
    storage,
    raw: () => raw,
    writes: () => writes,
    /** Holds the next write until the returned gate opens, or fails it. */
    holdWrite() {
      const next = gate();
      held.write = next.promise;
      return next;
    },
    holdReads() {
      const next = gate();
      held.read = next.promise;
      return {
        open() {
          held.read = undefined;
          next.open();
        },
      };
    },
    replace(next: string) {
      raw = next;
      for (const listener of external) listener();
    },
  };
}

/** Loaded food-log and Custom food persistence with the Catalog drafts that use them. */
export async function foodStores({ foods = [] as CustomFood[] } = {}) {
  const logStorage = memory();
  const catalogStorage = memory(JSON.stringify({ version: 1, foods, meals: [] }));
  let id = 0;
  const log = createFoodLogPersistence({
    storage: logStorage.storage,
    createId: () => `entry-${++id}`,
    findFood,
  });
  const catalog = createCustomFoodPersistence({
    storage: catalogStorage.storage,
    createId: () => `custom-${++id}`,
  });
  log.start();
  catalog.start();
  await flush();
  const drafts = createCatalogDrafts({ store: catalog });
  const entries = () => Object.values(parseFoodLog(logStorage.raw()).days).flat();
  return { log, catalog, drafts, entries, logStorage, catalogStorage };
}
