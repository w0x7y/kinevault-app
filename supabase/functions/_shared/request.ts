export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function jsonReply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export function preflightReply() {
  return new Response(null, { status: 204, headers: cors });
}

/** Reads at most `limit` bytes. Longer streams are cancelled and give null. */
export async function readLimited(
  stream: ReadableStream<Uint8Array> | null,
  limit: number,
): Promise<Uint8Array<ArrayBuffer> | null> {
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = stream?.getReader();
  if (reader) {
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > limit) {
          void reader.cancel().catch(() => {});
          return null;
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export type RejectedRequest = "method" | "unauthenticated" | "too-large" | "invalid";
export type JsonRequest =
  | { kind: "preflight" }
  | { kind: "rejected"; reason: RejectedRequest }
  | { kind: "ok"; token: string; body: Record<string, unknown> };

/**
 * The shared opening of a signed-in JSON POST: method, Bearer token, then a
 * size-limited UTF-8 body holding one JSON object. The token is only parsed
 * here; each function still authenticates it after checking its own fields.
 */
export async function readJsonRequest(
  request: Request,
  { byteLimit }: { byteLimit: number },
): Promise<JsonRequest> {
  if (request.method === "OPTIONS") return { kind: "preflight" };
  if (request.method !== "POST") return { kind: "rejected", reason: "method" };
  const token = /^Bearer (\S+)$/i.exec(request.headers.get("Authorization") ?? "")?.[1];
  if (!token) return { kind: "rejected", reason: "unauthenticated" };
  // Bound input before parsing and never log request bodies or credentials.
  let body: unknown;
  try {
    const bytes = await readLimited(request.body, byteLimit);
    if (!bytes) return { kind: "rejected", reason: "too-large" };
    body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return { kind: "rejected", reason: "invalid" };
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    return { kind: "rejected", reason: "invalid" };
  return { kind: "ok", token, body: body as Record<string, unknown> };
}
