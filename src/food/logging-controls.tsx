import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { parseDay } from "../calendar/dates.ts";
import { AppText } from "../components/ui";
import { meals, type Meal } from "../daily/model.ts";
import { useTheme } from "../theme/provider";
import { spacing } from "../theme/tokens";
import type { FoodSaveTarget } from "./log-model.ts";
import { FoodButton } from "./food-button";
import { useFoodLog } from "./log-provider";
import { useCustomFoods } from "./custom-provider";
import type { CatalogKind } from "./meal-model.ts";

export function FoodLoggingControls({ target, grams, date, onSaved, itemKind = "food" }: {
  itemKind?: CatalogKind;
  target: FoodSaveTarget;
  grams: number | null;
  date: string;
  onSaved: () => void;
}) {
  const log = useFoodLog();
  const custom = useCustomFoods();
  const busy = log.saving || custom.saving;
  const { colors } = useTheme();
  const [meal, setMeal] = useState<Meal>(target.kind === "edit" ? target.entry.meal : "breakfast");
  const [failed, setFailed] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function save() {
    if (pending.current || grams === null || busy || log.state.kind !== "ready") return;
    pending.current = true;
    setFailed(false);
    try {
      const saved = await (target.kind === "edit"
        ? log.edit({ date, id: target.entry.id, grams, meal })
        : log.add({ date, food: target.food, grams, meal }));
      if (!mounted.current) return;
      if (saved) onSaved();
      else setFailed(true);
    } catch {
      if (mounted.current) setFailed(true);
    } finally { pending.current = false; }
  }
  return (
    <View style={{ gap: spacing.layout }}>
      <AppText variant="label" accessibilityRole="header">Meal for {parseDay(date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</AppText>
      <View accessibilityLabel="Meal" style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        {meals.map(option => (
          <View key={option.key} style={{ flexGrow: 1, flexBasis: "45%" }}>
            <FoodButton label={option.label} accessibilityLabel={`Log to ${option.label}`} selected={meal === option.key}
              disabled={busy} onPress={() => setMeal(option.key)} />
          </View>
        ))}
      </View>
      {failed && <AppText variant="caption" accessibilityRole="alert" style={{ color: colors.error }}>
        {target.kind === "edit" ? "Couldn't save your changes." : `Couldn't log this ${itemKind}.`} Your amount and meal are kept. Try again.
      </AppText>}
      <FoodButton primary label={log.saving ? `Saving ${itemKind}...` : target.kind === "edit" ? "Save changes" : `Log ${itemKind}`}
        disabled={grams === null || busy || log.state.kind !== "ready"} onPress={() => { void save(); }} />
    </View>
  );
}
