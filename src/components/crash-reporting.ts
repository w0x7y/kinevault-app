import type { ErrorInfo } from "react";
import * as Sentry from "@sentry/react-native";
import { crashReportingOptions } from "./crash-reporting-policy";

let initialized = false;

export function initializeCrashReporting() {
  if (initialized) return;
  const options = crashReportingOptions(process.env.EXPO_PUBLIC_SENTRY_DSN);
  if (!options) return;
  try {
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
    initialized = true;
  } catch {
    /* Telemetry configuration must never prevent startup/recovery. */
  }
}

export function reportCrash(error: unknown, _info?: ErrorInfo) {
  if (!initialized) return;
  // beforeSend removes raw error messages and all user/auth/health context.
  try {
    Sentry.captureException(error);
  } catch {
    /* Recovery is independent of telemetry. */
  }
}
