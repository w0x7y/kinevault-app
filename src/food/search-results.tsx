import { useMemo, useState } from "react";
import { ResultPager } from "../components/result-pager";
import { StyleSheet, View, type ViewProps } from "react-native";
import { AppText, Overline, Panel } from "../components/ui";
import { useTheme } from "../theme/provider";
import { spacing } from "../theme/tokens";
import { foodKey, foodPageSize, type CatalogFood } from "./catalog.ts";
import { getFoodDatabase } from "./database";
import { useCustomFoods } from "./custom-provider";
import { useFoodLog } from "./log-provider";
import { FoodResult, GenericNotice } from "./food-result";

export function FoodSearchResults({
  query,
  onLayout,
  onNavigate,
  onSelect,
}: {
  query: string;
  onLayout: ViewProps["onLayout"];
  onNavigate: () => void;
  /** A chosen food opens on its own page above the results it came from. */
  onSelect: (food: CatalogFood) => void;
}) {
  const { selection } = useCustomFoods();
  const { colors } = useTheme();
  const log = useFoodLog();
  const saved = log.state.kind === "ready" ? log.state.document : undefined;
  const [page, setPage] = useState(0);
  const result = useMemo(
    () => selection.search({ purpose: "logging", query, page, log: saved }),
    [selection, query, page, saved],
  );
  const hasGenericMatches = result.rows.some((row) => row.genericMatch);
  if (page !== result.page) setPage(result.page);
  function changePage(nextPage: number) {
    setPage(nextPage);
    onNavigate();
  }
  const databaseRows = result.rows.some(({ food }) => !food.customId);
  return (
    <View testID="food-catalog-results" onLayout={onLayout} style={{ gap: spacing.sm }}>
      <Panel style={{ gap: spacing.sm, paddingBottom: spacing.sm }}>
        <View style={{ gap: 2 }}>
          <Overline>Foods and meals</Overline>
          <AppText variant="caption" muted accessibilityLiveRegion="polite">
            {query.trim().length < 2
              ? "Type at least two letters to search foods and meals."
              : result.total === 1
                ? "1 matching food or meal."
                : result.total
                  ? `${result.total.toLocaleString()} matching foods and meals.`
                  : "No foods or meals found. Try a simpler name or a different preparation."}
          </AppText>
        </View>
        {hasGenericMatches && <GenericNotice />}
        <View>
          {result.rows.map(({ food, kind, genericMatch }, index) => (
            <View
              key={foodKey(food)}
              style={{
                borderTopWidth: index ? StyleSheet.hairlineWidth : 0,
                borderColor: colors.border,
              }}
            >
              <FoodResult
                kind={kind}
                genericMatch={genericMatch}
                food={food}
                onSelect={() => onSelect(food)}
              />
            </View>
          ))}
        </View>
        <ResultPager result={result} size={foodPageSize} noun="food" onPage={changePage} />
      </Panel>
      {databaseRows && (
        <AppText
          variant="caption"
          muted
          selectable
          style={{ paddingHorizontal: spacing.xs, textAlign: "center" }}
        >
          {getFoodDatabase().source.name} · {getFoodDatabase().source.dataset}
        </AppText>
      )}
    </View>
  );
}
