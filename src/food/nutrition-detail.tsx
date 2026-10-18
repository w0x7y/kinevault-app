import { AppButton } from "../components/button";
import { useState, useSyncExternalStore } from "react";
import { StyleSheet, View } from "react-native";
import { SheetPage } from "../components/sheet-page";
import { InlineMessage } from "../components/inline-message";
import { TextField } from "../components/text-field";
import { AppText, Overline } from "../components/ui";
import { Section } from "./food-ui";
import { ViewHeader } from "../components/view-header";
import { Chip } from "../components/chip";
import { ProductAttribution } from "./product-attribution";
import { useTheme } from "../theme/provider";
import { fonts, radius, spacing } from "../theme/tokens";
import { macroCategories } from "../daily/nutrition.ts";
import { FoodLoggingControls } from "./logging-controls";
import type { CustomMeal } from "./meal-model.ts";
import type { CustomFood } from "./custom-model.ts";
import { CustomItemActions } from "./custom-item-actions";
import { useFoodDrafts } from "./draft-provider";
import { NutritionFields } from "./form-fields";
import { nutritionAmountText } from "./number-input.ts";
import { getFoodDatabase } from "./database";
import { CatalogDraftPage } from "./catalog-draft-page";
import type { FoodLoggingAttempt, FoodLoggingAttemptSnapshot } from "./logging-attempt.ts";

const decimal = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 1 });
const useAttempt = (attempt: FoodLoggingAttempt) =>
  useSyncExternalStore(attempt.subscribe, attempt.getSnapshot, attempt.getSnapshot);
function detailNoun({ preparation, item }: FoodLoggingAttemptSnapshot) {
  return preparation.measurement === "volume" ? "drink" : item?.kind === "meal" ? "meal" : "food";
}

