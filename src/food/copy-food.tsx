import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { AppButton, IconButton } from "../components/button";
import { IconWell } from "../components/icon-well";
import { InlineMessage } from "../components/inline-message";
import { SheetPage } from "../components/sheet-page";
import { AppText, Panel } from "../components/ui";
import { shortDayLabel } from "../calendar/dates.ts";
import { meals, type Meal } from "../daily/model.ts";
import { useTheme } from "../theme/provider";
import { fonts, spacing } from "../theme/tokens";
import { Section } from "./food-ui";
import { FoodLogStatus } from "./log-status";
import { useFoodLog } from "./log-provider";
import { foodCopyPreview } from "./log-model.ts";
import type { FoodCopyPage } from "./tab-view.ts";

const entryCount = (count: number) => (count === 1 ? "1 entry" : `${count} entries`);
const summary = ({ entries, calories }: { entries: unknown[]; calories: number }) =>
  `${entryCount(entries.length)} · ${Math.round(calories).toLocaleString()} kcal`;

/** Copying another day's food into `date`: the source day, a preview of each Meal with its
 * own Copy, and Copy whole day. */
export function FoodCopy({
  page,
  date,
  busy,
  onBack,
  onFrom,
  onCopy,
}: {
  page: FoodCopyPage;
  /** The Selected day, which the copies go to. */
  date: string;
  /** The Food tab's write lock. */
  busy: boolean;
  onBack: () => void;
  onFrom: (date: string) => void;
  onCopy: (meal: Meal | null) => void;
}) {
  const { colors } = useTheme();
  const { state, retryLoad } = useFoodLog();
  const document = state.kind === "ready" ? state.document : null;
  const preview = useMemo(
    () => document && foodCopyPreview(document, page.from, date),
    [document, page.from, date],
  );
  const saving = page.copy?.state === "saving";
  const locked = busy || saving;
  const to = shortDayLabel(date);
  const from = shortDayLabel(page.from);
  const label = (meal: Meal | null) =>
    meal === null ? "this day" : meals.find((option) => option.key === meal)!.label;
  const copying = (meal: Meal | null) => saving && page.copy?.meal === meal;
  return (
    <SheetPage
      title="Copy food"
      closeLabel="Back to food log"
      closeDisabled={saving}
      onClose={onBack}
    >
      <View testID="food-copy" style={{ gap: spacing.layout }}>
        <AppText variant="caption" muted>
          {`Adds copies to ${to}. Each keeps its amount, meal and nutrition.`}
        </AppText>
        <Section title="From">
          <View style={styles.stepper}>
            <IconButton
              label="Previous day with food"
              icon="chevron-left"
              appearance="secondary"
              disabled={locked || !preview?.previous}
              onPress={() => preview?.previous && onFrom(preview.previous)}
            />
            <AppText
              variant="label"
              accessibilityLiveRegion="polite"
              aria-live="polite"
              style={{ flex: 1, minWidth: 0, textAlign: "center", fontFamily: fonts.bold }}
            >
              {from}
              {preview && (
                <AppText variant="caption" muted style={{ fontVariant: ["tabular-nums"] }}>
                  {`\n${preview.day.entries.length ? summary(preview.day) : "No food logged"}`}
                </AppText>
              )}
            </AppText>
            <IconButton
              label="Next day with food"
              icon="chevron-right"
              appearance="secondary"
              disabled={locked || !preview?.next}
              onPress={() => preview?.next && onFrom(preview.next)}
            />
          </View>
          {preview && !preview.day.entries.length && (
            <AppText variant="caption" muted>
              {preview.previous || preview.next
                ? `Nothing to copy from ${from}. The arrows go to days with food.`
                : "No other day has food to copy yet."}
            </AppText>
          )}
        </Section>
        {!preview ? (
          <FoodLogStatus source={{ kind: state.kind, retry: retryLoad }} />
        ) : preview.day.entries.length > 0 ? (
          <>
            <Panel testID="food-copy-meals" style={{ paddingVertical: spacing.sm, gap: 0 }}>
              {preview.meals.map(({ meal, entries, calories }, index) => {
                const option = meals.find((item) => item.key === meal)!;
                return (
                  <View
                    key={meal}
                    style={[
                      styles.row,
                      index > 0 && {
                        borderTopWidth: StyleSheet.hairlineWidth,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <IconWell
                      icon={option.icon}
                      color={meal === "drinks" ? colors.water : colors.primary}
                    />
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <AppText variant="label" style={{ fontFamily: fonts.bold }}>
                        {option.label}
                      </AppText>
                      <AppText variant="caption" muted style={{ fontVariant: ["tabular-nums"] }}>
                        {summary({ entries, calories })}
                      </AppText>
                      <AppText variant="caption" muted numberOfLines={2}>
                        {entries.map((entry) => entry.name).join(", ")}
                      </AppText>
                    </View>
                    <AppButton
                      size="small"
                      label={copying(meal) ? "Copying..." : "Copy"}
                      accessibilityLabel={`Copy ${option.label} to ${to}`}
                      disabled={locked}
                      busy={copying(meal)}
                      onPress={() => onCopy(meal)}
                    />
                  </View>
                );
              })}
            </Panel>
            {page.copy?.state === "failed" && (
              <InlineMessage>{`Couldn't copy ${label(page.copy.meal)}. Nothing was saved. Try again.`}</InlineMessage>
            )}
            <AppButton
              tone="primary"
              label={copying(null) ? "Copying..." : "Copy whole day"}
              accessibilityLabel={`Copy whole day, ${summary(preview.day)}, to ${to}`}
              disabled={locked}
              busy={copying(null)}
              onPress={() => onCopy(null)}
            />
          </>
        ) : null}
      </View>
    </SheetPage>
  );
}

const styles = StyleSheet.create({
  stepper: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
});
