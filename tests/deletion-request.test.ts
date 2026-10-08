import assert from "node:assert/strict";
import test from "node:test";
import { createDeleteAccountHandler } from "../supabase/functions/delete-account/handler.ts";

function handler() {
  const calls: string[] = [];
  return {
    calls,
    handle: createDeleteAccountHandler({
      async authenticate() {
        calls.push("authenticate");
        return { id: "owner", email: "fixture@example.invalid" };
      },
      async reauthenticate() {
        calls.push("reauthenticate");
        return { id: "owner", accessToken: "synthetic" };
      },
      async revokeSessions() {
        calls.push("revoke");
      },
      async deleteUser() {
        calls.push("delete");
      },
    }),
  };
}
function request(body: BodyInit) {
  return new Request("https://fixture.invalid", {
    method: "POST",
    headers: { Authorization: "Bearer synthetic" },
    body,
    duplex: "half",
  } as RequestInit);
}

test("deletion cancels an oversized stream before consuming the remaining body", async () => {
  let reads = 0,
    cancelled = false;
  const stream = new ReadableStream(
    {
      pull(controller) {
        reads++;
        controller.enqueue(new Uint8Array(1024));
        if (reads === 8) controller.close();
      },
      cancel() {
        cancelled = true;
      },
    },
    { highWaterMark: 0 },
  );
  const { handle, calls } = handler();
  assert.equal((await handle(request(stream))).status, 413);
  assert.equal(reads, 3);
  assert.equal(cancelled, true);
  assert.deepEqual(calls, []);
});

test("deletion bounds UTF-8 bytes and handles body read failures privately", async () => {
  const { handle, calls } = handler();
  assert.equal((await handle(request("é".repeat(1025)))).status, 413);
  const stream = new ReadableStream({
    start(controller) {
      controller.error(new Error("private credential"));
    },
  });
  const response = await handle(request(stream));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Invalid request" });
  assert.deepEqual(calls, []);
});

test("a valid bounded deletion request reaches the authenticated deletion sequence", async () => {
  const { handle, calls } = handler();
  const response = await handle(
    request(JSON.stringify({ password: "synthetic", confirmation: "DELETE" })),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(calls, ["authenticate", "reauthenticate", "revoke", "delete"]);
});
