import { DayAmountSheet } from "../persistence/day-amount-sheet";
import { createManualWaterEdit } from "./manual-editing";
import { useWaterLogPersistence } from "./provider";

// Home keys this modal by date, so each open day gets its own Manual water edit.
export function WaterEntryModal({ date, onDismiss }: { date: string; onDismiss: () => void }) {
  const log = useWaterLogPersistence();
  return (
    <DayAmountSheet
      date={date}
      onDismiss={onDismiss}
      createEdit={() => createManualWaterEdit({ log, date })}
      title="Edit water"
      description="Edit manual water for this day. Drinks count separately in your Home total."
      testID="water-entry"
      fieldLabel="Manual water (ml)"
      unit="ml"
      step={250}
      noun="water"
      loadingLabel="Loading water log..."
      loadFailure="Couldn't load your water log."
      retryLabel="Retry water log"
    />
  );
}
