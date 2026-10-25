import { build } from "esbuild";
import { mkdir, readFile, writeFile, access, copyFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
// Both public package entry points live at <package>/{min,esm}/vs/index.js.
const monacoRoot = path.resolve(path.dirname(require.resolve("monaco-editor")), "../..");
const output = path.join(root, "public", "monaco-workers");
const entries = {
  editor: "editor/editor.worker.js",
  html: "languages/features/html/html.worker.js",
  css: "languages/features/css/css.worker.js",
  typescript: "languages/features/typescript/ts.worker.js",
};
const monacoPackage = JSON.parse(await readFile(path.join(monacoRoot, "package.json"), "utf8"));
const signature = `${monacoPackage.version}:${require("esbuild/package.json").version}:1`;
let prepared = false;
try {
  prepared = (await readFile(path.join(output, "version.txt"), "utf8")) === signature;
  if (prepared) await Promise.all(Object.keys(entries).map((name) => access(path.join(output, `${name}.worker.js`))));
} catch { prepared = false; }
if (!prepared) {
  await mkdir(output, { recursive: true });
  await build({
    entryPoints: Object.fromEntries(Object.entries(entries).map(([name, entry]) => [`${name}.worker`, path.join(monacoRoot, "esm", "vs", entry)])),
    outdir: output, bundle: true, platform: "browser", format: "iife", target: "es2020", minify: true, legalComments: "eof", logLevel: "warning",
  });
  await copyFile(path.join(monacoRoot, "LICENSE"), path.join(output, "LICENSE.txt"));
  await writeFile(path.join(output, "version.txt"), signature);
}
console.log(`Monaco ${monacoPackage.version}: local language workers ready.`);
