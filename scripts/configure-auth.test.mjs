import assert from "node:assert/strict";
import test from "node:test";
import * as authConfig from "./configure-auth.mjs";

const { buildAuthConfig } = authConfig;

const config = {
  uri_allow_list: "https://friends-program.example/auth/confirm",
  site_url: "https://friends-program.example",
};
const environment = {
  KINEVAULT_AUTH_EMAIL_FROM: "auth@example.com",
  RESEND_API_KEY: "re_test-only",
  KINEVAULT_TRACK_WEB_URL: "https://track.example.com",
};
test("SMTP setup preserves shared website settings and appends exact callback URLs", () => {
  const patch = buildAuthConfig(config, environment);
  assert.equal(patch.site_url, undefined);
  assert.ok(patch.uri_allow_list.includes(config.uri_allow_list));
  assert.ok(patch.uri_allow_list.includes("kinevaulttrack://auth/callback?flow=recovery"));
  assert.ok(patch.uri_allow_list.includes("https://track.example.com/auth/callback"));
  assert.equal(patch.smtp_host, "smtp.resend.com");
  assert.equal(patch.smtp_sender_name, "KineVault");
  assert.equal(patch.password_min_length, 10);
  assert.equal(
    buildAuthConfig({ ...config, password_min_length: 16 }, environment).password_min_length,
    16,
  );
  assert.deepEqual(
    buildAuthConfig({ ...config, uri_allow_list: patch.uri_allow_list }, environment),
    patch,
  );
});
test("SMTP setup requires credentials, verified sender and actual HTTPS deployment origin", () => {
  for (const key of ["KINEVAULT_AUTH_EMAIL_FROM", "RESEND_API_KEY"])
    assert.throws(() => buildAuthConfig(config, { ...environment, [key]: "" }));
  assert.ok(
    buildAuthConfig(config, {
      ...environment,
      KINEVAULT_TRACK_WEB_URL: "",
    }).uri_allow_list.includes("kinevaulttrack://auth/callback"),
  );
  assert.throws(() =>
    buildAuthConfig(config, {
      ...environment,
      KINEVAULT_TRACK_WEB_URL: "https://track.example.com/path",
    }),
  );
  assert.throws(() => buildAuthConfig({ ...config, uri_allow_list: null }, environment));
});

test("password protection applies only the HIBP setting and verifies it by reading it back", async () => {
  const calls = [];
  const output = [];
  await authConfig.configureAuth({
    args: ["--security-only", "--apply"],
    environment: { SUPABASE_ACCESS_TOKEN: "synthetic-management-token" },
    log: (value) => output.push(value),
    fetchImpl: async (url, options) => {
      calls.push({ url, ...options });
      return Response.json({ password_hibp_enabled: calls.length === 3 });
    },
  });
  assert.equal(calls.length, 3);
  assert.ok(
    calls.every(
      (call) =>
        call.url === "https://api.supabase.com/v1/projects/kkywpvkckxniriatelta/config/auth",
    ),
  );
  assert.deepEqual(JSON.parse(calls[1].body), { password_hibp_enabled: true });
  assert.equal(calls[1].method, "PATCH");
  assert.equal(calls[2].method, undefined);
  assert.ok(output.some((value) => value.includes("verified")));
  assert.ok(output.every((value) => !value.includes("synthetic-management-token")));
});

test("password protection preview reads settings without writing them or requiring SMTP credentials", async () => {
  let calls = 0;
  await authConfig.configureAuth({
    args: ["--security-only"],
    environment: { SUPABASE_ACCESS_TOKEN: "synthetic" },
    log: () => {},
    fetchImpl: async (_url, options) => {
      assert.equal(options.method, undefined);
      calls++;
      return Response.json({ password_hibp_enabled: false });
    },
  });
  assert.equal(calls, 1);
});

test("password protection fails when the update is rejected or read-back remains disabled", async () => {
  for (const rejected of [true, false]) {
    let calls = 0;
    await assert.rejects(
      authConfig.configureAuth({
        args: ["--security-only", "--apply"],
        environment: { SUPABASE_ACCESS_TOKEN: "synthetic" },
        log: () => {},
        fetchImpl: async () => {
          calls++;
          return rejected && calls === 2
            ? new Response("", { status: 403 })
            : Response.json({ password_hibp_enabled: false });
        },
      }),
      rejected ? /HTTP 403/ : /not enabled/,
    );
  }
});

test("Auth configuration rejects project API keys before making a Management API request", async () => {
  for (const token of ["sb_secret_synthetic", "sb_publishable_synthetic"]) {
    await assert.rejects(
      authConfig.configureAuth({
        args: ["--security-only", "--apply"],
        environment: { SUPABASE_ACCESS_TOKEN: token },
        fetchImpl: async () => {
          assert.fail("A project API key must not be sent to the Management API.");
        },
        log: () => {},
      }),
      /personal access token/,
    );
  }
});

test("password protection explains the paid-plan blocker when Supabase rejects it", async () => {
  await assert.rejects(
    authConfig.configureAuth({
      args: ["--security-only", "--apply"],
      environment: { SUPABASE_ACCESS_TOKEN: "synthetic" },
      log: () => {},
      fetchImpl: async (_url, options) =>
        options.method === "PATCH"
          ? new Response("", { status: 402 })
          : Response.json({ password_hibp_enabled: false }),
    }),
    /Pro.*HTTP 402/,
  );
});
