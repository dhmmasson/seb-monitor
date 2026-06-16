/**
 * Build script — bundles the client TypeScript into a single IIFE JS file.
 * Uses esbuild via npm:esbuild.
 *
 * Usage: deno run -A client/build.ts
 */
import esbuild from "npm:esbuild";
import { createBuildConfig } from "./src/build.ts";

const config = createBuildConfig();

console.log("Building client library...");
console.log(`  Entry: ${config.entryPoints[0]}`);
console.log(`  Output: ${config.outfile}`);
console.log(`  Format: ${config.format}`);

await esbuild.build({
  entryPoints: config.entryPoints,
  bundle: config.bundle,
  format: config.format as "iife",
  outfile: config.outfile,
  minify: config.minify,
  target: config.target,
  platform: config.platform as "browser",
});

console.log(`✅ Build complete → ${config.outfile}`);

esbuild.stop();
