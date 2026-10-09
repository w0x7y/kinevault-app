import { AppButton } from "../components/button";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { View } from "react-native";
import { AppText } from "../components/ui";
import { useTheme } from "../theme/provider";
import { spacing } from "../theme/tokens";
import { FoodBarcodeScanner } from "./barcode-scanner";
import { CreateFoodForm } from "./create-form";
import { ProductAttribution } from "./product-attribution";
import { productClient } from "./product-provider.ts";
import { createProductImportFlow } from "./product-import-flow.ts";
import type { CustomFood } from "./custom-model.ts";

import { useFoodDrafts } from "./draft-provider";
import { KineLoading } from "../components/kine-loading";

export function FoodProductImport({
  active,
  focused,
  scopeKey,
  onCancel,
  onSaved,
}: {
  active: boolean;
  focused: boolean;
  scopeKey: string;
  onCancel: () => void;
  onSaved: (food: CustomFood) => void;
}) {
  const { colors } = useTheme();
  const drafts = useFoodDrafts();
  const [flow] = useState(() => createProductImportFlow({ lookup: productClient, drafts }));
  const state = useSyncExternalStore(flow.subscribe, flow.getSnapshot, flow.getSnapshot);
  useLayoutEffect(() => {
    flow.start();
    return flow.stop;
  }, [flow]);
  useLayoutEffect(() => {
    flow.setContext({ active, scopeKey });
  }, [flow, active, scopeKey]);
  function cancel() {
    flow.cancel();
    onCancel();
  }
  const cancelRef = useRef(cancel);
  cancelRef.current = cancel;
  useEffect(() => {
    if (!focused && state.kind === "scanner") cancelRef.current();
  }, [focused, state.kind]);
  if (state.kind === "scanner")
    return focused ? (
      <FoodBarcodeScanner
        onClose={cancel}
        onBarcode={(barcode) => {
          void flow.lookupBarcode(barcode);
        }}
      />
    ) : null;
  if (state.kind === "draft" && drafts.session?.kind === "food")
    return (
      <View testID="food-import-draft" style={{ gap: spacing.layout }}>
        <AppText variant="heading" accessibilityRole="header">
          Review imported food
        </AppText>
        <AppText muted>
          Check the label and edit any values before saving. Blank values are unknown.
        </AppText>

        <CreateFoodForm session={drafts.session} onCancel={cancel} onSaved={onSaved} />
      </View>
    );
  if (state.kind === "draft") return null;
  return (
    <View testID="food-barcode-lookup" style={{ gap: spacing.layout }}>
      {state.kind === "loading" ? (
        <KineLoading compact label="Looking up barcode..." />
      ) : (
        <AppText variant="heading" accessibilityRole="header">
          {state.kind === "missing" ? "Product not found" : "Barcode lookup failed"}
        </AppText>
      )}
      <AppText variant="caption" muted>
        Barcode {state.barcode}
      </AppText>
      {state.kind === "missing" && (
        <AppText muted>
          Open Food Facts doesn't have this product. Enter the label details to create your food.
        </AppText>
      )}
      {state.kind === "error" && (
        <AppText accessibilityRole="alert" style={{ color: colors.error }}>
          {state.message}
        </AppText>
      )}
      {state.kind === "error" && (
        <AppButton
          label="Retry barcode lookup"
          disabled={!active}
          onPress={() => {
            void flow.retry();
          }}
        />
      )}
      {state.kind !== "loading" && (
        <AppButton label="Enter food manually" onPress={flow.enterManually} />
      )}
      {state.kind !== "loading" && (
        <AppButton label="Try another barcode" onPress={flow.scanAgain} />
      )}
      <ProductAttribution barcode={state.barcode} />
      <AppButton label="Cancel import" onPress={cancel} />
    </View>
  );
}
