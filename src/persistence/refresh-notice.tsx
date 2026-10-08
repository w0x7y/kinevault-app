import { View } from "react-native";
import { AppText } from "../components/ui";
import { Button } from "../onboarding/controls";
import { spacing } from "../theme/tokens";

type Refreshable = {
  refreshError?: string | null;
  saving: boolean;
  retryLoad(): void;
};

export function RefreshNotice({ label, document }: { label: string; document: Refreshable }) {
  if (!document.refreshError) return null;
  return (
    <View style={{ padding: spacing.layout, gap: spacing.sm }}>
      <AppText accessibilityRole="alert">
        {label}: {document.refreshError}
      </AppText>
      <Button
        label={`Retry ${label.toLowerCase()}`}
        secondary
        disabled={document.saving}
        onPress={document.retryLoad}
      />
    </View>
  );
}
