import assert from "node:assert/strict";
import test from "node:test";
import {
  sanitizeCrashEvent,
  crashReportingOptions,
} from "../src/components/crash-reporting-policy.ts";

test("crash telemetry retains diagnostic locations but excludes health and authentication data", () => {
  const privateText = "Idan ate eggs; access_token=secret; weight=82";
  const event = sanitizeCrashEvent({
    event_id: "a".repeat(32),
    timestamp: 1700000000,
    user: { email: "idan@example.com", id: "account-id" },
    request: { url: "https://host/auth#access_token=secret", data: privateText },
    breadcrumbs: [{ message: privateText }],
    extra: { food: privateText },
    contexts: { health: { details: privateText } },
    tags: { name: privateText },
    exception: {
      values: [
        {
          type: "TypeError",
          value: privateText,
          stacktrace: {
            frames: [
              {
                filename: "https://host/index.bundle?access_token=secret",
                lineno: 42,
                colno: 7,
                function: privateText,
                vars: { password: "secret" },
                pre_context: [privateText],
              },
            ],
          },
        },
      ],
    },
  });
  assert.ok(event);
  assert.deepEqual(event.exception?.values?.[0], {
    type: "TypeError",
    value: "Application runtime error",
    stacktrace: { frames: [{ filename: "app:///index.bundle", lineno: 42, colno: 7 }] },
  });
  assert.equal(event.event_id, "a".repeat(32));
  const serialized = JSON.stringify(event);
  for (const forbidden of [
    privateText,
    "access_token",
    "secret",
    "idan@example.com",
    "account-id",
    "breadcrumbs",
    "contexts",
    "request",
    "tags",
    "extra",
  ]) {
    assert.ok(!serialized.includes(forbidden), forbidden);
  }
  assert.deepEqual(event.user, { ip_address: "0.0.0.0" });
});

test("reporting replaces client identity and location with a constant IP sentinel", () => {
  for (const user of [
    undefined,
    { ip_address: "{{auto}}", geo: { city: "Private city" } },
    { ip_address: "192.0.2.10", email: "private@example.com", id: "private-account" },
  ]) {
    const event = sanitizeCrashEvent({ user, exception: { values: [{ type: "Error" }] } });
    assert.deepEqual(event?.user, { ip_address: "0.0.0.0" });
    assert.ok(!JSON.stringify(event).includes("Private city"));
    assert.ok(!JSON.stringify(event).includes("private"));
    assert.ok(!JSON.stringify(event).includes("192.0.2.10"));
  }
});

test("telemetry drops unknown exception names, arbitrary file paths and non-error events", () => {
  const event = sanitizeCrashEvent({
    exception: {
      values: [
        {
          type: "Private health text",
          value: "secret",
          stacktrace: { frames: [{ filename: "/Users/idan/secret.png", lineno: 2 }] },
        },
      ],
    },
  });
  assert.ok(event);
  assert.equal(event.exception?.values?.[0].type, "Error");
  assert.equal(event.exception?.values?.[0].stacktrace?.frames?.[0].filename, undefined);
  assert.equal(sanitizeCrashEvent({ message: "secret" }), null);
});

test("reporting is opt-in and native data collection, logs, replay and sessions remain disabled", () => {
  assert.equal(crashReportingOptions(undefined), null);
  assert.equal(crashReportingOptions("  "), null);
  const options = crashReportingOptions("https://public@host/123");
  assert.equal(options?.dsn, "https://public@host/123");
  assert.equal(options?.sendDefaultPii, false);
  assert.equal(options?.enableNative, false);
  assert.equal(options?.enableLogs, false);
  assert.equal(options?.enableAutoSessionTracking, false);
  assert.equal(options?.tracesSampleRate, 0);
  assert.equal(options?.replaysSessionSampleRate, 0);
  assert.equal(options?.beforeBreadcrumb(), null);
});

test("Expo generated native and web bundle names keep diagnostic locations without private URL parts", () => {
  const names = [
    "index.android.bundle",
    "index.ios.bundle",
    "entry-0123456789abcdef0123456789abcdef.js",
    "index-0123456789abcdef0123456789abcdef.js",
  ];
  const event = sanitizeCrashEvent({
    exception: {
      values: [
        {
          type: "Error",
          stacktrace: {
            frames: names.map((filename) => ({
              filename: `https://private-host/user/token/${filename}?access_token=secret#health`,
              lineno: 42,
              function: "private user info",
              vars: { password: "secret" },
            })),
          },
        },
      ],
    },
  });
  assert.ok(event);
  assert.deepEqual(
    event.exception?.values?.[0].stacktrace?.frames,
    names.map((filename) => ({ filename: `app:///${filename}`, lineno: 42 })),
  );
  assert.ok(!JSON.stringify(event).includes("secret"));
});
