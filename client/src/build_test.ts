import { assertEquals, assertExists } from "@std/assert";
import { createBuildConfig } from "./build.ts";

// ===== Build Config Tests =====

Deno.test("createBuildConfig returns config object", () => {
  const config = createBuildConfig();
  assertExists(config);
  assertEquals(typeof config.entryPoints, "object");
  assertEquals(typeof config.bundle, "boolean");
  assertEquals(typeof config.format, "string");
});

Deno.test("createBuildConfig sets entry point to index.ts", () => {
  const config = createBuildConfig();
  assertEquals(config.entryPoints, ["src/index.ts"]);
});

Deno.test("createBuildConfig enables bundling", () => {
  const config = createBuildConfig();
  assertEquals(config.bundle, true);
});

Deno.test("createBuildConfig sets format to iife", () => {
  const config = createBuildConfig();
  assertEquals(config.format, "iife");
});

Deno.test("createBuildConfig sets output to dist/seb-monitor.js", () => {
  const config = createBuildConfig();
  assertEquals(config.outfile, "dist/seb-monitor.js");
});

Deno.test("createBuildConfig enables minification", () => {
  const config = createBuildConfig();
  assertEquals(config.minify, true);
});

Deno.test("createBuildConfig targets browser", () => {
  const config = createBuildConfig();
  assertEquals(config.target, "es2020");
});

Deno.test("createBuildConfig disables platform-specific features", () => {
  const config = createBuildConfig();
  assertEquals(config.platform, "browser");
});
