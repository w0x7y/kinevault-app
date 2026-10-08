import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import ts from "typescript";

test("browser exports a real downloaded JSON file containing decodable owned JPEG bytes", async (t) => {
  const modules = new Map();
  for (const [path, source] of [
    ["/media-model.ts", "../src/profile/media-model.ts"],
    ["/media-files.web.ts", "../src/profile/media-files.web.ts"],
    ["/export-file.ts", "../src/account/export-file.web.ts"],
  ]) {
    const contents = (await readFile(new URL(source, import.meta.url), "utf8")).replace(
      '"../profile/media-files"',
      '"/media-files.web.ts"',
    );
    modules.set(
      path,
      ts.transpileModule(contents, {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
      }).outputText,
    );
  }
  const server = createServer((request, response) => {
    const module = modules.get(request.url ?? "");
    response.setHeader("Content-Type", module ? "text/javascript" : "text/html");
    response.end(module ?? "<!doctype html><title>Account export test</title>");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${address.port}`);
  const download = page.waitForEvent("download");
  const result = await page.evaluate(async () => {
    const mediaPath = "/media-files.web.ts";
    const exportPath = "/export-file.ts";
    const { mediaFiles } = await import(mediaPath);
    const { readExportPhoto, saveAccountExport } = await import(exportPath);
    const canvas = document.createElement("canvas");
    canvas.width = 40;
    canvas.height = 30;
    const context = canvas.getContext("2d");
    context.fillStyle = "#ff4400";
    context.fillRect(0, 0, 40, 30);
    const source = { uri: canvas.toDataURL("image/png"), width: 40, height: 30 };
    const photo = await mediaFiles.importPhoto(source, "export-owned-photo");
    const contents = await readExportPhoto(photo);
    const file = {
      photos: [{ ...photo, contents, mimeType: "image/jpeg" }],
      documents: [{ pending: true, data: { dailyMl: 2000 } }],
    };
    const decoded = Uint8Array.from(atob(contents), (byte) => byte.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([decoded], { type: "image/jpeg" }));
    const dimensions = [bitmap.width, bitmap.height];
    bitmap.close();
    await saveAccountExport(JSON.stringify(file), () => true);
    const switchedOwnerRejected = await saveAccountExport(JSON.stringify(file), () => false).then(
      () => false,
      () => true,
    );
    await mediaFiles.removePhoto(photo);
    const missingPhotoRejected = await readExportPhoto(photo).then(
      () => false,
      () => true,
    );
    return { file, dimensions, switchedOwnerRejected, missingPhotoRejected };
  });
  const file = await download;
  assert.match(file.suggestedFilename(), /^kinevault-export-\d{4}-\d{2}-\d{2}\.json$/);
  assert.deepEqual(JSON.parse(await readFile(await file.path(), "utf8")), result.file);
  assert.deepEqual(result.dimensions, [40, 30]);
  assert.equal(result.switchedOwnerRejected, true);
  assert.equal(result.missingPhotoRejected, true);
});
