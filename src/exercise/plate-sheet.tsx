import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { AppButton } from "../components/button";
import { ModalSheet } from "../components/modal-sheet";
import { SegmentedControl } from "../components/segmented-control";
import { AppText } from "../components/ui";
import { spacing } from "../theme/tokens";
import { Hairline } from "./controls";
import type { ExerciseSet } from "./model";
import {
  barChoices,
  barWeight,
  defaultBarKg,
  parseBarKg,
  plateLines,
  plateLoading,
  plateText,
  type BarKg,
} from "./plates";
import { useUnits } from "../units/provider";
import { PlusTag } from "../plus/locks";
import { usePaywall } from "../plus/paywall";
import { usePlus } from "../plus/provider";

/** The Plate calculator's bar, a device setting like the Rest timer's length. It saves the kilogram
 * bar; Imperial shows its pound counterpart. */
const barKey = "kinevault-track.plate-bar-kg";

/** The chosen bar: 20 kg until the saved choice loads, unless one is picked first. */
function useBar() {
  const [bar, setBar] = useState<BarKg>(defaultBarKg);
  const picked = useRef(false);
  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(barKey)
      .then((value) => {
        const saved = parseBarKg(value);
        if (live && saved !== null && !picked.current) setBar(saved);
      })
      // An unreadable choice keeps the 20 kg bar; the calculator still works.
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  function pick(next: BarKg) {
    picked.current = true;
    setBar(next);
    // shortcut: a failed save keeps the bar for this visit only; it's a convenience setting.
    void AsyncStorage.setItem(barKey, String(next)).catch(() => {});
  }
  return [bar, pick] as const;
}

/**
 * A Plates button under a weighted exercise's sets, and its sheet of plates for each set. Without
 * Plus the button wears the Plus tag and opens the paywall instead.
 */
export function PlateCalculator({ sets, rowLabel }: { sets: ExerciseSet[]; rowLabel: string }) {
  const [open, setOpen] = useState(false);
  const [bar, pickBar] = useBar();
  const { units } = useUnits();
  const { unlocked } = usePlus();
  const paywall = usePaywall();
  const lines = plateLines(sets, units);
  return (
    <>
      <AppButton
        size="compact"
        icon="calculator"
        label="Plates"
        accessibilityLabel={`Plates for ${rowLabel}${unlocked ? "" : ", part of Plus"}`}
        badge={!unlocked && <PlusTag />}
        onPress={() => (unlocked ? setOpen(true) : paywall.open("plates"))}
      />
      {paywall.sheet}
      <ModalSheet
        open={open}
        title="Plates per side"
        overline={rowLabel}
        onDismiss={() => setOpen(false)}
        testID="plate-sheet"
      >
        <SegmentedControl
          label="Bar"
          options={barChoices.map((value) => ({
            value,
            label: value ? `${plateText(barWeight(value, units), units)} bar` : "No bar",
            short: value ? plateText(barWeight(value, units), units) : "None",
          }))}
          value={bar}
          onChange={pickBar}
        />
        {lines.length ? (
          <View>
            {lines.map((line, index) => {
              const { plates, remainder } = plateLoading(line.weight, bar, units);
              return (
                <View key={line.key}>
                  {index > 0 && <Hairline />}
                  <View style={{ gap: 2, paddingVertical: spacing.md }}>
                    <AppText variant="caption" muted>
                      {[line.name, line.warmUp && "Warm-up", plateText(line.weight, units)]
                        .filter(Boolean)
                        .join(" · ")}
                    </AppText>
                    <AppText variant="label" style={{ fontVariant: ["tabular-nums"] }}>
                      {plates}
                    </AppText>
                    {remainder && (
                      <AppText variant="caption" muted>
                        {remainder}
                      </AppText>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <AppText muted>Enter a weight to see its plates.</AppText>
        )}
        <AppButton label="Done" onPress={() => setOpen(false)} />
      </ModalSheet>
    </>
  );
}
