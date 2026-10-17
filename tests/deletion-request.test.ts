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
