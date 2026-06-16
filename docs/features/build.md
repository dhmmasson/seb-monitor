# Client Build

## What It Does

The build script (`client/build.ts`) bundles the client-side TypeScript into a single IIFE JS file using esbuild. This produces `dist/seb-monitor.js` for embedding in Moodle/SEB.

## How to Verify It Works

Build the client library:
```bash
cd client && deno run -A build.ts
```

The output file `dist/seb-monitor.js` should be created.

## Build Configuration

The build uses esbuild with these settings:

- **Entry point:** `src/index.ts`
- **Format:** IIFE (immediately invoked function expression)
- **Output:** `dist/seb-monitor.js`
- **Minification:** enabled
- **Target:** ES2020 (modern browsers, including SEB's Chromium)
- **Platform:** browser (no Node.js APIs)

## Build Output

The build produces a single file `dist/seb-monitor.js` that:
- Contains all client-side code in a single IIFE
- Is minified for small file size (~15 KB)
- Can be embedded via `<script src="…/seb-monitor.js"></script>`
- Doesn't pollute the global scope (IIFE pattern)

## Spec Reference

See `plan.md` Section: "Client Library" for the full specification of build requirements.

## Dependencies

- None (pure TypeScript, no external imports)
