type EncryptedStore = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};
type Manifest = { version: 1; id: string; chunks: number };

function parseManifest(raw: string | null): Manifest | null {
  if (raw === null) return null;
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object") throw new Error("Invalid encrypted session manifest.");
  const record = value as Record<string, unknown>;
  if (record.version !== 1 || typeof record.id !== "string" || !/^[\w-]{1,80}$/.test(record.id)
    || typeof record.chunks !== "number" || !Number.isInteger(record.chunks) || record.chunks < 1 || record.chunks > 128)
    throw new Error("Invalid encrypted session manifest.");
  return { version: 1, id: record.id, chunks: record.chunks };
}

function chunksOf(value: string): string[] {
  const chunks: string[] = [];
  let chunk = "";
  let bytes = 0;
  // Iterate code points, preserving emoji/surrogate pairs across chunk boundaries.
  for (const character of value) {
    const point = character.codePointAt(0)!;
    const size = point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
    if (bytes + size > 1600) { chunks.push(chunk); chunk = ""; bytes = 0; }
    chunk += character; bytes += size;
  }
  chunks.push(chunk);
  if (chunks.length > 128) throw new Error("The account session is too large to store securely.");
  return chunks;
}

/** Each part and manifest lives in SecureStore; a final manifest write commits a complete value. */
export function createSecureSessionStorage(storage: EncryptedStore): EncryptedStore {
  const queues = new Map<string, Promise<unknown>>();
  let sequence = 0;
  function serial<T>(key: string, work: () => Promise<T>): Promise<T> {
    const result = (queues.get(key) ?? Promise.resolve()).catch(() => {}).then(work);
    queues.set(key, result);
    void result.finally(() => { if (queues.get(key) === result) queues.delete(key); }).catch(() => {});
    return result;
  }
  const manifestKey = (key: string) => `${key}.manifest.v1`;
  const partKey = (key: string, manifest: Manifest, index: number) => `${key}.part.${manifest.id}.${index}`;
  async function cleanupManifest(key: string): Promise<Manifest | null> {
    const raw = await storage.getItem(manifestKey(key));
    // Corrupt metadata remains unreadable until a replacement or logout commits.
    // Native read failures still propagate, protecting values on a locked device.
    try { return parseManifest(raw); } catch { return null; }
  }
  async function removeParts(key: string, manifest: Manifest) {
    for (let i = 0; i < manifest.chunks; i++) await storage.removeItem(partKey(key, manifest, i));
  }
  return {
    getItem(key) {
      return serial(key, async () => {
        const manifest = parseManifest(await storage.getItem(manifestKey(key)));
        if (!manifest) return storage.getItem(key);
        const chunks: string[] = [];
        for (let i = 0; i < manifest.chunks; i++) {
          const chunk = await storage.getItem(partKey(key, manifest, i));
          if (chunk === null) throw new Error("The encrypted account session is incomplete. Log in again.");
          chunks.push(chunk);
        }
        return chunks.join("");
      });
    },
    setItem(key, value) {
      return serial(key, async () => {
        const previous = await cleanupManifest(key);
        const chunks = chunksOf(value);
        const next: Manifest = { version: 1, id: `${Date.now().toString(36)}-${(++sequence).toString(36)}-${Math.random().toString(36).slice(2)}`, chunks: chunks.length };
        try {
          for (let i = 0; i < chunks.length; i++) await storage.setItem(partKey(key, next, i), chunks[i]);
          await storage.setItem(manifestKey(key), JSON.stringify(next));
        } catch (error) {
          await removeParts(key, next).catch(() => {});
          throw error;
        }
        // Failure to remove an old encrypted value must not undo a committed session.
        if (previous) await removeParts(key, previous).catch(() => {});
        await storage.removeItem(key).catch(() => {});
      });
    },
    removeItem(key) {
      return serial(key, async () => {
        const previous = await cleanupManifest(key);
        // Delete both references before optional cleanup. Removing the manifest
        // first could make a stale legacy token readable after a cleanup failure.
        await storage.removeItem(key);
        await storage.removeItem(manifestKey(key));
        if (previous) await removeParts(key, previous).catch(() => {});
      });
    },
  };
}
