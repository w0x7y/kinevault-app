import { pathToFileURL } from "node:url";

const projectRef = "kkywpvkckxniriatelta";

export function buildAuthConfig(current, environment) {
  const sender = environment.KINEVAULT_AUTH_EMAIL_FROM?.trim();
  const resendKey = environment.RESEND_API_KEY?.trim();
  const web = environment.KINEVAULT_TRACK_WEB_URL?.trim();
  if (!sender || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sender)) throw new Error("Set KINEVAULT_AUTH_EMAIL_FROM to your verified Resend sender.");
  if (!resendKey?.startsWith("re_")) throw new Error("Set RESEND_API_KEY to your Resend sending key.");
  const origin = web ? new URL(web) : null;
  if (origin && (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash)) throw new Error("Track's production URL must be an HTTPS origin.");
  if (typeof current.uri_allow_list !== "string") throw new Error("Unexpected Supabase redirect configuration; existing URLs were not changed.");
  const minimum = current.password_min_length ?? 10;
  if (!Number.isInteger(minimum) || minimum < 1) throw new Error("Unexpected Supabase password policy; settings were not changed.");
  const callbacks = ["kinevaulttrack://auth/callback", "http://localhost:8081/auth/callback"];
  if (origin) callbacks.push(`${origin.origin}/auth/callback`);
  const urls = new Set(current.uri_allow_list.split(",").map(value => value.trim()).filter(Boolean));
  for (const url of callbacks) { urls.add(url); urls.add(`${url}?flow=recovery`); }
  return {
    smtp_host: "smtp.resend.com", smtp_port: "465", smtp_user: "resend",
    smtp_pass: resendKey, smtp_admin_email: sender, smtp_sender_name: "KineVault",
    password_min_length: Math.max(10, minimum),
    uri_allow_list: [...urls].join(","),
  };
}

async function main() {
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  if (!accessToken) throw new Error("Set SUPABASE_ACCESS_TOKEN to an account Management API token. The MCP connection does not expose Auth settings.");
  const endpoint = `https://api.supabase.com/v1/projects/${projectRef}/config/auth`;
  const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
  const response = await fetch(endpoint, { headers, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Could not read Auth settings (HTTP ${response.status}).`);
  const patch = buildAuthConfig(await response.json(), process.env);
  // Print a reviewable diff without any credentials or unrelated Auth settings.
  const { smtp_pass, ...review } = patch;
  console.log(JSON.stringify({ projectRef, changes: review, smtpCredential: "supplied", preserveSiteUrl: true }, null, 2));
  if (!process.argv.includes("--apply")) { console.log("Preview only. Add --apply to configure SMTP and append these callback URLs."); return; }
  const result = await fetch(endpoint, { method: "PATCH", headers, body: JSON.stringify(patch), signal: AbortSignal.timeout(20000) });
  if (!result.ok) throw new Error(`Could not update Auth settings (HTTP ${result.status}).`);
  console.log("Resend SMTP configured and Track callbacks appended. Verify real confirmation and reset emails before release.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
