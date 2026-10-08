import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import ts from "typescript";
async function withMediaBrowser(run) {
  const modules = new Map();
  for (const name of ["media-model", "media-files.web"]) {
    const contents = await readFile(new URL(`../src/profile/${name}.ts`, import.meta.url), "utf8");
    modules.set(
      `/${name}.ts`,
      ts.transpileModule(contents, {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
      }).outputText,
    );
  }
  const server = createServer((request, response) => {
    const module = modules.get(request.url ?? "");
    response.setHeader("Content-Type", module ? "text/javascript" : "text/html");
    response.end(module ?? "<!doctype html><title>Media storage test</title>");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${address.port}`);
    await run(page);
  } finally {
    await browser?.close();
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}
test("web adapter persists bounded JPEG blobs across reload and releases resolved object URLs", async () => {
  await withMediaBrowser(async (page) => {
    const imported = await page.evaluate(async () => {
      const modulePath = "/media-files.web.ts";
      const { createMediaFiles } = await import(modulePath);
      const files = createMediaFiles();
      const canvas = document.createElement("canvas");
      canvas.width = 2400;
      canvas.height = 1800;
      canvas.getContext("2d").fillRect(0, 0, 2400, 1800);
      const blob = await new Promise((resolve) =>
        canvas.toBlob((value) => resolve(value), "image/png"),
      );
      const uri = URL.createObjectURL(blob);
      const events = [];
      const transaction = IDBDatabase.prototype.transaction;
      IDBDatabase.prototype.transaction = function (...args) {
        const tx = transaction.apply(this, args);
        if (args[1] === "readwrite") tx.addEventListener("complete", () => events.push("complete"));
        return tx;
      };
      const photo = await files.importPhoto(
        { uri, file: blob, width: 2400, height: 1800 },
        "web-image",
      );
      events.push("import-resolved");
      URL.revokeObjectURL(uri);
      return { photo, events };
    });
    assert.deepEqual(imported, {
      photo: { id: "web-image", width: 1600, height: 1200 },
      events: ["complete", "import-resolved"],
    });
    await page.reload();
    const result = await page.evaluate(async () => {
      const modulePath = "/media-files.web.ts";
      const { createMediaFiles } = await import(modulePath);
      const files = createMediaFiles();
      const photo = { id: "web-image", width: 1600, height: 1200 };
      async function inspect(thumbnail) {
        const uri = await files.resolvePhoto(photo, thumbnail);
        const blob = await (await fetch(uri)).blob();
        const bitmap = await createImageBitmap(blob);
        const result = { width: bitmap.width, height: bitmap.height, type: blob.type };
        bitmap.close();
        files.releaseUri(uri);
        const released = await fetch(uri).then(
          () => false,
          () => true,
        );
        return { ...result, released };
      }
      const original = await inspect(false);
      const thumbnail = await inspect(true);
      const canvas = document.createElement("canvas");
      canvas.width = 10;
      canvas.height = 10;
      const source = { uri: canvas.toDataURL("image/png"), width: 10, height: 10 };
      const duplicateRejected = await files.importPhoto(source, "web-image").then(
        () => false,
        () => true,
      );
      const retained = await files.resolvePhoto(photo);
      files.releaseUri(retained);
      await files.removePhoto(photo);
      const missingRejected = await files.resolvePhoto(photo).then(
        () => false,
        () => true,
      );
      return { original, thumbnail, duplicateRejected, missingRejected };
    });
    assert.deepEqual(result, {
      original: { width: 1600, height: 1200, type: "image/jpeg", released: true },
      thumbnail: { width: 320, height: 240, type: "image/jpeg", released: true },
      duplicateRejected: true,
      missingRejected: true,
    });
  });
});
test("web adapter rejects an aborted transaction even after its blob request succeeds", async () => {
  await withMediaBrowser(async (page) => {
    const result = await page.evaluate(async () => {
      const modulePath = "/media-files.web.ts";
      const { createMediaFiles } = await import(modulePath);
      const files = createMediaFiles();
      const canvas = document.createElement("canvas");
      canvas.width = 10;
      canvas.height = 10;
      const source = { uri: canvas.toDataURL("image/png"), width: 10, height: 10 };
      const add = IDBObjectStore.prototype.add;
      let requestSucceeded = false;
      IDBObjectStore.prototype.add = function (...args) {
        const request = add.apply(this, args);
        request.addEventListener("success", () => {
          requestSucceeded = true;
          this.transaction.abort();
        });
        return request;
      };
      const rejected = await files.importPhoto(source, "aborted-image").then(
        () => false,
        () => true,
      );
      IDBObjectStore.prototype.add = add;
      const missing = await files.resolvePhoto({ id: "aborted-image", width: 10, height: 10 }).then(
        () => false,
        () => true,
      );
      const retry = await files.importPhoto(source, "aborted-image");
      const uri = await files.resolvePhoto(retry);
      files.releaseUri(uri);
      return { requestSucceeded, rejected, missing, retry };
    });
    assert.deepEqual(result, {
      requestSucceeded: true,
      rejected: true,
      missing: true,
      retry: { id: "aborted-image", width: 10, height: 10 },
    });
  });
});
