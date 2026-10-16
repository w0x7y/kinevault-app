import { AppButton } from "../components/button";
import { View } from "react-native";
import { SheetPage } from "../components/sheet-page";
import { AppText } from "../components/ui";
import { spacing } from "../theme/tokens";
import { Section } from "./food-ui";
import { FoodBarcodeScanner } from "./barcode-scanner";
import { ProductAttribution } from "./product-attribution";
import type { CustomFood } from "./custom-model.ts";
import type { CustomMeal } from "./meal-model.ts";
import type { FoodImportPage } from "./tab-view.ts";
import { CatalogDraftPage } from "./catalog-draft-page";
import { useFoodDrafts } from "./draft-provider";
import { KineLoading } from "../components/kine-loading";
import { InlineMessage } from "../components/inline-message";

/** One Scan journey's page. The Food tab view owns its flow; each step replaces the last. */
export function FoodProductImport({
  page: { flow, state },
  active,
  onClose,
  onSaved,
}: {
  page: FoodImportPage;
  active: boolean;
  onClose: () => void;
  onSaved: (item: CustomFood | CustomMeal) => void;
}) {
  const { session } = useFoodDrafts();
  if (state.kind === "draft")
    return session?.kind === "food" ? (
      // Leaving a review keeps its draft, which the food log offers to resume.
      <CatalogDraftPage
        session={session}
        closeLabel="Back to food log"
        onClose={onClose}
        onSaved={onSaved}
        testID="food-import-draft"
      />
    ) : null;
  return (
    <SheetPage
      title={
        state.kind === "scanner"
          ? "Scan food barcode"
          : state.kind === "loading"
            ? "Barcode lookup"
            : state.kind === "missing"
              ? "Product not found"
              : "Barcode lookup failed"
      }
      closeLabel={state.kind === "scanner" ? "Cancel scan" : "Cancel import"}
      onClose={onClose}
    >
      {state.kind === "scanner" ? (
        <FoodBarcodeScanner
          onClose={onClose}
          onBarcode={(barcode) => {
            void flow.lookupBarcode(barcode);
          }}
        />
      ) : (
        <View testID="food-barcode-lookup" style={{ gap: spacing.layout }}>
          <AppText variant="caption" muted selectable style={{ paddingHorizontal: spacing.xs }}>
            Barcode {state.barcode}
          </AppText>
          {state.kind === "loading" ? (
            <KineLoading compact label="Looking up barcode..." />
          ) : (
            <Section>
              {state.kind === "missing" && (
                <AppText muted>
                  Open Food Facts doesn't have this product. Enter the label details to create your
                  food.
                </AppText>
              )}
              {state.kind === "error" && <InlineMessage>{state.message}</InlineMessage>}
              {state.kind === "error" && (
                <AppButton
                  tone="primary"
                  icon="rotate-right"
                  label="Retry barcode lookup"
                  disabled={!active}
                  onPress={() => {
                    void flow.retry();
                  }}
                />
              )}
              <AppButton
                tone={state.kind === "missing" ? "primary" : "secondary"}
                icon="pen"
                label="Enter food manually"
                onPress={flow.enterManually}
              />
              <AppButton icon="barcode" label="Try another barcode" onPress={flow.scanAgain} />
            </Section>
          )}
          <ProductAttribution barcode={state.barcode} />
        </View>
      )}
    </SheetPage>
  );
}
