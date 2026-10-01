import { useMemo, useState } from "react";
import { View } from "react-native";
import { AppText } from "../components/ui";
import { spacing } from "../theme/tokens";
import { foodKey, foodPageSize, type CatalogFood } from "./catalog.ts";
import { useCustomFoods } from "./custom-provider";
import { FoodField } from "./form-fields";
import { FoodResult } from "./search-results";
import { FoodButton } from "./food-button";

export function IngredientSearch({ onAdd, disabled }: { onAdd: (food: CatalogFood) => void; disabled: boolean }) {
  const { catalog } = useCustomFoods();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const result = useMemo(() => catalog.search(query, page), [catalog, query, page]);
  return <View style={{ gap: spacing.layout }}>
    <FoodField label="Search ingredients" value={query} disabled={disabled} onChange={value => { setQuery(value); setPage(0); }} />
    {query.trim().length >= 2 && <>
      <AppText variant="caption" muted accessibilityLiveRegion="polite">
        {result.total ? `${result.total.toLocaleString()} foods. Tap a food to add it.` : "No foods found. Try a different name."}
      </AppText>
      {result.items.map(food => <FoodResult key={foodKey(food)} food={food} action="add" disabled={disabled}
        onSelect={() => { onAdd(food); setQuery(""); setPage(0); }} />)}
      {result.total > foodPageSize && <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.layout }}>
        <FoodButton label="Previous" accessibilityLabel="Previous ingredient results" disabled={disabled || page === 0} onPress={() => setPage(page - 1)} />
        <FoodButton label="Next" accessibilityLabel="Next ingredient results" disabled={disabled || (page + 1) * foodPageSize >= result.total} onPress={() => setPage(page + 1)} />
      </View>}
    </>}
  </View>;
}
