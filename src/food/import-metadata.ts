import { normalizeProductBarcode } from "./barcode.ts";

export type FoodImportSource =
  | { provider: "open-food-facts"; barcode: string; method: "barcode" | "import" }
  | { provider: "manual"; barcode: string; method: "barcode" };

export function parseFoodMetadata(value: Record<string, unknown>): { brand?: string; importSource?: FoodImportSource } {
  let brand: string | undefined;
  if (value.brand !== undefined) {
    if (typeof value.brand !== "string" || value.brand.length > 400) throw new Error("Invalid food brand");
    brand = value.brand.trim() || undefined;
  }
  if (value.importSource === undefined) return brand ? { brand } : {};
  const source = value.importSource;
  if (typeof source !== "object" || source === null || !("provider" in source) ||
    !("method" in source) || !("barcode" in source) || typeof source.barcode !== "string" ||
    normalizeProductBarcode(source.barcode) === null) throw new Error("Invalid food import source");
  const barcode = source.barcode;
  if (source.provider === "manual" && source.method === "barcode")
    return { ...(brand ? { brand } : {}), importSource: { provider: "manual", method: "barcode", barcode } };
  // Stored non-scanned imports keep their origin without entering a scanner flow.
  if (source.provider === "open-food-facts" && (source.method === "barcode" || source.method === "import" || source.method === "brand"))
    return { ...(brand ? { brand } : {}), importSource: { provider: "open-food-facts", method: source.method === "brand" ? "import" : source.method, barcode } };
  throw new Error("Invalid food import source");
}

export const productSourceURL = (barcode: string) => `https://world.openfoodfacts.org/product/${barcode}`;
