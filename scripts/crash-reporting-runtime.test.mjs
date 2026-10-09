import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { crashReportingOptions } from "../src/components/crash-reporting-policy.ts";

const source = await readFile(
  new URL("../src/components/crash-reporting.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function runtime({
  platform = "web",
  browser = false,
  dsn = "https://public@example.test/1",
  failInit = false,
} = {}) {
  let loads = 0;
  const initializations = [];
  const crashes = [];
  const context = {
    exports: {},
    ...(browser ? { window: {} } : {}),
    process: { env: { EXPO_PUBLIC_SENTRY_DSN: dsn } },
    require(specifier) {
      switch (specifier) {
        case "react-native":
          return { Platform: { OS: platform } };
        case "./crash-reporting-policy":
          return { crashReportingOptions };
        case "@sentry/react-native":
          loads++;
          return {
            init(options) {
              if (failInit) throw new Error("SDK unavailable");
              initializations.push(options);
            },
            captureException: (error) => crashes.push(error),
          };
        default:
          throw new Error(`Unexpected dependency: ${specifier}`);
      }
    },
  };
  runInNewContext(compiled, context, { filename: "crash-reporting.js" });
  return { api: context.exports, loads: () => loads, initializations, crashes };
}

test("server rendering never loads or initializes the telemetry SDK", () => {
  const { api, loads, initializations, crashes } = runtime();
  api.initializeCrashReporting();
  api.reportCrash(new Error("server error"));
  assert.equal(loads(), 0, "SDK imports can start timers before init is called");
  assert.equal(initializations.length, 0);
  assert.equal(crashes.length, 0);
});

test("disabled browser reporting leaves the telemetry SDK unloaded", () => {
  const { api, loads, crashes } = runtime({ browser: true, dsn: " " });
  api.initializeCrashReporting();
  api.reportCrash(new Error("local error"));
  assert.equal(loads(), 0);
  assert.equal(crashes.length, 0);
});

for (const platform of ["web", "ios", "android"]) {
  test(`${platform} reporting initializes once and retains its privacy policy`, () => {
    const { api, loads, initializations, crashes } = runtime({
      platform,
      browser: platform === "web",
    });
    api.initializeCrashReporting();
    api.initializeCrashReporting();
    const error = new Error("app error");
    api.reportCrash(error);
    assert.equal(loads(), 1);
    assert.equal(initializations.length, 1);
    assert.equal(crashes[0], error);
    const options = initializations[0];
    assert.equal(options.sendDefaultPii, false);
    assert.equal(options.enableNative, false);
    assert.equal(options.tracesSampleRate, 0);
    assert.equal(options.maxBreadcrumbs, 0);
    const integrations = options.integrations([{ name: "GlobalHandlers" }, { name: "HttpClient" }]);
    assert.equal(integrations.length, 1);
    assert.equal(integrations[0].name, "GlobalHandlers");
    const sanitized = options.beforeSend({
      message: "private",
      user: { email: "private@example.test" },
      exception: { values: [{ type: "Error", value: "private" }] },
    });
    assert.equal(sanitized.user.email, undefined);
    assert.equal(sanitized.exception.values[0].value, "Application runtime error");
  });
}

test("telemetry startup failure leaves crash recovery usable", () => {
  const { api, crashes } = runtime({ browser: true, failInit: true });
  assert.doesNotThrow(() => api.initializeCrashReporting());
  assert.doesNotThrow(() => api.reportCrash(new Error("recoverable")));
  assert.equal(crashes.length, 0);
});
