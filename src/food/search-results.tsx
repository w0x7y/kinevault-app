import { IconButton } from "../components/button";
import { useMemo, useState } from "react";
import { StyleSheet, View, type ViewProps } from "react-native";
import { AppText, Overline, Panel } from "../components/ui";
import { useTheme } from "../theme/provider";
import { spacing } from "../theme/tokens";
import { foodKey, foodPageSize, type CatalogFood } from "./catalog.ts";
import { foodSource } from "./database";
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
  const days = log.state.kind === "ready" ? log.state.document.days : null;
  const logged = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entries of Object.values(days ?? {}))
      for (const entry of entries)
        counts.set(foodKey(entry), (counts.get(foodKey(entry)) ?? 0) + 1);
    return counts;
  }, [days]);
  const [page, setPage] = useState(0);
  const result = useMemo(
    () => selection.search({ purpose: "logging", query, page, logged }),
    [selection, query, page, logged],
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
        {result.pageCount > 1 && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              paddingTop: spacing.sm,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderColor: colors.border,
            }}
          >
            <AppText variant="caption" muted style={{ flex: 1, fontVariant: ["tabular-nums"] }}>
              Showing {result.page * foodPageSize + 1} to{" "}
              {Math.min((result.page + 1) * foodPageSize, result.total)} of{" "}
              {result.total.toLocaleString()}
            </AppText>
            <IconButton
              appearance="secondary"
              icon="chevron-left"
              label="Previous food results"
              disabled={result.page === 0}
              onPress={() => changePage(result.page - 1)}
            />
            <IconButton
              appearance="secondary"
              icon="chevron-right"
              label="Next food results"
              disabled={result.page + 1 >= result.pageCount}
              onPress={() => changePage(result.page + 1)}
            />
          </View>
        )}
      </Panel>
      {databaseRows && (
        <AppText
          variant="caption"
          muted
          selectable
          style={{ paddingHorizontal: spacing.xs, textAlign: "center" }}
        >
          {foodSource.name} · {foodSource.dataset}
        </AppText>
      )}
    </View>
  );
}
