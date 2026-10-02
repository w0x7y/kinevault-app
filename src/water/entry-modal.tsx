import { useEffect, useRef, useState } from "react";
import { Modal, ScrollView, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText, Panel } from "../components/ui";
import { FoodButton } from "../food/food-button";
import { useTheme } from "../theme/provider";
import { fonts, radius, spacing } from "../theme/tokens";
import { waterAmountFromText } from "./model";
import { useWaterLog } from "./provider";

export function WaterEntryModal({ date, onDismiss }: { date: string; onDismiss: () => void }) {
  const { colors } = useTheme();
  const log = useWaterLog();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const submitting = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const ready = log.state.kind === "ready";
  const disabled = log.saving || !ready;

  async function save() {
    if (submitting.current || disabled) return;
    const ml = waterAmountFromText(amount);
    if (ml === null) {
      setError("Enter a whole number from 1 to 10,000 ml.");
      return;
    }
    submitting.current = true;
    setError(null);
    // Capture this form's date before the asynchronous write.
    try {
      const saved = await log.add({ date, ml });
      if (saved && mounted.current) onDismiss();
    } finally {
      submitting.current = false;
    }
  }

  return (
    <Modal transparent visible animationType="none" accessibilityLabel="Add water"
      onRequestClose={() => { if (!log.saving) onDismiss(); }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "rgba(0, 0, 0, 0.45)" }}>
        <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", alignItems: "center", padding: spacing.layout }}>
          <Panel testID="water-entry" accessibilityViewIsModal style={{ width: "100%", maxWidth: 360, gap: spacing.layout }}>
            <AppText variant="heading" accessibilityRole="header">Add water</AppText>
            <AppText muted>For {date}</AppText>
            <AppText variant="caption" muted>Drinks are already included. Add other water here.</AppText>
            {log.state.kind === "loading" && <AppText accessibilityLiveRegion="polite">Loading water log...</AppText>}
            {log.state.kind === "error" && <>
              <AppText accessibilityRole="alert" style={{ color: colors.error }}>Couldn't load your water log.</AppText>
            </>}
            {!ready && <FoodButton label="Retry water log" onPress={log.retryLoad} />}
            <View style={{ gap: spacing.xs }}>
              <AppText variant="label">Water amount (ml)</AppText>
              <TextInput accessibilityLabel="Water amount (ml)" value={amount} keyboardType="number-pad"
                editable={!log.saving} onChangeText={text => { setAmount(text); setError(null); }}
                onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
                onSubmitEditing={() => void save()} returnKeyType="done"
                style={{ minHeight: 48, padding: spacing.layout, borderWidth: 1, borderRadius: radius.control,
                  borderColor: focused ? colors.ring : colors.input, color: colors.foreground,
                  backgroundColor: colors.card, fontFamily: fonts.regular, fontSize: 16 }} />
            </View>
            <View style={{ flexDirection: "row", gap: spacing.layout }}>
              {[250, 500].map(ml => <View key={ml} style={{ flex: 1 }}>
                <FoodButton label={`${ml} ml`} disabled={log.saving} onPress={() => { setAmount(String(ml)); setError(null); }} />
              </View>)}
            </View>
            {(error || log.error) && <AppText accessibilityRole="alert" style={{ color: colors.error }}>{error || log.error}</AppText>}
            <FoodButton primary label={log.saving ? "Adding water..." : "Add water"} accessibilityLabel="Add water"
              disabled={disabled} onPress={() => void save()} />
            <FoodButton label="Cancel" disabled={log.saving} onPress={onDismiss} />
          </Panel>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
