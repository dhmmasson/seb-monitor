# esbuild Configuration Module

## What It Does

The build module provides esbuild configuration for bundling the client-side TypeScript into a single IIFE JS file. This configuration is used to create `dist/seb-monitor.js` for embedding in Moodle/SEB.

## How to Verify It Works

1. Run the unit tests:
   ```bash
   cd client && deno test src/build_test.ts
   ```

2. All 8 tests should pass:
   - `createBuildConfig returns config object`
   - `createBuildConfig sets entry point to index.ts`
   - `createBuildConfig enables bundling`
   - `createBuildConfig sets format to iife`
   - `createBuildConfig sets output to dist/seb-monitor.js`
   - `createBuildConfig enables minification`
   - `createBuildConfig targets browser`
   - `createBuildConfig disables platform-specific features`

## API

### `createBuildConfig()`

Creates esbuild build configuration for bundling the client library.

**Returns:** `BuildConfig` object with the following properties:

- `entryPoints: ["src/index.ts"]` - Entry point for the bundle
- `bundle: true` - Enable bundling (include all imports)
- `format: "iife"` - Output as immediately invoked function expression
- `outfile: "dist/seb-monitor.js"` - Output file path
- `minify: true` - Enable minification for smaller file size
- `target: "es2020"` - Target modern browsers (including SEB's Chromium)
- `platform: "browser"` - Browser platform (no Node.js APIs)

## Build Output

The build produces a single file `dist/seb-monitor.js` that:
- Contains all client-side code in a single IIFE
- Is minified for small file size (~15 KB)
- Can be embedded via `<script src="…/seb-monitor.js"></script>`
- Doesn't pollute the global scope (IIFE pattern)

## Usage

To build the client library:
```bash
cd client
deno run -A build.ts
```

Or using esbuild directly:
```bash
cd client
deno run -A npm:esbuild --bundle --format=iife --minify --target=es2020 --platform=browser --outfile=dist/seb-monitor.js src/index.ts
```

## Spec Reference

See `plan.md` Section: "Client Library" for the full specification of build requirements.

## Dependencies

- None (pure TypeScript, no external imports)
