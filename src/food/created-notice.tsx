import { Modal, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText, Panel } from "../components/ui";
import { spacing } from "../theme/tokens";
import { FoodButton } from "./food-button";
import type { CatalogKind } from "./meal-model.ts";

export function FoodCreatedNotice({ onDismiss, kind = "food" }: { onDismiss: () => void; kind?: CatalogKind }) {
  const title = kind === "meal" ? "Meal created" : "Food created";
  return (
    <Modal transparent visible animationType="none" accessibilityLabel={title}
      onRequestClose={onDismiss}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "rgba(0, 0, 0, 0.45)" }}>
        <ScrollView keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", alignItems: "center", padding: spacing.layout }}>
          <Panel accessibilityViewIsModal style={{ width: "100%", maxWidth: 360, gap: spacing.layout }}>
            <AppText variant="heading" accessibilityRole="header">{title}</AppText>
            <AppText>You can find it anytime in {kind} search.</AppText>
            <FoodButton primary label="OK" onPress={onDismiss} />
          </Panel>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
