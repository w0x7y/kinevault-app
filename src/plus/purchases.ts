import type { Membership } from "../account/membership.ts";
import type { PlusPlan } from "./plans.ts";

export type PurchaseResult =
  | { kind: "purchased"; membership: Membership }
  | { kind: "cancelled" }
  /** Restore found nothing to restore. */
  | { kind: "none" }
  | { kind: "unavailable" }
  | { kind: "failed" };

/** Buying and restoring Plus through the phone's store. */
export type PlusPurchases = {
  buy(plan: PlusPlan): Promise<PurchaseResult>;
  restore(): Promise<PurchaseResult>;
};

/**
 * Today's only implementation: store billing isn't built yet, so every purchase and restore
 * reports it instead of failing. RevenueCat replaces this.
 */
export const plusPurchases: PlusPurchases = {
  buy: async () => ({ kind: "unavailable" }),
  restore: async () => ({ kind: "unavailable" }),
};

/** What the paywall or Settings says after a purchase or restore that didn't unlock Plus. */
export function purchaseMessage(result: PurchaseResult): string | null {
  switch (result.kind) {
    case "unavailable":
      return "Purchases open with the store release.";
    case "failed":
      return "The purchase didn't go through. Try again.";
    case "none":
      return "No Plus purchase was found to restore.";
    case "cancelled":
    case "purchased":
      return null;
  }
}
