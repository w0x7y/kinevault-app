// Isolated Metro entry: the Health settings group over a real writer and a fake Health Connect,
// since the web preview itself hides the group.
import { registerRootComponent } from "expo";
import { useState, useSyncExternalStore } from "react";
import { View } from "react-native";
import type { DeviceHealth, HealthAccess } from "../src/health/device-health";
import { HealthSettingsGroup } from "../src/health/settings";
import { createHealthWriter } from "../src/health/writer";
import { ThemeProvider } from "../src/theme/provider";

const control = globalThis as unknown as {
  /** Stands in for the app returning to the foreground. */
  refreshHealth: () => Promise<void>;
  healthFixture: {
    enabled: boolean;
    access: HealthAccess;
    /** What the permission dialog answers. */
    answer: HealthAccess;
    failSave: boolean;
    failSetting: boolean;
    saves: string[];
    settingsOpened: number;
  };
};
const fixture = (control.healthFixture ??= {
  enabled: false,
  access: "undetermined",
  answer: "granted",
  failSave: false,
  failSetting: false,
  saves: [],
  settingsOpened: 0,
});

const device: DeviceHealth = {
  name: "Health Connect",
  access: async () => fixture.access,
  request: async () => (fixture.access = fixture.answer),
  async save(writes) {
    if (fixture.failSave) throw new Error("Fixture save failure");
    fixture.saves.push(...writes.map(({ id }) => id));
  },
  remove: async () => {},
  openSettings: async () => {
    fixture.settingsOpened += 1;
  },
};
const memory = new Map<string, string>();
let enabled = fixture.enabled;
const writer = createHealthWriter({
  device,
  storage: {
    getItem: async (key) => memory.get(key) ?? null,
    setItem: async (key, value) => void memory.set(key, value),
  },
  setting: {
    load: async () => enabled,
    async save(value) {
      if (fixture.failSetting) throw new Error("Fixture setting failure");
      enabled = value;
    },
  },
});
writer.start();
control.refreshHealth = writer.refresh;
writer.setSources({ sessions: [], weights: [{ date: "2026-10-01", kg: 80 }], food: {}, water: {} });

function HealthFixture() {
  const snapshot = useSyncExternalStore(writer.subscribe, writer.getSnapshot);
  const [health] = useState(() => ({
    name: writer.name,
    setEnabled: writer.setEnabled,
    connect: writer.connect,
    retry: writer.refresh,
    openSettings: writer.openSettings,
  }));
  return (
    <ThemeProvider>
      <View style={{ padding: 16 }}>
        <HealthSettingsGroup health={{ ...snapshot, ...health }} />
      </View>
    </ThemeProvider>
  );
}

registerRootComponent(HealthFixture);
