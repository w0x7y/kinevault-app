import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";
import { useColorScheme } from "react-native";
import {
  parseAppearance,
  resolveAppearance,
  type AppearancePreference,
  type ResolvedAppearance,
} from "./preferences";
import { darkColors, lightColors, type ThemeColors } from "./tokens";

const storageKey = "kinevault-track.appearance";

type ThemeContextValue = {
  colors: ThemeColors;
  appearance: ResolvedAppearance;
  preference: AppearancePreference;
  ready: boolean;
  saving: boolean;
  error: string | null;
  setPreference: (preference: AppearancePreference) => Promise<void>;
  retryLoad: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const system = useColorScheme();
  const [preference, updatePreference] = useState<AppearancePreference>("system");
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(storageKey)
      .then((value) => {
        if (active) {
          updatePreference(parseAppearance(value));
          setError(null);
        }
      })
      .catch(() => {
        if (active) setError("Couldn't load your appearance setting. Try again.");
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [loadAttempt]);

  const appearance = resolveAppearance(preference, system);

  async function setPreference(next: AppearancePreference) {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await AsyncStorage.setItem(storageKey, next);
      updatePreference(next);
    } catch {
      setError("Couldn't save your appearance. Try selecting it again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ThemeContext.Provider
      value={{
        colors: appearance === "dark" ? darkColors : lightColors,
        appearance,
        preference,
        ready,
        saving,
        error,
        setPreference,
        retryLoad: () => setLoadAttempt((attempt) => attempt + 1),
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error("useTheme must be used inside ThemeProvider");
  return theme;
}
