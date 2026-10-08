import { spawnSync } from "node:child_process";
import { readdir, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const directory = fileURLToPath(new URL("../assets/mascot/2d/", import.meta.url));
const sources = (await readdir(join(directory, "source")))
  .filter((file) => file.endsWith(".png"))
  .sort();
if (sources.length !== 12) throw new Error("Expected all 12 source poses before optimizing Kine.");

const assets = [];
for (const file of sources) {
  // 3× onboarding sizes: 280pt welcome, 152pt questions. Tab poses scale wider.
  const pixels = file === "kine-welcome.png" ? 840 : 456;
  const output = file.replace(/\.png$/, ".webp");
  const result = spawnSync(
    "magick",
    [
      join(directory, "source", file),
      "-resize",
      `${pixels}x${pixels}`,
      "-strip",
      "-define",
      "webp:method=6",
      "-define",
      "webp:alpha-quality=100",
      "-quality",
      "80",
      join(directory, output),
    ],
    { encoding: "utf8" },
  );
  if (result.error || result.status !== 0)
    throw new Error(result.error?.message || result.stderr.trim());
  const { size: bytes } = await stat(join(directory, output));
  assets.push({ file: output, pixels, bytes });
  console.log(`${output}: ${pixels}px, ${bytes.toLocaleString("en-US")} bytes`);
}
const totalBytes = assets.reduce((total, asset) => total + asset.bytes, 0);
await writeFile(
  join(directory, "manifest.json"),
  JSON.stringify(
    {
      generator: "Built-in image_gen",
      format: "Transparent WebP",
      quality: 80,
      alphaQuality: 100,
      totalBytes,
      assets,
    },
    null,
    2,
  ) + "\n",
);
console.log(`Total: ${totalBytes.toLocaleString("en-US")} bytes.`);
