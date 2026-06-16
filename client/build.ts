/**
 * Build script — bundles the client TypeScript into a single IIFE JS file.
 * Uses esbuild via npm:esbuild.
 *
 * Usage: deno run -A client/build.ts
 *        (works from any directory)
 */
import esbuild from "npm:esbuild";
import { resolve, fromFileUrl } from "https://deno.land/std/path/mod.ts";

// Resolve paths relative to this script's location
const SCRIPT_DIR = fromFileUrl(new URL(".", import.meta.url));
const ENTRY_POINT = resolve(SCRIPT_DIR, "src/index.ts");
const OUT_FILE = resolve(SCRIPT_DIR, "dist/seb-monitor.js");

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
