import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";
import { parseUnitSystem, savedText, fieldText, type Quantity, type UnitSystem } from "./units";

/** The Units setting, a device setting like the appearance. It never syncs. */
const storageKey = "kinevault-track.units";

type UnitsContextValue = {
  units: UnitSystem;
  /** The saved setting has been read, or failed to read. */
  ready: boolean;
  saving: boolean;
  error: string | null;
  setUnits: (units: UnitSystem) => Promise<void>;
  retryLoad: () => void;
};

// Outside the provider (test fixtures) everything reads as Metric.
const UnitsContext = createContext<UnitsContextValue>({
  units: "metric",
  ready: true,
  saving: false,
  error: null,
  setUnits: async () => {},
  retryLoad: () => {},
});

export function UnitsProvider({ children }: PropsWithChildren) {
  const [units, updateUnits] = useState<UnitSystem>("metric");
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(storageKey)
      .then((value) => {
        if (active) {
          updateUnits(parseUnitSystem(value));
          setError(null);
        }
      })
      .catch(() => {
        if (active) setError("Couldn't load your units setting. Try again.");
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [loadAttempt]);

  async function setUnits(next: UnitSystem) {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await AsyncStorage.setItem(storageKey, next);
      updateUnits(next);
    } catch {
      setError("Couldn't save your units. Try selecting them again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <UnitsContext.Provider
      value={{
        units,
        ready,
        saving,
        error,
        setUnits,
        retryLoad: () => setLoadAttempt((attempt) => attempt + 1),
      }}
    >
      {children}
    </UnitsContext.Provider>
  );
}

export function useUnits() {
  return useContext(UnitsContext);
}

/**
 * A text field's value and change handler for saved metric text, shown and typed in the chosen
 * units. What was typed shows for as long as it still saves the same text, so "5." stays "5.".
 * Without a `quantity` the text passes through.
 */
export function useUnitField(
  quantity: Quantity | undefined,
  saved: string,
  onChange: (saved: string) => void,
): { value: string; onChange: (text: string) => void } {
  const { units } = useUnits();
  const [typed, setTyped] = useState<string | null>(null);
  if (!quantity) return { value: saved, onChange };
  return {
    value:
      typed !== null && savedText(quantity, typed, units) === saved
        ? typed
        : fieldText(quantity, saved, units),
    onChange(text) {
      setTyped(text);
      onChange(savedText(quantity, text, units));
    },
  };
}
