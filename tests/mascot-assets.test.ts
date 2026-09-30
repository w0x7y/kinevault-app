import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

test("all 11 Kine poses stay transparent, sharp at 3×, and within the loading budget", async () => {
  const directory = new URL("../assets/mascot/2d/", import.meta.url);
  const files = (await readdir(directory)).filter((file) => file.endsWith(".webp"));
  assert.equal(files.length, 11);
  let total = 0;
  for (const file of files) {
    const image = await readFile(new URL(file, directory));
    assert.equal(image.toString("ascii", 0, 4), "RIFF", `${file} is not WebP`);
    assert.equal(image.toString("ascii", 8, 12), "WEBP");
    assert.equal(image.toString("ascii", 12, 16), "VP8X");
    assert.ok(image[20] & 0x10, `${file} lost its transparent background`);
    const expected = file === "kine-welcome.webp" ? 840 : 456;
    assert.equal(image.readUIntLE(24, 3) + 1, expected, `${file} width`);
    assert.equal(image.readUIntLE(27, 3) + 1, expected, `${file} height`);
    assert.ok(image.length <= 50000, `${file} exceeds its 50 KB budget`);
    total += image.length;
  }
  assert.ok(total <= 200000, `Kine's assets exceed the 200 KB total budget: ${total}`);
});
