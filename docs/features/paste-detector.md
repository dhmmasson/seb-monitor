# Paste Detector — SEB-Compatible Paste Capture

## What it does

Detects paste events in Safe Exam Browser (SEB) environments where the native DOM `paste` event is blocked. Uses two alternative detection layers:

- **Layer 1 — Keyboard shortcut + content diff**: Listens for `keydown` events matching Ctrl+V (Windows/Linux) or Cmd+V (Mac). Snapshots answer field content before the paste, then diffs after the browser inserts content. Works because `keydown` fires at the keyboard level, which is harder for SEB to intercept.

- **Layer 2 — `beforeinput` event**: Listens for `beforeinput` events with `inputType: "insertFromPaste"`. The event carries the pasted text directly in `event.data`, no diff needed.

Both layers funnel into a shared `onPaste` callback that hashes the content, records the event, buffers paste content for server delivery, and schedules an immediate heartbeat.

## Why it exists

SEB intercepts Ctrl+V at the OS level and blocks the native `paste` DOM event. Copy detection works (uses `getSelection()`, a DOM-level operation), but paste detection fails because it relies on `clipboardData` from the blocked paste event.

## How to verify it works

1. Start the server: `cd server && deno run --allow-net --allow-env src/main.ts`
2. Open `demo/index.html` in a browser
3. Paste text into a textarea — check console for `[SEB Monitor]` paste events
4. Test with SEB on Windows to confirm paste detection in the controlled environment

## Diff engine

Layer 1 uses [`fast-diff`](https://github.com/jhchen/fast-diff) (Myers O(ND) algorithm, ~3KB minified) with semantic cleanup to extract the pasted text from before/after content snapshots. Semantic cleanup ensures DELETE and INSERT segments are cleanly separated, preventing character-level interleaving that would fragment the pasted text.

The diff correctly handles:
- Append at cursor (most common)
- Prepend at beginning
- Insert in the middle of existing text
- Paste over selected text (DELETE + INSERT in the diff)
- Repeating text patterns (where simple substring matching fails)

## Known limitations

- **Right-click paste**: Not detected by Layer 1 (no keyboard shortcut). Layer 2 (`beforeinput`) may catch it depending on the browser. Layer 3 (native `paste` event) catches it in non-SEB environments
- **`beforeinput` support**: Not all browsers fire `beforeinput` with `insertFromPaste`. SEB's Chromium version may or may not support it — Layer 1 is the primary fallback

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    paste-detector.ts                     │
│                                                         │
│  Layer 1: keydown Ctrl+V/Cmd+V → snapshot → diff        │
│  Layer 2: beforeinput insertFromPaste → event.data      │
│                                                         │
│  Both layers → onPaste(text) callback                   │
└─────────────────────────────────────────────────────────┘
```

## Files

| File | Purpose |
|---|---|
| `client/src/paste-detector.ts` | Multi-layer paste detection module (uses `fast-diff`) |
| `client/src/paste-detector_test.ts` | 38 unit tests |
| `client/src/index.ts` | Integration via `pasteDetectorFactory` parameter |

## Test coverage

- `extractPastedText`: append, prepend, insert, empty, unchanged, multiline, paste-over-selection, middle insert with repeating text, emoji, multiline paste into middle, large paste replacing small selection
- Keyboard paste: Ctrl+V, Cmd+V, no modifier, non-paste shortcuts
- beforeinput: insertFromPaste, non-paste inputType, null data
- Contenteditable support
- Multiple textarea fields
- start/stop event listener lifecycle
- Deduplication across detection layers

## Relevant spec sections

- `vision.md` — Paste Detection (Section: Copy / Paste Monitoring)
- `AGENTS.md` — Privacy & Security Rules (paste content storage)
