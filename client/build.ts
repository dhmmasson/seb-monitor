/**
 * Build script — bundles the client TypeScript into a single IIFE JS file.
 * Uses esbuild via npm:esbuild.
 *
 * Usage: deno run -A client/build.ts
 *        (works from any directory)
 */
import esbuild from "npm:esbuild";

// Resolve paths relative to this script's location (works from any CWD)
const SCRIPT_DIR = new URL(".", import.meta.url).pathname;
const ENTRY_POINT = `${SCRIPT_DIR}src/index.ts`;
const OUT_FILE = `${SCRIPT_DIR}dist/seb-monitor.js`;

console.log("Building client library...");
console.log(`  Entry: ${ENTRY_POINT}`);
console.log(`  Output: ${OUT_FILE}`);

await esbuild.build({
  entryPoints: [ENTRY_POINT],
  bundle: true,
  format: "iife",
  outfile: OUT_FILE,
  minify: true,
  target: "es2020",
  platform: "browser",
});

console.log(`✅ Build complete → ${OUT_FILE}`);

esbuild.stop();
