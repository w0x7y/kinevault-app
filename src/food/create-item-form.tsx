import { ButtonRow, AppButton } from "../components/button";
import { useFoodDrafts } from "./draft-provider";
import { CreateFoodForm } from "./create-form";
import { CreateMealForm } from "./create-meal-form";
import type { CustomFood } from "./custom-model.ts";
import type { CustomMeal } from "./meal-model.ts";
import { useCustomFoods } from "./custom-provider";

export function CreateItemForm({
  onCancel,
  onSaved,
}: {
  onCancel: () => void;
  onSaved: (item: CustomFood | CustomMeal) => void;
}) {
  const { creationKind: kind, setCreationKind: setKind, session } = useFoodDrafts();
  const { saving } = useCustomFoods();
  return (
    <>
      <ButtonRow testID="food-creation-switch">
        <AppButton
          fill
          label="Food"
          selected={kind === "food"}
          disabled={saving}
          onPress={() => setKind("food")}
        />
        <AppButton
          fill
          label="Meal"
          selected={kind === "meal"}
          disabled={saving}
          onPress={() => setKind("meal")}
        />
      </ButtonRow>
      {session?.kind === "food" ? (
        <CreateFoodForm session={session} onCancel={onCancel} onSaved={onSaved} />
      ) : session?.kind === "meal" ? (
        <CreateMealForm session={session} onCancel={onCancel} onSaved={onSaved} />
      ) : null}
    </>
  );
}
