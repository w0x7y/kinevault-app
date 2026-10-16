import { AppButton } from "../components/button";
import { View } from "react-native";
import { spacing } from "../theme/tokens";
import { InlineMessage } from "../components/inline-message";
import { DeleteButton } from "../components/delete-button";
import type { CustomFood } from "./custom-model.ts";
import type { CustomMeal } from "./meal-model.ts";
import { useCustomFoods } from "./custom-provider";

export function CustomItemActions({
  item,
  disabled,
  error,
  onEdit,
  onDelete,
}: {
  item: CustomFood | CustomMeal;
  disabled: boolean;
  /** A failed deletion requested from this page. */
  error: string | null;
  onEdit: () => void;
  onDelete: () => Promise<boolean>;
}) {
  const custom = useCustomFoods();
  const kind = "ingredients" in item ? "meal" : "food";
  const unavailable = disabled || custom.saving || custom.state.kind !== "ready";
  return (
    <>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        <AppButton icon="pen" label={`Edit ${kind}`} disabled={unavailable} onPress={onEdit} />
        <DeleteButton
          label={`Delete ${kind}`}
          disabled={unavailable}
          confirmAccessibilityLabel={`Confirm delete ${kind}`}
          onDelete={onDelete}
        />
      </View>
      {error && <InlineMessage>{error}</InlineMessage>}
    </>
  );
}
