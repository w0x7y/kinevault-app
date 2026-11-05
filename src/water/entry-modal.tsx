import { DayAmountSheet } from "../persistence/day-amount-sheet";
import { createManualWaterEdit } from "./manual-editing";
import { useWaterLogPersistence } from "./provider";
import { useUnits } from "../units/provider";
import { unitName } from "../units/units";

// Home keys this modal by date, so each open day gets its own Manual water edit.
export function WaterEntryModal({ date, onDismiss }: { date: string; onDismiss: () => void }) {
  const log = useWaterLogPersistence();
  const { units } = useUnits();
  const unit = unitName("fluid", units);
  return (
    <DayAmountSheet
      date={date}
      onDismiss={onDismiss}
      createEdit={() => createManualWaterEdit({ log, date, units })}
      title="Edit water"
      description="Edit manual water for this day. Drinks count separately in your Home total."
      testID="water-entry"
      fieldLabel={`Manual water (${unit})`}
      unit={unit}
      // A cup: 250 ml, or 8 fl oz.
      step={units === "metric" ? 250 : 8}
      quantity="fluid"
      noun="water"
      loadingLabel="Loading water log..."
      loadFailure="Couldn't load your water log."
      retryLabel="Retry water log"
    />
  );
}
