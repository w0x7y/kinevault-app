import type { ErrorInfo } from "react";
import { Platform } from "react-native";
import { crashReportingOptions } from "./crash-reporting-policy";

let reporter: typeof import("@sentry/react-native") | undefined;

export function initializeCrashReporting() {
  if (reporter || (Platform.OS === "web" && typeof window === "undefined")) return;
  const options = crashReportingOptions(process.env.EXPO_PUBLIC_SENTRY_DSN);
  if (!options) return;
  try {
    // Importing the SDK starts cleanup timers. Keep it outside server rendering
    // and disabled reporting so those timers cannot retain rendered app bundles.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require("@sentry/react-native") as typeof import("@sentry/react-native");
    Sentry.init({
      ...options,
      // Retain runtime error handlers and frame normalization only. Other
      // integrations can collect requests, device details, replay or contexts.
      integrations: (defaults) =>
        defaults.filter((integration) =>
          [
            "ReactNativeErrorHandlers",
            "GlobalHandlers",
            "BrowserApiErrors",
            "Dedupe",
            "RewriteFrames",
          ].includes(integration.name),
        ),
    });
    reporter = Sentry;
  } catch {
    /* Telemetry configuration must never prevent startup/recovery. */
  }
}

export function reportCrash(error: unknown, _info?: ErrorInfo) {
  if (!reporter) return;
  // beforeSend removes raw error messages and all user/auth/health context.
  try {
    reporter.captureException(error);
  } catch {
    /* Recovery is independent of telemetry. */
  }
}
