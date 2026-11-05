import type { HealthConnectRecord } from "react-native-health-connect";
import { connect, openHealthConnect } from "../steps/device-steps.android";
import type { DeviceHealth, HealthAccess } from "./device-health";
import type { HealthWrite } from "./plan";

const recordTypes = { workout: "ExerciseSession", weight: "Weight", water: "Hydration" } as const;
const permissions = Object.values(recordTypes).map((recordType) => ({
  accessType: "write" as const,
  recordType,
}));
// Health Connect can't report a refusal, so this session remembers one until access is granted.
let refused = false;

const writesAll = (granted: { accessType: string; recordType: string }[]) =>
  permissions.every(({ recordType }) =>
    granted.some((item) => item.accessType === "write" && item.recordType === recordType),
  );

async function access(ask: boolean): Promise<HealthAccess> {
  const health = await connect();
  if (typeof health === "string") return health;
  if (!ask) {
    if (writesAll(await health.getGrantedPermissions())) return "granted";
    return refused ? "denied" : "undetermined";
  }
  // Android stops showing the dialog after repeated refusals; only settings can grant it then.
  refused = !writesAll(await health.requestPermission(permissions));
  return refused ? "denied" : "granted";
}

/** Health Connect's copy of a record. `clientRecordId` and its version make the insert an upsert. */
function record(write: HealthWrite, exerciseType: { strength: number; other: number }) {
  const metadata = { clientRecordId: write.id, clientRecordVersion: write.version };
  const iso = (time: number) => new Date(time).toISOString();
  switch (write.kind) {
    case "workout":
      return {
        recordType: "ExerciseSession",
        exerciseType: write.strength ? exerciseType.strength : exerciseType.other,
        title: write.title,
        startTime: iso(write.start),
        endTime: iso(write.end),
        metadata,
      } satisfies HealthConnectRecord;
    case "weight":
      return {
        recordType: "Weight",
        time: iso(write.time),
        weight: { value: write.kg, unit: "kilograms" },
        metadata,
      } satisfies HealthConnectRecord;
    case "water":
      return {
        recordType: "Hydration",
        startTime: iso(write.start),
        endTime: iso(write.end),
        volume: { value: write.ml, unit: "milliliters" },
        metadata,
      } satisfies HealthConnectRecord;
  }
}

export const deviceHealth: DeviceHealth = {
  name: "Health Connect",
  access: () => access(false),
  request: () => access(true),
  async save(writes) {
    const health = await connect();
    if (typeof health === "string") throw new Error("Health Connect isn't available.");
    const { STRENGTH_TRAINING: strength, OTHER_WORKOUT: other } = health.ExerciseType;
    await health.insertRecords(writes.map((write) => record(write, { strength, other })));
  },
  async remove(kind, ids) {
    const health = await connect();
    if (typeof health === "string") throw new Error("Health Connect isn't available.");
    await health.deleteRecordsByUuids(recordTypes[kind], [], [...ids]);
  },
  openSettings: openHealthConnect,
};
