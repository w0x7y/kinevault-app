import { pathToFileURL } from "node:url";

const projectRef = "kkywpvkckxniriatelta";

export function buildAuthConfig(current, environment) {
  const sender = environment.KINEVAULT_AUTH_EMAIL_FROM?.trim();
  const resendKey = environment.RESEND_API_KEY?.trim();
  const web = environment.KINEVAULT_TRACK_WEB_URL?.trim();
  if (!sender || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sender))
    throw new Error("Set KINEVAULT_AUTH_EMAIL_FROM to your verified Resend sender.");
  if (!resendKey?.startsWith("re_"))
    throw new Error("Set RESEND_API_KEY to your Resend sending key.");
  const origin = web ? new URL(web) : null;
  if (
    origin &&
    (origin.protocol !== "https:" ||
      origin.username ||
      origin.password ||
      origin.pathname !== "/" ||
      origin.search ||
      origin.hash)
  )
    throw new Error("Track's production URL must be an HTTPS origin.");
  if (typeof current.uri_allow_list !== "string")
    throw new Error("Unexpected Supabase redirect configuration; existing URLs were not changed.");
  const minimum = current.password_min_length ?? 10;
  if (!Number.isInteger(minimum) || minimum < 1)
    throw new Error("Unexpected Supabase password policy; settings were not changed.");
  const callbacks = ["kinevaulttrack://auth/callback", "http://localhost:8081/auth/callback"];
  if (origin) callbacks.push(`${origin.origin}/auth/callback`);
  const urls = new Set(
    current.uri_allow_list
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  for (const url of callbacks) {
    urls.add(url);
    urls.add(`${url}?flow=recovery`);
  }
  return {
    smtp_host: "smtp.resend.com",
    smtp_port: "465",
    smtp_user: "resend",
    smtp_pass: resendKey,
    smtp_admin_email: sender,
    smtp_sender_name: "KineVault",
    password_min_length: Math.max(10, minimum),
    uri_allow_list: [...urls].join(","),
  };
}

export async function configureAuth({
  environment = process.env,
  args = process.argv.slice(2),
  fetchImpl = fetch,
  log = console.log,
} = {}) {
  const accessToken = environment.SUPABASE_ACCESS_TOKEN?.trim();
  if (!accessToken)
    throw new Error(
      "Set SUPABASE_ACCESS_TOKEN to an account Management API token. The MCP connection does not expose Auth settings.",
    );
  if (/^sb_(secret|publishable)_/.test(accessToken))
    throw new Error(
      "Use a Supabase personal access token for SUPABASE_ACCESS_TOKEN. Project API keys cannot configure Auth settings.",
    );
  const endpoint = `https://api.supabase.com/v1/projects/${projectRef}/config/auth`;
  const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
  const response = await fetchImpl(endpoint, { headers, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Could not read Auth settings (HTTP ${response.status}).`);
  const current = await response.json();
  const securityOnly = args.includes("--security-only");
  const patch = securityOnly
    ? { password_hibp_enabled: true }
    : buildAuthConfig(current, environment);
  // Print a reviewable diff without any credentials or unrelated Auth settings.
  const { smtp_pass, ...review } = patch;
  log(
    JSON.stringify(
      {
        projectRef,
        changes: review,
        ...(securityOnly
          ? { currentlyEnabled: current.password_hibp_enabled === true }
          : { smtpCredential: "supplied" }),
        preserveSiteUrl: true,
      },
      null,
      2,
    ),
  );
  if (!args.includes("--apply")) {
    log("Preview only. Add --apply to apply these settings.");
    return;
  }
  const result = await fetchImpl(endpoint, {
    method: "PATCH",
    headers,
    body: JSON.stringify(patch),
    signal: AbortSignal.timeout(20000),
  });
  if (securityOnly && result.status === 402)
    throw new Error(
      "Leaked-password protection requires Supabase Pro or above (HTTP 402). Upgrade the project's organization plan before retrying.",
    );
  if (!result.ok) throw new Error(`Could not update Auth settings (HTTP ${result.status}).`);
  if (securityOnly) {
    const verification = await fetchImpl(endpoint, { headers, signal: AbortSignal.timeout(20000) });
    if (!verification.ok)
      throw new Error(`Could not verify Auth settings (HTTP ${verification.status}).`);
    if ((await verification.json()).password_hibp_enabled !== true)
      throw new Error(
        "Leaked-password protection is not enabled after the update. Check the project's plan and Auth settings.",
      );
    log("Leaked-password protection enabled and verified.");
  } else {
    log(
      "Resend SMTP configured and Track callbacks appended. Verify real confirmation and reset emails before release.",
    );
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  configureAuth().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
