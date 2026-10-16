import { View } from "react-native";
import { SheetPage } from "../components/sheet-page";
import { StepFade } from "../components/motion";
import { spacing } from "../theme/tokens";
import { useFoodDrafts } from "./draft-provider";
import { CreateFoodForm } from "./create-form";
import { CreateMealForm } from "./create-meal-form";
import type { CustomFood } from "./custom-model.ts";
import type { CustomMeal } from "./meal-model.ts";
import { useCustomFoods } from "./custom-provider";
import { SegmentedControl } from "../components/segmented-control";
import type { CatalogDraftSession } from "./catalog-drafts.ts";

/** The page title for a reusable food or meal draft. */
function draftTitle(session: CatalogDraftSession) {
  if (session.kind === "meal") return session.existing ? "Edit custom meal" : "Create meal";
  if (session.existing) return "Edit custom food";
  return session.draft.importSource ? "Review imported food" : "Create food";
}

/**
 * The page for one Catalog draft: its title, its food or meal form, and Back blocked while
 * the draft or another catalog write is saving. Cancel discards the draft, then closes.
 * A new creation also offers the Food/Meal switch above its form.
 */
export function CatalogDraftPage({
  session,
  closeLabel,
  onClose,
  onSaved,
  creation = false,
  testID,
}: {
  session: CatalogDraftSession;
  closeLabel: string;
  onClose: () => void;
  onSaved: (item: CustomFood | CustomMeal) => void;
  creation?: boolean;
  testID?: string;
}) {
  const { saving } = useCustomFoods();
  const { setCreationKind } = useFoodDrafts();
  const form =
    session.kind === "meal" ? (
      <CreateMealForm session={session} onCancel={onClose} onSaved={onSaved} />
    ) : (
      <CreateFoodForm session={session} onCancel={onClose} onSaved={onSaved} />
    );
  return (
    <SheetPage
      title={draftTitle(session)}
      closeLabel={closeLabel}
      closeDisabled={saving || session.saving}
      onClose={onClose}
    >
      {creation ? (
        // The switch stays mounted above either form, so focus survives a change of kind.
        <View style={{ gap: spacing.layout }}>
          <SegmentedControl
            testID="food-creation-switch"
            label="Create"
            options={[
              { value: "food", label: "Food", icon: "apple-whole" },
              { value: "meal", label: "Meal", icon: "utensils" },
            ]}
            value={session.kind}
            disabled={saving}
            onChange={setCreationKind}
          />
          {/* Switching kind swaps the form below with a short fade as the selection slides. */}
          <StepFade step={session.kind} style={{ gap: spacing.layout }}>
            {form}
          </StepFade>
        </View>
      ) : testID ? (
        <View testID={testID}>{form}</View>
      ) : (
        form
      )}
    </SheetPage>
  );
}
