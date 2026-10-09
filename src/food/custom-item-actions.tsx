import { ButtonRow, AppButton } from "../components/button";
import { useEffect, useRef, useState } from "react";
import { DeleteButton } from "../components/delete-button";
import { AppText } from "../components/ui";
import { useTheme } from "../theme/provider";
import type { CustomFood } from "./custom-model.ts";
import type { CustomMeal } from "./meal-model.ts";
import { useCustomFoods } from "./custom-provider";
import { useFoodDrafts } from "./draft-provider";

export function CustomItemActions({
  item,
  disabled,
  onEdit,
  onDeleted,
}: {
  item: CustomFood | CustomMeal;
  disabled: boolean;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const custom = useCustomFoods();
  const drafts = useFoodDrafts();
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const kind = "ingredients" in item ? "meal" : "food";
  const busy = disabled || custom.saving;
  async function remove() {
    if (pending.current || busy || custom.state.kind !== "ready") return;
    pending.current = true;
    setFailed(false);
    try {
      const removed = await drafts.removeSaved(item, custom);
      if (!mounted.current) return;
      if (removed) onDeleted();
      else setFailed(true);
      return removed;
    } finally {
      pending.current = false;
    }
  }
  return (
    <>
      <ButtonRow>
        <AppButton
          fill
          label={`Edit ${kind}`}
          disabled={busy || custom.state.kind !== "ready"}
          onPress={onEdit}
        />
        <DeleteButton
          fill
          label={`Delete ${kind}`}
          disabled={busy || custom.state.kind !== "ready"}
          confirmAccessibilityLabel={`Confirm delete ${kind}`}
          onDelete={remove}
        />
      </ButtonRow>
      {failed && (
        <AppText accessibilityRole="alert" style={{ color: colors.error }}>
          {custom.error ?? "Couldn't delete this item. It is still saved. Try again."}
        </AppText>
      )}
    </>
  );
}
