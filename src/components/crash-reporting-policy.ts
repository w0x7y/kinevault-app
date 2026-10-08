import type { ErrorEvent, Event, StackFrame } from "@sentry/react-native";

const errorTypes = new Set([
  "Error",
  "TypeError",
  "RangeError",
  "ReferenceError",
  "SyntaxError",
  "URIError",
  "EvalError",
  "ChunkLoadError",
]);

function safeFrame(frame: StackFrame): StackFrame {
  const result: StackFrame = {};
  // Keep bundle locations for symbolication; never send arbitrary URLs, local
  // paths, function names, source snippets, or captured variables.
  const filename = frame.filename?.split(/[?#]/, 1)[0].split("/").at(-1);
  if (
    filename &&
    /^(?:index(?:\.(?:android|ios))?\.bundle|main\.jsbundle|(?:(?:entry|index)-)?[a-f0-9]{16,64}\.js)$/.test(
      filename,
    )
  ) {
    result.filename = `app:///${filename}`;
  }
  if (Number.isSafeInteger(frame.lineno) && frame.lineno! >= 0) result.lineno = frame.lineno;
  if (Number.isSafeInteger(frame.colno) && frame.colno! >= 0) result.colno = frame.colno;
  return result;
}

/** Rebuild from an allowlist: future SDK fields cannot quietly include PII. */
export function sanitizeCrashEvent(event: Event): ErrorEvent | null {
  if (!event.exception?.values?.length) return null;
  return {
    type: undefined,
    ...(event.event_id && /^[a-f0-9]{32}$/.test(event.event_id)
      ? { event_id: event.event_id }
      : {}),
    ...(typeof event.timestamp === "number" && Number.isFinite(event.timestamp)
      ? { timestamp: event.timestamp }
      : {}),
    platform: "javascript",
    level: "error",
    // An absent user lets Relay infer the client IP and derive location.
    // Keep one constant non-user address; never copy identity or geo fields.
    user: { ip_address: "0.0.0.0" },
    exception: {
      values: event.exception.values.slice(0, 5).map((exception) => ({
        type: errorTypes.has(exception.type ?? "") ? exception.type : "Error",
        value: "Application runtime error",
        ...(exception.stacktrace?.frames
          ? { stacktrace: { frames: exception.stacktrace.frames.slice(-100).map(safeFrame) } }
          : {}),
      })),
    },
  };
}

export function crashReportingOptions(dsn: string | undefined) {
  if (!dsn?.trim()) return null;
  return {
    dsn: dsn.trim(),
    sendDefaultPii: false,
    // Native crash files can bypass JS beforeSend. Enable only JS reporting
    // until a separately audited native scrubber is available.
    enableNative: false,
    enableNativeCrashHandling: false,
    enableNativeNagger: false,
    enableAutoSessionTracking: false,
    enableAutoPerformanceTracing: false,
    enableAppStartTracking: false,
    enableNativeFramesTracking: false,
    enableLogs: false,
    tracesSampleRate: 0,
    profilesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    maxBreadcrumbs: 0,
    beforeBreadcrumb: () => null,
    beforeSend: sanitizeCrashEvent,
    beforeSendTransaction: () => null,
    beforeSendLog: () => null,
  };
}
