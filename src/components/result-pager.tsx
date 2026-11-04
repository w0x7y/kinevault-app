import { StyleSheet, View } from "react-native";
import { useTheme } from "../theme/provider";
import { spacing } from "../theme/tokens";
import { IconButton } from "./button";
import type { ResultPage } from "./paging";
import { AppText } from "./ui";

/**
 * The row under a page of search results: "Showing 21 to 40 of 41" and the previous and next
 * page buttons, named for `noun` ("Next food results"). Nothing when everything fits on one page.
 */
export function ResultPager({
  result: { page, pageCount, total },
  size,
  noun,
  onPage,
}: {
  result: ResultPage;
  /** Results per page. */
  size: number;
  noun: string;
  onPage: (page: number) => void;
}) {
  const { colors } = useTheme();
  if (pageCount <= 1) return null;
  return (
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
        Showing {page * size + 1} to {Math.min((page + 1) * size, total)} of{" "}
        {total.toLocaleString()}
      </AppText>
      <IconButton
        appearance="secondary"
        icon="chevron-left"
        label={`Previous ${noun} results`}
        disabled={page === 0}
        onPress={() => onPage(page - 1)}
      />
      <IconButton
        appearance="secondary"
        icon="chevron-right"
        label={`Next ${noun} results`}
        disabled={page + 1 >= pageCount}
        onPress={() => onPage(page + 1)}
      />
    </View>
  );
}
