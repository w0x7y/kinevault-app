import { useEffect } from "react";
import { AppState } from "react-native";
import { useExercises } from "../exercise/provider";
import { useFoodLog } from "../food/log-provider";
import { createDocumentProvider } from "../persistence/document-provider";
import { useProfile } from "../profile/provider";
import { useWaterLog } from "../water/provider";
import { deviceHealth } from "./device-health";
import { createHealthWriter } from "./writer";

/**
 * Save to Apple Health or Health Connect: each account's own choice on this device, kept in its
 * local storage and never synced, so another account signing in here starts with it off.
 */
const settingKey = "kinevault-track.health-write";

// Mounted once per account scope, inside the tracking documents it reads.
export const { Provider: HealthWriteProvider, useDocument: useHealthWrite } =
  createDocumentProvider({
    name: "HealthWriteProvider",
    create: (storage) =>
      createHealthWriter({
        storage,
        device: deviceHealth,
        setting: {
          load: async () => (await storage.getItem(settingKey)) === "on",
          save: (enabled) => storage.setItem(settingKey, enabled ? "on" : "off"),
        },
      }),
    useValue(snapshot, writer) {
      const exercise = useExercises().state;
      const food = useFoodLog().state;
      const water = useWaterLog().state;
      const profile = useProfile().state;
      useEffect(() => {
        // Writing from a document that hasn't loaded would remove its records from the store.
        writer.setSources(
          exercise.kind === "ready" &&
            food.kind === "ready" &&
            water.kind === "ready" &&
            profile.kind === "ready"
            ? {
                sessions: exercise.document.sessions,
                weights: profile.document.weightEntries ?? [],
                food: food.document.days,
                water: water.document.days,
              }
            : null,
        );
      }, [writer, exercise, food, water, profile]);
      useEffect(() => {
        const subscription = AppState.addEventListener("change", (state) => {
          if (state === "active") void writer.refresh();
        });
        return () => subscription.remove();
      }, [writer]);
      return {
        ...snapshot,
        name: writer.name,
        setEnabled: writer.setEnabled,
        connect: writer.connect,
        retry: writer.refresh,
        openSettings: writer.openSettings,
      };
    },
  });
