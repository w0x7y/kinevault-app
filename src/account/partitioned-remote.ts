import {
  assembleHistory,
  partitionHistory,
  isHistoryKey,
  validPart,
  type HistoryKey,
  type HistoryParts,
} from "./history-partitions.ts";
import type { AccountRemote, CloudDocument } from "./storage.ts";

export type PartitionRow = {
  document_key: string;
  part_key: string;
  payload: string;
  revision: number;
  updated_at: string;
};
export type PartitionSave = {
  key: HistoryKey;
  expectedRevision: number;
  deleted: boolean;
  parts: string[];
  changes: HistoryParts;
};
export type PartitionTransport = {
  /** One database snapshot. Manifest rows always return; unchanged parts do not. */
  list(known: Record<string, number>): Promise<PartitionRow[]>;
  /** Commit changed parts and the manifest together, or return a CAS conflict. */
  save(input: PartitionSave): Promise<{ revision: number; updated_at: string } | null>;
};
type CachedHistory = { document: CloudDocument; parts: HistoryParts };
function checkedRow(row: PartitionRow) {
  if (
    !isHistoryKey(row.document_key) ||
    (row.part_key !== "manifest" && !validPart(row.document_key, row.part_key)) ||
    !Number.isSafeInteger(row.revision) ||
    row.revision < 1 ||
    typeof row.payload !== "string" ||
    typeof row.updated_at !== "string"
  )
    throw new Error("Invalid cloud history partition");
  return row;
}
function readManifest(raw: string, key: string): { deleted: boolean; parts: string[] } {
  const value = JSON.parse(raw);
  if (
    !value ||
    value.version !== 2 ||
    typeof value.deleted !== "boolean" ||
    !Array.isArray(value.parts) ||
    value.parts.some((part: unknown) => typeof part !== "string" || !validPart(key, part)) ||
    new Set(value.parts).size !== value.parts.length ||
    (value.deleted && value.parts.length)
  )
    throw new Error("Invalid cloud history manifest");
  return value;
}
/** Logical v1 documents keep their revision/conflict semantics over bounded writes. */
export function createPartitionedRemote(
  legacy: AccountRemote,
  transport: PartitionTransport,
): AccountRemote {
  let cache = new Map<HistoryKey, CachedHistory>();
  return {
    async list() {
      const rows = (
        await transport.list(
          Object.fromEntries([...cache].map(([key, value]) => [key, value.document.revision])),
        )
      ).map(checkedRow);
      const next = new Map<HistoryKey, CachedHistory>(),
        seen = new Set<string>();
      for (const row of rows) {
        const id = `${row.document_key}/${row.part_key}`;
        if (seen.has(id)) throw new Error("Duplicate cloud history partition");
        seen.add(id);
      }
      for (const root of rows.filter((row) => row.part_key === "manifest")) {
        const key = root.document_key as HistoryKey,
          previous = cache.get(key),
          manifest = readManifest(root.payload, key),
          parts: HistoryParts = {};
        if (previous && root.revision < previous.document.revision)
          throw new Error("Cloud history revision moved backward");
        for (const part of manifest.parts) {
          const changed = rows.find((row) => row.document_key === key && row.part_key === part);
          if (changed && changed.revision > root.revision)
            throw new Error("Cloud history is inconsistent");
          const raw = changed?.payload ?? previous?.parts[part];
          if (raw === undefined) throw new Error("Missing cloud history partition");
          parts[part] = raw;
        }
        next.set(key, {
          document: {
            document_key: key,
            payload: assembleHistory(key, parts, manifest.deleted),
            revision: root.revision,
            updated_at: root.updated_at,
          },
          parts,
        });
      }
      if (rows.some((row) => !next.has(row.document_key as HistoryKey)))
        throw new Error("History partition has no manifest");
      const originals = await legacy.list([...next.keys()]);
      const result = originals
        .filter((row) => !next.has(row.document_key as HistoryKey))
        .concat([...next.values()].map((value) => value.document));
      // Publish cache only after every document validates, including legacy rows.
      // Legacy download can outlive an account lifecycle while another read or
      // save advances this adapter's cache. Recheck after that await too.
      if (
        [...cache].some(
          ([key, value]) => (next.get(key)?.document.revision ?? -1) < value.document.revision,
        )
      )
        throw new Error("Cloud history revision moved backward");
      cache = next;
      return result;
    },
    async save(key, payload, expectedRevision) {
      if (!isHistoryKey(key)) return legacy.save(key, payload, expectedRevision);
      const previous = cache.get(key);
      // No cache means migration. Send every part, while SQL verifies the v1 CAS.
      const parts = partitionHistory(key, payload, previous?.parts),
        changes: HistoryParts = {};
      for (const [part, value] of Object.entries(parts))
        if (previous?.parts[part] !== value) changes[part] = value;
      const saved = await transport.save({
        key,
        expectedRevision,
        deleted: payload === null,
        parts: Object.keys(parts),
        changes,
      });
      if (saved === null) return null;
      if (
        !Number.isSafeInteger(saved.revision) ||
        saved.revision !== expectedRevision + 1 ||
        typeof saved.updated_at !== "string"
      )
        throw new Error("Invalid partition save result");
      const document = {
        document_key: key,
        payload: assembleHistory(key, parts, payload === null),
        ...saved,
      };
      if ((cache.get(key)?.document.revision ?? 0) <= document.revision)
        cache.set(key, { document, parts });
      return document;
    },
  };
}
