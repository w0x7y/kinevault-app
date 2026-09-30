import { spawn, spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { toQR } from "toqr";
import { createServer } from "node:net";

const port = process.argv[2] || "8082";
if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535)
  throw new Error("Use a port between 1 and 65535.");
const binary = process.env.CLOUDFLARED_BIN || "cloudflared";
if (spawnSync(binary, ["--version"], { stdio: "ignore" }).status !== 0) {
  console.error(
    "Install cloudflared first: https://developers.cloudflare.com/tunnel/downloads/",
  );
  process.exit(1);
}

const children = [];
let closing = false;
function stop(code) {
  if (closing) return;
  closing = true;
  process.exitCode = code;
  for (const child of children) child.kill("SIGTERM");
  setTimeout(() => {
    for (const child of children) child.kill("SIGKILL");
  }, 2000).unref();
}
process.once("SIGINT", () => stop(130));
process.once("SIGTERM", () => stop(143));

try {
  await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", () =>
      reject(
        new Error(
          `Port ${port} is unavailable. Use npm run start:cloudflare -- ${Number(port) + 1}.`,
        ),
      ),
    );
    probe.listen(Number(port), "0.0.0.0", () => probe.close(resolve));
  });
  const tunnel = spawn(
    binary,
    [
      "tunnel",
      "--url",
      `http://127.0.0.1:${port}`,
      "--protocol",
      "http2",
      "--no-autoupdate",
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  children.push(tunnel);
  const origin = await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () =>
        reject(
          new Error("Cloudflare did not create a tunnel within 30 seconds."),
        ),
      30000,
    );
    let buffer = "";
    function output(chunk) {
      buffer = (buffer + chunk.toString()).slice(-8192);
      const url = buffer.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (url) {
        clearTimeout(timeout);
        resolve(url[0]);
      }
      if (!closing && chunk.toString().includes("ERR"))
        process.stderr.write(chunk);
    }
    tunnel.stdout.on("data", output);
    tunnel.stderr.on("data", output);
    tunnel.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    tunnel.once("exit", () => {
      clearTimeout(timeout);
      reject(new Error("Cloudflare tunnel stopped."));
      if (!closing) {
        console.error("Cloudflare tunnel stopped. Restart the command.");
        stop(1);
      }
    });
  });
  console.log(`Tunnel: ${origin}`);
  const expo = spawn(
    process.execPath,
    ["node_modules/expo/bin/cli", "start", "--go", "--lan", "--port", port],
    {
      env: { ...process.env, EXPO_PACKAGER_PROXY_URL: origin },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  children.push(expo);
  expo.stdout.pipe(process.stdout);
  expo.stderr.pipe(process.stderr);
  expo.once("error", (error) => {
    console.error(error.message);
    stop(1);
  });
  expo.once("exit", (code) => stop(code ?? 1));

  let ready = false;
  let lastError = "Server is starting.";
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline && !closing) {
    try {
      const response = await fetch(`${origin}/`, {
        headers: { Accept: "application/expo+json", "Expo-Platform": "ios" },
        signal: AbortSignal.timeout(10000),
      });
      const manifest = await response.json();
      if (response.ok && new URL(manifest.launchAsset.url).origin === origin) {
        ready = true;
        break;
      }
      lastError = `HTTP ${response.status}: unexpected manifest or bundle host.`;
    } catch (error) {
      lastError =
        error instanceof Error
          ? `${error.message}${error.cause?.code ? ` (${error.cause.code})` : ""}`
          : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  if (!ready)
    throw new Error(
      `The public iOS manifest is not ready: ${lastError}. Check the Expo output above.`,
    );
  // HTTPS requires exps://. Expo CLI's proxy QR uses exp://:443 instead.
  const link = origin.replace("https://", "exps://");
  const qr = toQR(link);
  const size = Math.sqrt(qr.length);
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="420" viewBox="0 0 ${size + 8} ${size + 8}"><rect width="100%" height="100%" fill="white"/>`;
  console.log(`\nScan with the iPhone Camera, then open Expo Go:\n${link}\n`);
  for (let y = -4; y < size + 4; y++) {
    let line = "\x1b[47m\x1b[30m";
    for (let x = -4; x < size + 4; x++) {
      const black =
        x >= 0 && y >= 0 && x < size && y < size && qr[y * size + x];
      line += black ? "██" : "  ";
      if (black)
        svg += `<rect x="${x + 4}" y="${y + 4}" width="1" height="1" fill="black"/>`;
    }
    console.log(line + "\x1b[0m");
  }
  await mkdir(".expo", { recursive: true });
  await writeFile(".expo/connection-qr.svg", svg + "</svg>");
  console.log(
    "QR saved to .expo/connection-qr.svg. Keep this terminal running. Ctrl+C stops both servers.",
  );
} catch (error) {
  if (!closing)
    console.error(error instanceof Error ? error.message : String(error));
  stop(1);
}
