import { ButtonRow, AppButton } from "../components/button";
import { useState } from "react";
import { Modal, ScrollView, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText, Panel } from "../components/ui";
import { useTheme } from "../theme/provider";
import { fonts, radius, spacing } from "../theme/tokens";
import { useWaterLog } from "./provider";
import { useManualWaterEdit } from "./use-manual-editing";
import { KineLoading } from "../components/kine-loading";

// Home keys this modal by date, so each open day gets its own Manual water edit.
export function WaterEntryModal({ date, onDismiss }: { date: string; onDismiss: () => void }) {
  const { colors } = useTheme();
  const log = useWaterLog();
  const { edit, draft, error, busy, ready } = useManualWaterEdit(date);
  const [focused, setFocused] = useState(false);

  async function save() {
    if (await edit.save()) onDismiss();
  }

  return (
    <Modal
      transparent
      visible
      animationType="none"
      accessibilityLabel="Edit water"
      onRequestClose={() => {
        if (!busy) onDismiss();
      }}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: "rgba(0, 0, 0, 0.45)" }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            alignItems: "center",
            padding: spacing.layout,
          }}
        >
          <Panel
            testID="water-entry"
            accessibilityViewIsModal
            style={{ width: "100%", maxWidth: 360, gap: spacing.layout }}
          >
            <AppText variant="heading" accessibilityRole="header">
              Edit water
            </AppText>
            <AppText muted>For {date}</AppText>
            <AppText variant="caption" muted>
              Edit manual water for this day. Drinks count separately in your Home total.
            </AppText>
            {log.state.kind === "loading" && <KineLoading compact label="Loading water log..." />}
            {log.state.kind === "error" && (
              <>
                <AppText accessibilityRole="alert" style={{ color: colors.error }}>
                  Couldn't load your water log.
                </AppText>
              </>
            )}
            {!ready && <AppButton label="Retry water log" onPress={log.retryLoad} />}
            <View style={{ gap: spacing.xs }}>
              <AppText variant="label">Manual water (ml)</AppText>
              <TextInput
                accessibilityLabel="Manual water (ml)"
                value={draft}
                keyboardType="number-pad"
                selectTextOnFocus
                editable={!busy}
                onChangeText={(text) => {
                  edit.change(text);
                }}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onSubmitEditing={() => void save()}
                returnKeyType="done"
                style={{
                  minHeight: 48,
                  padding: spacing.layout,
                  borderWidth: 1,
                  borderRadius: radius.control,
                  borderColor: focused ? colors.ring : colors.input,
                  color: colors.foreground,
                  backgroundColor: colors.card,
                  fontFamily: fonts.regular,
                  fontSize: 16,
                }}
              />
            </View>
            <ButtonRow>
              {[-250, 250].map((delta) => (
                <AppButton
                  key={delta}
                  fill
                  label={`${delta > 0 ? "+" : ""}${delta} ml`}
                  disabled={busy}
                  onPress={() => {
                    edit.adjust(delta);
                  }}
                />
              ))}
            </ButtonRow>
            {error && (
              <AppText accessibilityRole="alert" style={{ color: colors.error }}>
                {error}
              </AppText>
            )}
            <ButtonRow>
              <AppButton fill label="Cancel" disabled={busy} onPress={onDismiss} />
              <AppButton
                fill
                primary
                label={busy ? "Saving water..." : "Save water"}
                accessibilityLabel="Save water"
                disabled={busy || !ready}
                onPress={() => void save()}
              />
            </ButtonRow>
          </Panel>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
