import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import ts from "typescript";

let bundle;
/** Use production codecs inside synchronous Playwright storage fixtures. */
export function browserHistoryCodec() {
  bundle ??= build();
  return bundle;
}
async function build() {
  const modules = new Map();
  async function include(filename) {
    const id = path.resolve(filename);
    if (modules.has(id)) return id;
    const source = await readFile(id, "utf8");
    const compiled = id.endsWith(".json")
      ? `module.exports = ${source};`
      : id.endsWith(".ts")
        ? ts.transpileModule(source, {
            compilerOptions: {
              target: ts.ScriptTarget.ES2022,
              module: ts.ModuleKind.CommonJS,
              esModuleInterop: true,
            },
          }).outputText
        : source;
    modules.set(id, { code: compiled, imports: {} });
    for (const match of compiled.matchAll(/require\("([^\"]+)"\)/g)) {
      const specifier = match[1];
      const resolved = specifier.startsWith(".")
        ? path.resolve(path.dirname(id), specifier)
        : createRequire(id).resolve(specifier);
      modules.get(id).imports[specifier] = await include(resolved);
    }
    return id;
  }
  const entry = await include(
    fileURLToPath(new URL("../../src/account/history-partitions.ts", import.meta.url)),
  );
  const definitions = [...modules]
    .map(
      ([id, { code, imports }]) =>
        `${JSON.stringify(id)}: [function(require, exports, module) {\n${code}\n}, ${JSON.stringify(imports)}]`,
    )
    .join(",\n");
  return `(function() { const definitions = {${definitions}}, cache = {}; function load(id) { if (cache[id]) return cache[id].exports; const [run, imports] = definitions[id], module = {exports: {}}; cache[id] = module; run(name => load(imports[name]), module.exports, module); return module.exports; } window.historyFixtureCodec = load(${JSON.stringify(entry)}); })();`;
}
