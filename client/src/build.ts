/**
 * Build configuration for esbuild.
 * Bundles the client-side TypeScript into a single IIFE JS file.
 *
 * @module build
 */

/** esbuild build configuration */
export interface BuildConfig {
  entryPoints: string[];
  bundle: boolean;
  format: string;
  outfile: string;
  minify: boolean;
  target: string;
  platform: string;
}

/**
 * Create esbuild build configuration.
 * Returns a config object for bundling the client into a single IIFE JS file.
 *
 * Configuration details:
 * - Entry point: src/index.ts
 * - Output: dist/seb-monitor.js (single file, minified)
 * - Format: IIFE (immediately invoked function expression)
 * - Target: ES2020 (modern browsers, including SEB's Chromium)
 * - Platform: browser (no Node.js APIs)
 *
 * @returns BuildConfig for esbuild
 */
export function createBuildConfig(): BuildConfig {
  return {
    entryPoints: ["src/index.ts"],
    bundle: true,
    format: "iife",
    outfile: "dist/seb-monitor.js",
    minify: true,
    target: "es2020",
    platform: "browser",
  };
}
