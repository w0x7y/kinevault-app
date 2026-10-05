import assert from "node:assert/strict";
import test from "node:test";
import { buildAuthConfig } from "./configure-auth.mjs";

const config = { uri_allow_list: "https://friends-program.example/auth/confirm", site_url: "https://friends-program.example" };
const environment = { KINEVAULT_AUTH_EMAIL_FROM: "auth@example.com", RESEND_API_KEY: "re_test-only", KINEVAULT_TRACK_WEB_URL: "https://track.example.com" };
test("SMTP setup preserves shared website settings and appends exact callback URLs", () => {
  const patch = buildAuthConfig(config, environment);
  assert.equal(patch.site_url, undefined);
  assert.ok(patch.uri_allow_list.includes(config.uri_allow_list));
  assert.ok(patch.uri_allow_list.includes("kinevaulttrack://auth/callback?flow=recovery"));
  assert.ok(patch.uri_allow_list.includes("https://track.example.com/auth/callback"));
  assert.equal(patch.smtp_host, "smtp.resend.com");
  assert.equal(patch.smtp_sender_name, "KineVault");
  assert.equal(patch.password_min_length, 10);
  assert.equal(buildAuthConfig({ ...config, password_min_length: 16 }, environment).password_min_length, 16);
  assert.deepEqual(buildAuthConfig({ ...config, uri_allow_list: patch.uri_allow_list }, environment), patch);
});
test("SMTP setup requires credentials, verified sender and actual HTTPS deployment origin", () => {
  for (const key of ["KINEVAULT_AUTH_EMAIL_FROM", "RESEND_API_KEY"]) assert.throws(() => buildAuthConfig(config, { ...environment, [key]: "" }));
  assert.ok(buildAuthConfig(config, { ...environment, KINEVAULT_TRACK_WEB_URL: "" }).uri_allow_list.includes("kinevaulttrack://auth/callback"));
  assert.throws(() => buildAuthConfig(config, { ...environment, KINEVAULT_TRACK_WEB_URL: "https://track.example.com/path" }));
  assert.throws(() => buildAuthConfig({ ...config, uri_allow_list: null }, environment));
});
