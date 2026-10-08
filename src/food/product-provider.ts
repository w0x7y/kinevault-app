import { parseBrandedProduct, type BrandedProduct } from "./product-model.ts";
import { normalizeProductBarcode } from "./barcode.ts";
import { isRecord } from "./catalog-record.ts";

type ClientOptions = {
  fetch?: (url: string, init?: RequestInit) => Promise<Response>;
  now?: () => number;
  timeoutMs?: number;
};
type ProviderResponse = { status: number; body: unknown };
const origin = "https://world.openfoodfacts.org";
const fields = [
  "code",
  "product_name",
  "product_name_en",
  "product_name_he",
  "brands",
  "categories_tags",
  "nutriments",
  "serving_size",
  "serving_quantity",
  "serving_quantity_unit",
  "product_quantity_unit",
  "quantity",
  "no_nutrition_data",
].join(",");
const cacheDurationMs = 5 * 60_000;
const cacheLimit = 50;

function abortError(): Error {
  const error = new Error("Product request was cancelled.");
  error.name = "AbortError";
  return error;
}

function checkAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}

function invalidResponse(): Error {
  return new Error("Open Food Facts returned invalid product data. Please try again.");
}

/** Barcode lookup with validated nutrition, cancellation, caching and request limits. */
export class OpenFoodFactsClient {
  readonly #fetch: NonNullable<ClientOptions["fetch"]>;
  readonly #now: () => number;
  readonly #timeoutMs: number;
  #requests: number[] = [];
  // Cache validated raw envelopes, so each caller gets a fresh editable draft.
  readonly #cache = new Map<string, { expiresAt: number; response: ProviderResponse }>();

  constructor(options: ClientOptions = {}) {
    this.#fetch = options.fetch ?? ((url, init) => globalThis.fetch(url, init));
    this.#now = options.now ?? Date.now;
    this.#timeoutMs = options.timeoutMs ?? 15_000;
    if (!Number.isFinite(this.#timeoutMs) || this.#timeoutMs <= 0)
      throw new Error("Invalid product request timeout.");
  }

  async lookupProduct({
    barcode: input,
    signal,
  }: {
    barcode: string;
    signal?: AbortSignal;
  }): Promise<BrandedProduct | null> {
    checkAborted(signal);
    const barcode = normalizeProductBarcode(input);
    if (!barcode) throw new Error("Enter a valid product barcode with its check digit.");
    const url = `${origin}/api/v2/product/${barcode}.json?${new URLSearchParams({ fields })}`;
    const response = await this.#request(url, signal);
    checkAborted(signal);
    if (!isRecord(response.body)) throw invalidResponse();
    if (response.body.status === 0 && (response.status === 404 || response.status === 200)) {
      this.#remember(url, response);
      return null;
    }
    if (response.status === 404 || response.body.status !== 1) throw invalidResponse();
    const product = parseBrandedProduct(response.body.product);
    if (!product || product.barcode.replace(/^0+/, "") !== barcode.replace(/^0+/, ""))
      throw invalidResponse();
    checkAborted(signal);
    this.#remember(url, response);
    return product;
  }

  #remember(url: string, response: ProviderResponse): void {
    // Updating a hit does not extend its original freshness interval.
    if (this.#cache.has(url)) return;
    for (const [key, cached] of this.#cache) {
      if (cached.expiresAt <= this.#now()) this.#cache.delete(key);
    }
    while (this.#cache.size >= cacheLimit) {
      const oldest = this.#cache.keys().next().value;
      if (oldest === undefined) break;
      this.#cache.delete(oldest);
    }
    this.#cache.set(url, { expiresAt: this.#now() + cacheDurationMs, response });
  }

  #consumeBudget(): void {
    const now = this.#now();
    const recent = this.#requests.filter((time) => now - time < 60_000);
    this.#requests = recent;
    if (recent.length >= 15) {
      const seconds = Math.max(1, Math.ceil((60_000 - (now - recent[0])) / 1000));
      throw new Error(
        `Open Food Facts request limit reached. Wait ${seconds} seconds before trying again.`,
      );
    }
    recent.push(now);
  }

  async #request(url: string, signal?: AbortSignal): Promise<ProviderResponse> {
    checkAborted(signal);
    const cached = this.#cache.get(url);
    if (cached && cached.expiresAt > this.#now()) return cached.response;
    this.#cache.delete(url);
    this.#consumeBudget();
    const controller = new AbortController();
    let rejectCancelled: (error: Error) => void = () => {};
    const cancellation = new Promise<never>((_resolve, reject) => {
      rejectCancelled = reject;
    });
    const cancel = () => {
      controller.abort();
      rejectCancelled(abortError());
    };
    signal?.addEventListener("abort", cancel, { once: true });
    const timeout = setTimeout(() => {
      controller.abort();
      rejectCancelled(new Error("Open Food Facts request timed out. Please try again."));
    }, this.#timeoutMs);
    try {
      const fetching = async (): Promise<ProviderResponse> => {
        let response: Response;
        try {
          response = await this.#fetch(url, {
            signal: controller.signal,
            headers: {
              Accept: "application/json",
              "X-User-Agent": "KineVaultTrack/1.0 (https://github.com/w0x7y/kinevault-app)",
            },
          });
        } catch (error) {
          if (error instanceof TypeError && !controller.signal.aborted) {
            throw new Error(
              "Could not reach Open Food Facts. Check your connection or try again later.",
            );
          }
          throw error;
        }
        if (!response.ok && response.status !== 404) {
          throw new Error(
            `Open Food Facts is unavailable (HTTP ${response.status}). Please try again later.`,
          );
        }
        let body: unknown;
        try {
          body = await response.json();
        } catch {
          throw invalidResponse();
        }
        checkAborted(controller.signal);
        return { status: response.status, body };
      };
      return await Promise.race([fetching(), cancellation]);
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", cancel);
    }
  }
}
export const productClient = new OpenFoodFactsClient();
