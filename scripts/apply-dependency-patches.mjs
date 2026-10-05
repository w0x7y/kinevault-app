import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const patches = [["http-cache-semantics", "4.3.0"], ["query-string", "7.1.3"]];

function gitApply(args) {
  const result = spawnSync("git", ["apply", ...args], { cwd: root, encoding: "utf8" });
  if (result.error) throw new Error(`Git is required to apply dependency security patches: ${result.error.message}`);
  return result;
}

// Check every patch before writing any files. Unexpected versions must fail the
// installation so an upstream update cannot silently remove the security fixes.
const pending = [];
for (const [name, version] of patches) {
  // ngrok is a dev dependency, so its cache library is absent with --omit=dev.
  if (name === "http-cache-semantics" && !existsSync(new URL(`../node_modules/${name}/`, import.meta.url))) continue;
  const installed = JSON.parse(readFileSync(new URL(`../node_modules/${name}/package.json`, import.meta.url), "utf8"));
  if (installed.version !== version) throw new Error(`Review the security patch for ${name}: expected ${version}, got ${installed.version}.`);
  const patch = `patches/${name}+${version}.patch`;
  const check = gitApply(["--check", patch]);
  if (check.status === 0) pending.push(patch);
  else if (gitApply(["--check", "--reverse", patch]).status !== 0) {
    throw new Error(`Cannot apply security patch ${patch}: ${check.stderr}`);
  }
}
for (const patch of pending) {
  const result = gitApply([patch]);
  if (result.status !== 0) throw new Error(`Cannot apply security patch ${patch}: ${result.stderr}`);
}
console.log("Dependency security patches verified and applied.");
