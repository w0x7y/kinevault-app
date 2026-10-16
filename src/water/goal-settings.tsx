import { AppButton } from "../components/button";
import { View } from "react-native";
import { InlineMessage } from "../components/inline-message";
import { LoadFailure } from "../components/load-failure";
import { TextField } from "../components/text-field";
import { IconWell } from "../components/icon-well";
import { AppText } from "../components/ui";
import { RowContent, SettingsGroup } from "../account/settings-list";
import { useTheme } from "../theme/provider";
import { spacing } from "../theme/tokens";
import { useDocumentEdit } from "../persistence/use-document-edit";
import { createWaterGoalEdit } from "./goal-editing";
import { useWaterGoalPersistence } from "./goal-provider";

export function WaterGoalSettings() {
  const goal = useWaterGoalPersistence();
  const { edit, draft, error, busy, saving, saved, load } = useDocumentEdit(() =>
    createWaterGoalEdit(goal),
  );
  const { colors } = useTheme();
  const savedMl = load.kind === "ready" ? load.document.dailyMl : undefined;

  return (
    <SettingsGroup title="Water" cardTestID="water-goal-settings">
      <RowContent>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <IconWell icon="droplet" color={colors.water} />
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <AppText
              variant="label"
              accessibilityRole="header"
              style={{ fontSize: 15, lineHeight: 21 }}
            >
              Daily water goal
            </AppText>
            {load.kind === "ready" && (
              <AppText variant="caption" muted accessibilityLiveRegion="polite">
                {`Current goal: ${savedMl?.toLocaleString()} ml per day.`}
              </AppText>
            )}
            {load.kind === "loading" && (
              <AppText variant="caption" accessibilityLiveRegion="polite" muted>
                Loading water goal...
              </AppText>
            )}
          </View>
        </View>
        {load.kind === "error" && (
          <LoadFailure
            message="Couldn't load your water goal."
            retryLabel="Retry water goal"
            onRetry={edit.retryLoad}
          />
        )}
        {load.kind === "ready" && (
          <>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                alignItems: "stretch",
                gap: spacing.sm,
              }}
            >
              <View style={{ flexGrow: 1, flexBasis: 140, minWidth: 0 }}>
                <TextField
                  testID="water-goal-input"
                  label="Daily water goal (ml)"
                  labelHidden
                  kind="integer"
                  size="figure"
                  unit="ml"
                  value={draft}
                  disabled={busy}
                  invalid={Boolean(error)}
                  onChange={(text) => {
                    edit.change(text);
                  }}
                  onSubmit={() => void edit.save()}
                />
              </View>
              <AppButton
                tone="primary"
                label={saving ? "Saving water goal..." : "Save water goal"}
                disabled={busy}
                onPress={() => void edit.save()}
              />
            </View>
            <InlineMessage>{error}</InlineMessage>
            {saved && (
              <InlineMessage tone="success" testID="water-goal-saved">
                Water goal saved.
              </InlineMessage>
            )}
            <AppText variant="caption" muted>
              Fills the cup on Home. Water and Drinks both count.
            </AppText>
          </>
        )}
      </RowContent>
    </SettingsGroup>
  );
}
