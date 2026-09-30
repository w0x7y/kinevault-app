import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const executable = process.platform === "win32" ? "adb.exe" : "adb";
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
const candidates = [
  ...(sdk ? [join(sdk, "platform-tools", executable)] : []),
  join(homedir(), "Android", "Sdk", "platform-tools", executable),
  join(homedir(), "Library", "Android", "sdk", "platform-tools", executable),
];
const adb = candidates.find(existsSync) || executable;

function run(...args) {
  const result = spawnSync(adb, args, { encoding: "utf8", timeout: 10000 });
  if (result.error || result.status !== 0)
    throw new Error(result.error?.message || result.stderr.trim() || "adb failed.");
  return result.stdout.trim();
}

try {
  const emulators = run("devices")
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/))
    .filter(([serial, status]) => serial.startsWith("emulator-") && status === "device")
    .map(([serial]) => serial);
  if (!emulators.length)
    throw new Error("Boot an Android emulator first, then run npm run android:keyboard.");
  for (const serial of emulators) {
    const shell = (...args) => run("-s", serial, "shell", ...args);
    shell("settings", "put", "secure", "show_ime_with_hard_keyboard", "1");
    // Virtual styluses can put Gboard in handwriting mode with no keypad.
    if (Number(shell("getprop", "ro.build.version.sdk")) >= 34)
      shell("settings", "put", "secure", "stylus_handwriting_enabled", "0");
    console.log(`${serial}: on-screen keyboard enabled; tap a field again to show it.`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
