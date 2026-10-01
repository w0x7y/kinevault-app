import { useEffect, useRef, useState } from "react";
import { Modal, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText, Panel } from "../components/ui";
import { useTheme } from "../theme/provider";
import { spacing } from "../theme/tokens";
import type { CustomFood } from "./custom-model.ts";
import type { CustomMeal } from "./meal-model.ts";
import { useCustomFoods } from "./custom-provider";
import { FoodButton } from "./food-button";

export function CustomItemActions({ item, disabled, onEdit, onDeleted }: {
  item: CustomFood | CustomMeal; disabled: boolean; onEdit: () => void; onDeleted: () => void;
}) {
  const custom = useCustomFoods();
  const { colors } = useTheme();
  const [confirming, setConfirming] = useState(false);
  const [failed, setFailed] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const kind = "ingredients" in item ? "meal" : "food";
  const title = `Delete custom ${kind}?`;
  const busy = disabled || custom.saving;
  function dismiss() {
    if (!pending.current && !busy) { setConfirming(false); setFailed(false); }
  }
  async function remove() {
    if (pending.current || busy || custom.state.kind !== "ready") return;
    pending.current = true;
    setFailed(false);
    try {
      const removed = await custom.remove(item.customId);
      if (!mounted.current) return;
      if (removed) onDeleted();
      else setFailed(true);
    } finally { pending.current = false; }
  }
  return <>
    <View style={{ flexDirection: "row", gap: spacing.layout }}>
      <View style={{ flex: 1 }}><FoodButton label={`Edit ${kind}`} disabled={busy || custom.state.kind !== "ready"} onPress={onEdit} /></View>
      <View style={{ flex: 1 }}><FoodButton label={`Delete ${kind}`} disabled={busy || custom.state.kind !== "ready"}
        onPress={() => { setFailed(false); setConfirming(true); }} /></View>
    </View>
    {confirming && <Modal transparent visible animationType="none" accessibilityLabel={title} onRequestClose={dismiss}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "rgba(0, 0, 0, 0.45)" }}>
        <ScrollView keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", alignItems: "center", padding: spacing.layout }}>
          <Panel accessibilityViewIsModal style={{ width: "100%", maxWidth: 360, gap: spacing.layout }}>
            <AppText variant="heading" accessibilityRole="header">{title}</AppText>
            <AppText>Delete “{item.name}” from your saved {kind === "meal" ? "meals" : "foods"}?</AppText>
            <AppText variant="caption" muted>Existing log entries and ingredients in saved meals will be kept. This can't be undone.</AppText>
            {failed && <AppText accessibilityRole="alert" style={{ color: colors.error }}>
              {custom.error ?? "Couldn't delete this item. It is still saved. Try again."}
            </AppText>}
            <FoodButton label={custom.saving ? "Deleting..." : `Delete ${kind}`} disabled={busy} onPress={() => { void remove(); }} />
            <FoodButton label="Cancel" disabled={busy} onPress={dismiss} />
          </Panel>
        </ScrollView>
      </SafeAreaView>
    </Modal>}
  </>;
}
