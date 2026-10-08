import { parseFoodLog } from "../food/log-model.ts";
import { parseExerciseDocument, type WorkoutSession } from "../exercise/model.ts";
import type { AccountLocalStorage } from "./storage.ts";

export const historyKeys = ["kinevault-track.food-log.v1", "kinevault-track.exercise.v1"] as const;
export type HistoryKey = (typeof historyKeys)[number];
export type HistoryParts = Record<string, string>;
export function isHistoryKey(key: string): key is HistoryKey {
  return historyKeys.some((item) => item === key);
}
export function validPart(key: string, part: string): boolean {
  return (
    isHistoryKey(key) &&
    ((part === "library" && key === historyKeys[1]) || /^\d{4}-(0[1-9]|1[0-2])$/.test(part))
  );
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid history partition");
  return value as Record<string, unknown>;
}
function positions(previous: HistoryParts): Map<string, number> {
  const result = new Map<string, number>();
  for (const [part, raw] of Object.entries(previous)) {
    if (part === "library") continue;
    for (const [id, position] of Object.entries(object(object(JSON.parse(raw)).order))) {
      if (!Number.isSafeInteger(position) || (position as number) < 0 || result.has(id))
        throw new Error("Invalid history order");
      result.set(id, position as number);
    }
  }
  return result;
}
/** Stable positions avoid rewriting later months after deleting an earlier item. */
function orderFor(ids: string[], previous: HistoryParts): Record<string, number> {
  const old = positions(previous),
    retained = ids.filter((id) => old.has(id));
  const unchangedOrder = retained.every(
    (id, index) => index === 0 || old.get(retained[index - 1]!)! < old.get(id)!,
  );
  let next = 0;
  for (const position of old.values()) next = Math.max(next, position + 1);
  const order: Record<string, number> = Object.create(null);
  for (const [index, id] of ids.entries())
    order[id] = unchangedOrder ? (old.get(id) ?? next++) : index;
  // A newly inserted item before a retained item needs a complete reorder.
  if (ids.some((id, index) => index > 0 && order[ids[index - 1]!]! >= order[id]!))
    return Object.fromEntries(ids.map((id, index) => [id, index]));
  return order;
}
export function partitionHistory(
  key: HistoryKey,
  payload: string | null,
  previous: HistoryParts = {},
): HistoryParts {
  if (payload === null) return {};
  const result: HistoryParts = {};
  let expected: string;
  if (key === historyKeys[0]) {
    const document = parseFoodLog(payload),
      order = orderFor(Object.keys(document.days), previous);
    expected = JSON.stringify(document);
    const months: Record<string, typeof document.days> = {};
    for (const [date, entries] of Object.entries(document.days))
      (months[date.slice(0, 7)] ??= {})[date] = entries;
    for (const [month, days] of Object.entries(months))
      result[month] = JSON.stringify({
        version: 2,
        days,
        order: Object.fromEntries(Object.keys(days).map((date) => [date, order[date]])),
      });
  } else {
    const document = parseExerciseDocument(payload),
      { sessions, ...library } = document,
      order = orderFor(
        sessions.map((session) => session.id),
        previous,
      );
    expected = JSON.stringify(document);
    result.library = JSON.stringify(library);
    const months: Record<string, WorkoutSession[]> = {};
    for (const session of sessions) (months[session.date.slice(0, 7)] ??= []).push(session);
    for (const [month, sessions] of Object.entries(months))
      result[month] = JSON.stringify({
        version: 2,
        sessions,
        order: Object.fromEntries(sessions.map((session) => [session.id, order[session.id]])),
      });
  }
  if (assembleHistory(key, result) !== expected)
    throw new Error("History could not be partitioned losslessly");
  return result;
}
export function assembleHistory(
  key: HistoryKey,
  parts: HistoryParts,
  deleted = false,
): string | null {
  if (deleted) {
    if (Object.keys(parts).length) throw new Error("Deleted history has partitions");
    return null;
  }
  const order = positions(parts);
  if (new Set(order.values()).size !== order.size) throw new Error("Duplicate history position");
  const days: Record<string, unknown> = {},
    sessions: WorkoutSession[] = [];
  for (const [part, raw] of Object.entries(parts)) {
    if (!validPart(key, part)) throw new Error("Invalid history month");
    if (part === "library") continue;
    const value = object(JSON.parse(raw));
    if (value.version !== 2) throw new Error("Unsupported history partition");
    if (key === historyKeys[0]) {
      for (const [date, entries] of Object.entries(object(value.days))) {
        if (!date.startsWith(`${part}-`) || !order.has(date) || date in days)
          throw new Error("Invalid food history partition");
        days[date] = entries;
      }
    } else {
      if (!Array.isArray(value.sessions)) throw new Error("Invalid exercise history partition");
      for (const session of value.sessions as WorkoutSession[]) {
        if (
          typeof session.date !== "string" ||
          !session.date.startsWith(`${part}-`) ||
          !order.has(session.id)
        )
          throw new Error("Invalid exercise history month");
        sessions.push(session);
      }
    }
  }
  const sort = (a: string, b: string) => order.get(a)! - order.get(b)!;
  if (key === historyKeys[0]) {
    if (Object.keys(days).length !== order.size) throw new Error("Incomplete food history order");
    return JSON.stringify(
      parseFoodLog(
        JSON.stringify({
          version: 1,
          days: Object.fromEntries(
            Object.keys(days)
              .sort(sort)
              .map((date) => [date, days[date]]),
          ),
        }),
      ),
    );
  }
  if (!parts.library || sessions.length !== order.size)
    throw new Error("Incomplete exercise history");
  return JSON.stringify(
    parseExerciseDocument(
      JSON.stringify({
        ...object(JSON.parse(parts.library)),
        sessions: sessions.sort((a, b) => sort(a.id, b.id)),
      }),
    ),
  );
}

