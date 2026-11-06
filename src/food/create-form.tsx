import { ButtonRow, AppButton } from "../components/button";
import { View } from "react-native";
import { AppText } from "../components/ui";
import { spacing } from "../theme/tokens";
import { type CustomFood, type CustomFoodDraft } from "./custom-model.ts";
import { useCustomFoods } from "./custom-provider";
import { InlineMessage } from "../components/inline-message";
import { TextField } from "../components/text-field";
import { NutritionFields } from "./form-fields";
import { DetailedNutrientFields } from "./detailed-nutrient-fields";
import { ProductAttribution } from "./product-attribution";
import { Section } from "./food-ui";
import { SegmentedControl } from "../components/segmented-control";

import { useFoodDrafts } from "./draft-provider";
import { catalogWriteState, type FoodDraftSession } from "./catalog-drafts.ts";
import { limitReached, type PlusLimit } from "../plus/gate";
import { LimitNotice, PlusTag } from "../plus/locks";
import { usePaywall } from "../plus/paywall";
import { usePlus } from "../plus/provider";

export function CreateFoodForm({
  onCancel,
  onSaved,
  session,
}: {
  onCancel: () => void;
  onSaved: (food: CustomFood) => void;
  session: FoodDraftSession;
}) {
  const foods = useCustomFoods();
  const drafts = useFoodDrafts();
  const { draft, existing, volumeBased, handle, errors, error } = session;
  const { saving, locked } = catalogWriteState(foods, session);
  const busy = foods.saving || saving;
  const { unlocked } = usePlus();
  // Free's limit counts only new foods; editing one never hits it.
  const count = existing || foods.state.kind !== "ready" ? null : foods.state.document.foods.length;
  function changeDraft(next: CustomFoodDraft) {
    drafts.changeFood(handle, next);
  }
  function change(
    key: Exclude<keyof CustomFoodDraft, "details" | "importSource" | "drink">,
    value: string,
  ) {
    changeDraft({ ...draft, [key]: value });
  }
  function changeKind(drink: boolean) {
    drafts.setFoodKind(handle, drink);
  }

  // A save finishing while the tab hides this form still reaches the page that started it.
  async function save() {
    await drafts.save(handle, (item) => {
      if (!("ingredients" in item)) onSaved(item);
    });
  }
  return (
    <View testID="create-food-form" style={{ gap: spacing.layout }}>
      {count !== null && <LimitNotice limit="foods" count={count} />}
      <AppText variant="caption" muted style={{ paddingHorizontal: spacing.xs }}>
        {draft.importSource
          ? "Check the label and edit any values before saving. Blank values are unknown."
          : "Save a food or drink to use again. Enter the nutrition from its label."}
      </AppText>
      <Section title="Details">
        <TextField
          label="Food name"
          value={draft.name}
          onChange={(value) => change("name", value)}
          error={errors.name}
          disabled={busy}
        />
        <TextField
          label="Brand (optional)"
          value={draft.brand ?? ""}
          onChange={(value) => change("brand", value)}
          error={errors.brand}
          disabled={busy}
        />
        {draft.importSource?.provider === "open-food-facts" && (
          <ProductAttribution barcode={draft.importSource.barcode} />
        )}
        <View style={{ gap: spacing.sm }}>
          <AppText variant="label">Type</AppText>
          <SegmentedControl
            label="Type"
            options={[
              { value: "solid", label: "Solid food", icon: "utensils" },
              { value: "drink", label: "Drink", icon: "glass-water" },
            ]}
            value={draft.drink ? "drink" : "solid"}
            disabled={busy}
            onChange={(kind) => changeKind(kind === "drink")}
          />
          {volumeBased && !draft.drink && (
            <AppText variant="caption" muted>
              This product lists volume amounts. Choose Drink for a beverage and confirm nutrition
              per 100 ml, or enter nutrition for a weighed food serving.
            </AppText>
          )}
        </View>
        {!draft.drink && (
          <TextField
            label="Serving weight (g)"
            value={draft.servingGrams}
            onChange={(value) => change("servingGrams", value)}
            error={errors.servingGrams}
            disabled={busy}
            kind="decimal"
          />
        )}
      </Section>
      <Section
        title={draft.drink ? "Nutrition per 100 ml" : "Nutrition per serving"}
        titleRole="header"
        description="Enter 0 when the label lists zero. All four values are required."
      >
        <NutritionFields values={draft} errors={errors} onChange={change} disabled={busy} />
        <DetailedNutrientFields
          values={draft.details}
          errors={errors.details}
          disabled={busy}
          onChange={(key, value) =>
            changeDraft({ ...draft, details: { ...draft.details, [key]: value } })
          }
        />
      </Section>
      <FormFooter
        note={
          existing
            ? "Changes apply to future logging. Existing log entries and saved meal ingredients keep their original nutrition."
            : "Saved to your foods and available in search. Saving won't add it to a meal."
        }
        error={error}
        busy={busy}
        onCancel={() => {
          drafts.discard(handle);
          onCancel();
        }}
        saveLabel={saving ? "Saving food..." : existing ? "Save food changes" : "Save food"}
        saveDisabled={locked}
        limit={count !== null && limitReached("foods", count, unlocked) ? "foods" : undefined}
        onSave={() => {
          void save();
        }}
      />
    </View>
  );
}

/** The closing note, save error and the Cancel / Save pair shared by the food and meal forms. */
export function FormFooter({
  note,
  error,
  busy,
  onCancel,
  saveLabel,
  saveDisabled,
  onSave,
  limit,
}: {
  note: string;
  error?: string | null;
  busy: boolean;
  onCancel: () => void;
  saveLabel: string;
  saveDisabled: boolean;
  onSave: () => void;
  /** Free's limit this save would pass: Save wears the Plus tag and opens the paywall. */
  limit?: PlusLimit;
}) {
  const paywall = usePaywall();
  return (
    <View style={{ gap: spacing.md, paddingTop: spacing.xs }}>
      {error && <InlineMessage>{error}</InlineMessage>}
      <ButtonRow>
        <AppButton fill label="Cancel" disabled={busy} onPress={onCancel} />
        <AppButton
          fill
          tone="primary"
          label={saveLabel}
          accessibilityLabel={limit ? `${saveLabel}, part of Plus` : saveLabel}
          badge={limit && <PlusTag />}
          disabled={saveDisabled}
          onPress={limit ? () => paywall.open(limit) : onSave}
        />
      </ButtonRow>
      {paywall.sheet}
      <AppText
        variant="caption"
        muted
        style={{ textAlign: "center", paddingHorizontal: spacing.sm }}
      >
        {note}
      </AppText>
    </View>
  );
}