/** A Logging attempt's page: the preview, its amount and meal, and the saved item's actions. */
export function FoodNutritionDetail({
  attempt,
  backLabel,
  saved,
  onBack,
  onLog,
  onEditCatalog,
  onDeleteItem,
}: {
  attempt: FoodLoggingAttempt;
  backLabel: string;
  /** The saved item was just created or edited here. */
  saved: boolean;
  onBack: () => void;
  onLog: () => void;
  onEditCatalog: () => void;
  onDeleteItem: () => Promise<boolean>;
}) {
  const { colors } = useTheme();
  const { deletion } = useFoodDrafts();
  const snapshot = useAttempt(attempt);
  const { target, fields, preparation, item, saving, busy } = snapshot;
  const customMeal = item?.kind === "meal" ? item.food : undefined;
  const [servingsExpanded, setServingsExpanded] = useState(false);
  const noun = detailNoun(snapshot);
  const grams = preparation.measurement === "grams" ? preparation.amount : null;
  const invalidDrinkAmount =
    preparation.measurement === "volume" &&
    preparation.status === "invalid" &&
    preparation.reason === "amount";
  const portions = target.kind === "add" ? target.food.portions : [];
  const hundredGramPortion = portions.find((portion) => portion.grams === 100);
  const sourcePortions = portions.filter((portion) => portion !== hundredGramPortion);
  const visiblePortions = servingsExpanded ? sourcePortions : sourcePortions.slice(0, 2);
  const ingredientsScale = customMeal
    ? (grams ?? customMeal.portions[0].grams) / customMeal.portions[0].grams
    : 1;
  return (
    <SheetPage
      title={
        target.kind === "edit"
          ? `Edit logged ${noun}`
          : `${noun[0].toUpperCase()}${noun.slice(1)} details`
      }
      closeLabel={target.kind === "edit" ? "Cancel edit" : backLabel}
      closeDisabled={busy}
      onClose={onBack}
    >
      <View testID="food-nutrition-detail" style={{ gap: spacing.layout }}>
        <ViewHeader
          overline={
            target.kind === "edit"
              ? undefined
              : [target.food.category, target.food.brand].filter(Boolean).join(" · ")
          }
          title={target.kind === "edit" ? target.entry.name : target.food.name}
          selectable
        >
          {target.kind === "add" && target.food.importSource?.provider === "open-food-facts" && (
            <ProductAttribution barcode={target.food.importSource.barcode} />
          )}
          {saved && (
            <View style={{ paddingTop: spacing.xs }}>
              <InlineMessage tone="success">{`Saved to your ${customMeal ? "meals" : "foods"}`}</InlineMessage>
            </View>
          )}
        </ViewHeader>
        <Section
          title={
            preparation.status === "ready"
              ? `Nutrition for ${decimal(preparation.amount)} ${preparation.measurement === "volume" ? "ml" : "g"}`
              : "Nutrition"
          }
        >
          {preparation.status === "ready" ? (
            <>
              <AppText variant="hero" selectable>
                {Math.round(preparation.nutrition.calories).toLocaleString()}
                <AppText
                  variant="body"
                  muted
                  style={{ fontFamily: fonts.semibold, letterSpacing: 0 }}
                >
                  {" "}
                  kcal
                </AppText>
              </AppText>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                {macroCategories.map(({ key, label }) => (
                  <View
                    key={key}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      gap: 2,
                      paddingVertical: spacing.sm + 2,
                      paddingHorizontal: spacing.sm + 2,
                      borderRadius: radius.tile,
                      backgroundColor: colors.muted,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <View
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: 4,
                          backgroundColor: colors[key],
                        }}
                      />
                      <AppText
                        variant="caption"
                        style={{ color: colors[key], fontFamily: fonts.bold }}
                      >
                        {label}
                      </AppText>
                    </View>
                    <AppText
                      variant="label"
                      selectable
                      style={{
                        fontFamily: fonts.extrabold,
                        fontSize: 16,
                        fontVariant: ["tabular-nums"],
                      }}
                    >
                      {decimal(preparation.nutrition[key])}
                      <AppText variant="caption" muted>
                        {" "}
                        g
                      </AppText>
                    </AppText>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <View style={{ gap: spacing.xs }}>
              <AppText variant="hero" muted accessibilityElementsHidden aria-hidden>
                —
              </AppText>
              <AppText
                variant="caption"
                accessibilityRole={preparation.measurement === "volume" ? undefined : "alert"}
                muted={preparation.measurement === "volume"}
                style={
                  preparation.measurement === "volume"
                    ? undefined
                    : { color: colors.error, fontFamily: fonts.semibold }
                }
              >
                {preparation.message}
              </AppText>
            </View>
          )}
          {customMeal && target.kind === "add" && (
            <View style={{ gap: 0, paddingTop: spacing.xs }}>
              <Overline accessibilityRole="header" style={{ paddingBottom: spacing.xs }}>
                Ingredients
              </Overline>
              {customMeal.ingredients.map((ingredient) => (
                <View
                  key={ingredient.id}
                  style={{
                    flexDirection: "row",
                    gap: spacing.md,
                    paddingVertical: spacing.sm + 2,
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderColor: colors.border,
                  }}
                >
                  <AppText variant="label" selectable style={{ flex: 1, minWidth: 0 }}>
                    {ingredient.food.name}
                  </AppText>
                  <AppText
                    variant="label"
                    muted
                    selectable
                    style={{ fontVariant: ["tabular-nums"] }}
                  >
                    {decimal(ingredient.grams * ingredientsScale)} g
                  </AppText>
                </View>
              ))}
              {Object.keys(customMeal.overrides).length > 0 && (
                <AppText variant="caption" muted>
                  Includes your nutrition overrides.
                </AppText>
              )}
            </View>
          )}
        </Section>
        <Section>
          {preparation.measurement === "volume" && (
            <TextField
              label="Drink amount"
              accessibilityLabel="Drink amount (ml)"
              hint="Enter whole milliliters. Changes nutrition and adds this volume to the selected day's water total."
              kind="integer"
              size="figure"
              unit="ml"
              maxLength={16}
              value={fields.drinkMl}
              onChange={attempt.setDrinkMl}
              disabled={busy}
              error={invalidDrinkAmount ? "Enter a whole number from 1 to 10,000 ml." : null}
            />
          )}
          {preparation.measurement === "volume" && preparation.label.kind === "required" && (
            <View style={{ gap: spacing.sm }}>
              <Overline accessibilityRole="header">Nutrition per 100 ml</Overline>
              <AppText variant="caption" muted>
                This drink has no reliable volume nutrition. Enter all four values from its label.
                Enter 0 only when the label lists zero.
              </AppText>
              <NutritionFields
                values={fields.labelNutrition}
                errors={{}}
                disabled={busy}
                onChange={attempt.setLabelNutrition}
              />
            </View>
          )}
          {preparation.measurement === "grams" && (
            <TextField
              label="Amount"
              accessibilityLabel="Amount (g)"
              hint="Changes the nutrition preview for this weight"
              kind="decimal"
              size="figure"
              unit="g"
              maxLength={16}
              value={fields.grams}
              onChange={attempt.setGrams}
              disabled={busy}
              invalid={grams === null}
            />
          )}
          {target.kind === "add" && preparation.measurement === "grams" && (
            <View style={{ gap: spacing.sm }}>
              <Overline accessibilityRole="header">Serving sizes</Overline>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                <Chip
                  label={hundredGramPortion ? hundredGramPortion.label : "100 g"}
                  detail={hundredGramPortion ? ", 100 g" : undefined}
                  selected={grams === 100}
                  disabled={busy}
                  onPress={() => attempt.setGrams("100")}
                />
                {visiblePortions.map((portion) => (
                  <Chip
                    key={`${portion.label}-${portion.grams}`}
                    label={portion.label}
                    detail={`, ${decimal(portion.grams)} g`}
                    selected={grams === portion.grams}
                    disabled={busy}
                    onPress={() => attempt.setGrams(nutritionAmountText(portion.grams))}
                  />
                ))}
              </View>
              {sourcePortions.length > 2 && (
                <AppButton
                  tone="link"
                  icon={servingsExpanded ? "chevron-up" : "chevron-down"}
                  label={servingsExpanded ? "Fewer serving sizes" : "More serving sizes"}
                  expanded={servingsExpanded}
                  disabled={busy}
                  onPress={() => setServingsExpanded((expanded) => !expanded)}
                />
              )}
            </View>
          )}
          <FoodLoggingControls
            attempt={attempt}
            snapshot={snapshot}
            onLog={onLog}
            itemKind={customMeal ? "meal" : "food"}
          />
        </Section>
        {target.kind === "add" && item && (
          <View style={{ gap: spacing.sm, paddingHorizontal: spacing.xs }}>
            <Overline>Your saved {customMeal ? "meal" : "food"}</Overline>
            <CustomItemActions
              item={item.food}
              disabled={saving}
              error={deletion?.caller === attempt ? deletion.error : null}
              onEdit={onEditCatalog}
              onDelete={onDeleteItem}
            />
          </View>
        )}
        {target.kind === "add" && (
          <AppText
            variant="caption"
            muted
            selectable
            style={{ paddingHorizontal: spacing.xs, textAlign: "center" }}
          >
            {customMeal
              ? "Custom meal · Nutrition from ingredients and your overrides"
              : target.food.customId
                ? "Custom food · Nutrition entered by you"
                : `${getFoodDatabase().source.name} · ${getFoodDatabase().source.dataset}`}
          </AppText>
        )}
      </View>
    </SheetPage>
  );
}

/** The detail's saved item open in its Catalog draft; closing returns to the details. */
export function FoodCatalogEditor({
  attempt,
  onClose,
  onSaved,
}: {
  attempt: FoodLoggingAttempt;
  onClose: () => void;
  onSaved: (item: CustomFood | CustomMeal) => void;
}) {
  const { session } = useFoodDrafts();
  const snapshot = useAttempt(attempt);
  if (!session) return null;
  return (
    <CatalogDraftPage
      session={session}
      closeLabel={`Back to ${detailNoun(snapshot)} details`}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}