type LocalManifest = {
  historyFormat: 2;
  generation: number;
  envelope: Record<string, unknown> | null;
  deleted: boolean;
  refs: Record<string, string>;
};
function manifest(raw: string | null): LocalManifest | null {
  if (raw === null) return null;
  const value = object(JSON.parse(raw));
  if (value.historyFormat !== 2) return null;
  if (
    !Number.isSafeInteger(value.generation) ||
    (value.generation as number) < 1 ||
    typeof value.deleted !== "boolean"
  )
    throw new Error("Invalid history manifest");
  const refs = object(value.refs);
  if (Object.values(refs).some((ref) => typeof ref !== "string"))
    throw new Error("Invalid history references");
  return {
    historyFormat: 2,
    generation: value.generation as number,
    deleted: value.deleted,
    refs: refs as Record<string, string>,
    envelope: value.envelope === null ? null : object(value.envelope),
  };
}
const adapters = new WeakMap<AccountLocalStorage, AccountLocalStorage>();
const originals = new WeakMap<AccountLocalStorage, AccountLocalStorage>();
/** Validated replacement needs sync metadata even when fragments are unreadable. */
export async function readHistoryEnvelopeMetadata(
  local: AccountLocalStorage,
  key: string,
): Promise<string | null> {
  const raw = await (originals.get(local) ?? local).getItem(key),
    root = manifest(raw);
  if (!root) return raw;
  return root.envelope === null ? null : JSON.stringify({ ...root.envelope, payload: null });
}
/** Copy-on-write fragments become visible together through one root-key write. */
export function createPartitionedLocalStorage(local: AccountLocalStorage): AccountLocalStorage {
  if (originals.has(local)) return local;
  const existing = adapters.get(local);
  if (existing) return existing;
  const readers = new Map<string, number>(),
    retired = new Map<string, Set<string>>();
  const decoded = new Map<string, { raw: string; parts: HistoryParts }>();
  const logicalKey = (key: string) =>
    historyKeys.find((history) => key === history || key.endsWith(`.${history}`));
  async function cleanup(key: string) {
    if (readers.get(key)) return;
    const refs = retired.get(key);
    retired.delete(key);
    if (refs) await Promise.allSettled([...refs].map((ref) => local.removeItem(ref)));
  }
  async function load(key: string, root: LocalManifest, raw: string): Promise<HistoryParts> {
    const cached = decoded.get(key);
    if (cached?.raw === raw) return cached.parts;
    const parts: HistoryParts = {};
    for (const [part, ref] of Object.entries(root.refs)) {
      if (!validPart(logicalKey(key)!, part) || !ref.startsWith(`${key}.partition.v2.${part}.`))
        throw new Error("Invalid local history reference");
      const value = await local.getItem(ref);
      if (value === null) throw new Error("Missing history partition");
      parts[part] = value;
    }
    decoded.set(key, { raw, parts });
    return parts;
  }
  const adapter: AccountLocalStorage = {
    async getItem(key) {
      const history = logicalKey(key);
      if (!history) return local.getItem(key);
      readers.set(key, (readers.get(key) ?? 0) + 1);
      try {
        const raw = await local.getItem(key),
          root = manifest(raw);
        if (!root) return raw;
        const payload = assembleHistory(history, await load(key, root, raw!), root.deleted);
        return root.envelope === null ? payload : JSON.stringify({ ...root.envelope, payload });
      } finally {
        readers.set(key, readers.get(key)! - 1);
        void cleanup(key);
      }
    },
    async setItem(key, raw) {
      const history = logicalKey(key);
      if (!history) return local.setItem(key, raw);
      const value = object(JSON.parse(raw));
      const isEnvelope = typeof value.payload === "string" || value.payload === null;
      const payload = isEnvelope ? (value.payload as string | null) : raw;
      const oldRaw = await local.getItem(key),
        old = manifest(oldRaw);
      let previous: HistoryParts = {};
      if (old) {
        // A valid replacement can recover damaged fragments. Root metadata
        // still preserves the envelope's revision and pending-save status.
        try {
          previous = await load(key, old, oldRaw!);
          assembleHistory(history, previous, old.deleted);
        } catch {
          previous = {};
        }
      }
      const parts = partitionHistory(history, payload, previous);
      const generation = (old?.generation ?? 0) + 1,
        refs: Record<string, string> = {};
      const created: string[] = [];
      try {
        for (const [part, data] of Object.entries(parts)) {
          if (previous[part] === data && old?.refs[part]) refs[part] = old.refs[part]!;
          else {
            const ref = `${key}.partition.v2.${part}.${generation}-${Math.random().toString(36).slice(2)}`;
            created.push(ref);
            await local.setItem(ref, data);
            refs[part] = ref;
          }
        }
        const { payload: _payload, ...header } = value;
        const root: LocalManifest = {
          historyFormat: 2,
          generation,
          deleted: payload === null,
          envelope: isEnvelope ? header : null,
          refs,
        };
        const serialized = JSON.stringify(root);
        await local.setItem(key, serialized);
        decoded.set(key, { raw: serialized, parts });
      } catch (error) {
        await Promise.allSettled(created.map((ref) => local.removeItem(ref)));
        throw error;
      }
      const discarded = Object.values(old?.refs ?? {}).filter(
        (ref) => !Object.values(refs).includes(ref),
      );
      const pending = retired.get(key) ?? new Set<string>();
      discarded.forEach((ref) => pending.add(ref));
      retired.set(key, pending);
      void cleanup(key);
    },
    async removeItem(key) {
      // Guest removal has no sync revision. Publish absence before retiring parts.
      const raw = logicalKey(key) ? await local.getItem(key) : null,
        old = manifest(raw);
      await local.removeItem(key);
      decoded.delete(key);
      if (old) {
        const pending = retired.get(key) ?? new Set<string>();
        Object.values(old.refs).forEach((ref) => pending.add(ref));
        retired.set(key, pending);
        void cleanup(key);
      }
    },
  };
  adapters.set(local, adapter);
  originals.set(adapter, local);
  return adapter;
}
