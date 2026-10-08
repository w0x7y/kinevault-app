type Identity = { id: string; email: string | null };
export type DeletionPort = {
  authenticate(token: string): Promise<Identity | null>;
  reauthenticate(
    email: string,
    password: string,
  ): Promise<{ id: string; accessToken: string } | null>;
  revokeSessions(token: string): Promise<void>;
  deleteUser(id: string): Promise<void>;
};
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export function createDeleteAccountHandler(port: DeletionPort) {
  return async (request: Request): Promise<Response> => {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return reply(405, { error: "Method not allowed" });
    const token = /^Bearer (\S+)$/i.exec(request.headers.get("Authorization") ?? "")?.[1];
    if (!token) return reply(401, { error: "Authentication required" });
    // Bound input before parsing and never log request bodies or credentials.
    let text = "";
    const reader = request.body?.getReader();
    if (reader) {
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 2048) {
            void reader.cancel().catch(() => {});
            return reply(413, { error: "Request too large" });
          }
          chunks.push(value);
        }
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.byteLength;
        }
        text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      } catch {
        return reply(400, { error: "Invalid request" });
      } finally {
        reader.releaseLock();
      }
    }
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return reply(400, { error: "Invalid request" });
    }
    if (!body || typeof body !== "object" || Array.isArray(body))
      return reply(400, { error: "Invalid request" });
    const value = body as Record<string, unknown>;
    if (
      Object.keys(value).some((key) => !["password", "confirmation"].includes(key)) ||
      value.confirmation !== "DELETE" ||
      typeof value.password !== "string" ||
      !value.password ||
      value.password.length > 128
    )
      return reply(400, { error: "Password and DELETE confirmation required" });
    try {
      const owner = await port.authenticate(token);
      if (!owner?.email) return reply(401, { error: "Authentication required" });
      // Email comes from Auth, never from client input or editable metadata.
      const verified = await port.reauthenticate(owner.email, value.password);
      if (!verified || verified.id !== owner.id)
        return reply(403, { error: "Password verification failed" });
      await port.revokeSessions(verified.accessToken);
      await port.deleteUser(owner.id);
      return reply(200, { deleted: true });
    } catch {
      return reply(503, { error: "Account deletion could not be confirmed. Retry." });
    }
  };
}
