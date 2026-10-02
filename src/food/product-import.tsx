import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { AppText } from "../components/ui";
import { useTheme } from "../theme/provider";
import { spacing } from "../theme/tokens";
import { FoodBarcodeScanner } from "./barcode-scanner";
import { CreateFoodForm } from "./create-form";
import { FoodButton } from "./food-button";
import { ProductAttribution } from "./product-attribution";
import { productClient } from "./product-provider.ts";
import type { BrandedProduct } from "./product-model.ts";
import type { CustomFood, CustomFoodDraft } from "./custom-model.ts";

import { useFoodDrafts } from "./draft-provider";

type ImportState = { kind: "scanner" } | { kind: "loading"; barcode: string }
  | { kind: "missing"; barcode: string } | { kind: "error"; barcode: string; message: string }
  | { kind: "draft" };

export function FoodProductImport({ active, focused, scopeKey, onCancel, onSaved }: {
  active: boolean; focused: boolean; scopeKey: string;
  onCancel: () => void; onSaved: (food: CustomFood) => void;
}) {
  const { colors } = useTheme();
  const drafts = useFoodDrafts();
  const [state, setState] = useState<ImportState>({ kind: "scanner" });
  const request = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  useEffect(() => {
    request.current?.abort(); sequence.current++;
    setState(current => current.kind === "loading" ? { kind: "error", barcode: current.barcode,
      message: "Lookup cancelled. Retry when you're ready." } : current);
    return () => { request.current?.abort(); sequence.current++; };
  }, [active, scopeKey]);
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;
  useEffect(() => { if (!focused && state.kind === "scanner") cancelRef.current(); }, [focused, state.kind]);
  function review(product: BrandedProduct) {
    request.current?.abort(); sequence.current++;
    const draft = { ...product.draft, brand: product.brand,
      importSource: { provider: "open-food-facts", barcode: product.barcode, method: "barcode" } } satisfies CustomFoodDraft;
    drafts.open({ kind: "import", draft, volumeBased: product.volumeBased });
    setState({ kind: "draft" });
  }
  function manualDraft(barcode: string) {
    const draft = { name: "", brand: "", servingGrams: "100",
      calories: "", carbs: "", protein: "", fat: "", importSource: { provider: "manual", barcode, method: "barcode" } } satisfies CustomFoodDraft;
    drafts.open({ kind: "import", draft, volumeBased: false });
    setState({ kind: "draft" });
  }
  async function lookup(barcode: string) {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    const id = ++sequence.current;
    setState({ kind: "loading", barcode });
    try {
      const product = await productClient.lookupProduct({ barcode, signal: controller.signal });
      if (controller.signal.aborted || id !== sequence.current) return;
      if (product) review(product); else setState({ kind: "missing", barcode });
    } catch (error) {
      if (!controller.signal.aborted && id === sequence.current)
        setState({ kind: "error", barcode, message: error instanceof Error ? error.message : "Couldn't look up this product. Try again or enter it manually." });
    }
  }
  if (state.kind === "scanner") return focused ? <FoodBarcodeScanner onClose={onCancel} onBarcode={barcode => { void lookup(barcode); }} /> : null;
  if (state.kind === "draft" && drafts.session?.kind === "food") return <View testID="food-import-draft" style={{ gap: spacing.layout }}>
    <AppText variant="heading" accessibilityRole="header">Review imported food</AppText>
    <AppText muted>Check the label and edit any values before saving. Blank values are unknown.</AppText>

    <CreateFoodForm session={drafts.session} onCancel={onCancel} onSaved={onSaved} />
  </View>;
  if (state.kind === "draft") return null;
  return <View testID="food-barcode-lookup" style={{ gap: spacing.layout }}>
    <AppText variant="heading" accessibilityRole="header">{state.kind === "loading" ? "Looking up barcode..." : state.kind === "missing" ? "Product not found" : "Barcode lookup failed"}</AppText>
    <AppText variant="caption" muted>Barcode {state.barcode}</AppText>
    {state.kind === "missing" && <AppText muted>Open Food Facts doesn't have this product. Enter the label details to create your food.</AppText>}
    {state.kind === "error" && <AppText accessibilityRole="alert" style={{ color: colors.error }}>{state.message}</AppText>}
    {state.kind === "error" && <FoodButton label="Retry barcode lookup" disabled={!active} onPress={() => { void lookup(state.barcode); }} />}
    {state.kind !== "loading" && <FoodButton label="Enter food manually" onPress={() => manualDraft(state.barcode)} />}
    {state.kind !== "loading" && <FoodButton label="Try another barcode" onPress={() => setState({ kind: "scanner" })} />}
    <ProductAttribution barcode={state.barcode} />
    <FoodButton label="Cancel import" onPress={onCancel} />
  </View>;
}
