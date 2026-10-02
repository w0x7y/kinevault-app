import { useEffect, useRef, useState } from "react";
import { Modal, ScrollView, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText, Panel } from "../components/ui";
import { FoodButton } from "../food/food-button";
import { useTheme } from "../theme/provider";
import { fonts, radius, spacing } from "../theme/tokens";
import { manualWaterAmountFromText } from "./model";
import { useWaterLog } from "./provider";
import { KineLoading } from "../components/kine-loading";

export function WaterEntryModal({ date, onDismiss }: { date: string; onDismiss: () => void }) {
  const { colors } = useTheme();
  const log = useWaterLog();
  const [draft, setDraft] = useState(() => ({ date, initialized: log.state.kind === "ready",
    text: log.state.kind === "ready" ? String(log.state.document.days[date] ?? 0) : "" }));
  const amount = draft.date === date ? draft.text : "";
  const currentDate = useRef(date);
  currentDate.current = date;
  useEffect(() => {
    setDraft(previous => {
      if (previous.date === date && previous.initialized) return previous;
      return { date, initialized: log.state.kind === "ready",
        text: log.state.kind === "ready" ? String(log.state.document.days[date] ?? 0) : "" };
    });
  }, [date, log.state]);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const submitting = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const ready = log.state.kind === "ready";
  const disabled = log.saving || !ready || draft.date !== date;

  function adjustAmount(delta: number) {
    if (submitting.current || log.saving) return;
    setDraft(previous => {
      const text = previous.date === date ? previous.text : "";
      const parsed = /^\d+$/.test(text.trim()) ? Number(text.trim()) : 0;
      const current = Number.isSafeInteger(parsed) ? parsed : 0;
      return { date, initialized: true, text: String(Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, current + delta))) };
    });
    setError(null);
  }

  async function save() {
    if (submitting.current || disabled) return;
    const ml = manualWaterAmountFromText(amount);
    if (ml === null) {
      setError("Enter a whole number of millilitres, 0 or more.");
      return;
    }
    submitting.current = true;
    setError(null);
    // Capture this form's date before the asynchronous write.
    try {
      const saved = await log.set({ date, ml });
      if (saved && mounted.current && currentDate.current === date) onDismiss();
    } finally {
      submitting.current = false;
    }
  }

  return (
    <Modal transparent visible animationType="none" accessibilityLabel="Edit water"
      onRequestClose={() => { if (!log.saving) onDismiss(); }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "rgba(0, 0, 0, 0.45)" }}>
        <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", alignItems: "center", padding: spacing.layout }}>
          <Panel testID="water-entry" accessibilityViewIsModal style={{ width: "100%", maxWidth: 360, gap: spacing.layout }}>
            <AppText variant="heading" accessibilityRole="header">Edit water</AppText>
            <AppText muted>For {date}</AppText>
            <AppText variant="caption" muted>Edit manual water for this day. Drinks count separately in your Home total.</AppText>
            {log.state.kind === "loading" && <KineLoading compact label="Loading water log..." />}
            {log.state.kind === "error" && <>
              <AppText accessibilityRole="alert" style={{ color: colors.error }}>Couldn't load your water log.</AppText>
            </>}
            {!ready && <FoodButton label="Retry water log" onPress={log.retryLoad} />}
            <View style={{ gap: spacing.xs }}>
              <AppText variant="label">Manual water (ml)</AppText>
              <TextInput accessibilityLabel="Manual water (ml)" value={amount} keyboardType="number-pad" selectTextOnFocus
                editable={!log.saving} onChangeText={text => { setDraft({ date, text, initialized: true }); setError(null); }}
                onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
                onSubmitEditing={() => void save()} returnKeyType="done"
                style={{ minHeight: 48, padding: spacing.layout, borderWidth: 1, borderRadius: radius.control,
                  borderColor: focused ? colors.ring : colors.input, color: colors.foreground,
                  backgroundColor: colors.card, fontFamily: fonts.regular, fontSize: 16 }} />
            </View>
            <View style={{ flexDirection: "row", gap: spacing.layout }}>
              {[-250, 250].map(delta => <View key={delta} style={{ flex: 1 }}>
                <FoodButton label={`${delta > 0 ? "+" : ""}${delta} ml`} disabled={log.saving} onPress={() => adjustAmount(delta)} />
              </View>)}
            </View>
            {(error || log.error) && <AppText accessibilityRole="alert" style={{ color: colors.error }}>{error || log.error}</AppText>}
            <FoodButton primary label={log.saving ? "Saving water..." : "Save water"} accessibilityLabel="Save water"
              disabled={disabled} onPress={() => void save()} />
            <FoodButton label="Cancel" disabled={log.saving} onPress={onDismiss} />
          </Panel>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
