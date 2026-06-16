# Ace Editor Adapter

## What it does

Hooks into Moodle's CodeRunner Ace Editor instances to capture **paste** and **input** events that bypass native DOM listeners. Without this adapter, paste events in Ace editors are invisible to the monitoring system.

## Why it's needed

Moodle's CodeRunner question type uses [Ace Editor](https://ace.c9.io/) for code input. Ace intercepts keyboard events (including Ctrl+V paste) and handles them internally via its own event system. This means:

- **Copy events** work fine — `document.addEventListener("copy", ...)` fires because Ace doesn't intercept selection-based copy
- **Paste events** are consumed by Ace — the native `paste` event either doesn't fire on `document` or arrives with empty `clipboardData`
- **Input tracking** via `textarea.value` doesn't work — Ace uses a hidden textarea that doesn't reflect visible content

## How it works

The adapter (`client/src/ace-adapter.ts`) detects Ace editor instances on the page by querying `.ace_editor` containers and accessing their `env.editor` property. It then hooks into:

1. **`editor.on("paste", ...)`** — Ace's internal paste event, which provides the pasted text directly
2. **`editor.on("change", ...)`** — Ace's change event, which provides insert/remove deltas with the affected text

## Architecture

```
┌─────────────────────────────────────────────┐
│  index.ts (initialize)                      │
│  - Creates aceAdapterFactory parameter      │
│  - Passes onPaste / onChange callbacks       │
│  - Calls adapter.attach() on start()        │
│  - Calls adapter.detach() on stop()         │
│                                             │
│  Also uses capture-phase native listener:   │
│  document.addEventListener("paste", ...,    │
│    true)  ← captures before Ace intercepts  │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│  ace-adapter.ts (createAceAdapter)          │
│  - Queries .ace_editor containers           │
│  - Accesses container.env.editor            │
│  - Hooks editor.on("paste", callback)       │
│  - Hooks editor.on("change", callback)      │
│  - Stores tracked editors for clean detach  │
└─────────────────────────────────────────────┘
```

## Dependency injection

The adapter uses dependency injection for testability:

```typescript
// Production (autoStart):
initialize(undefined, undefined, createAceAdapter);

// Testing (with mock factory):
const mockFactory = (options) => ({
  attach: () => 1,
  detach: () => {},
  attachedCount: () => 1,
});
initialize(script, undefined, mockFactory);
```

## Files

| File | Purpose |
|------|---------|
| `client/src/ace-adapter.ts` | Adapter module — detects and hooks into Ace editors |
| `client/src/ace-adapter_test.ts` | 14 unit tests with mock Ace editor event system |
| `client/src/index.ts` | Integration — accepts aceAdapterFactory, attach/detach lifecycle |

## Test coverage

- Adapter creation and method existence
- No-op when Ace is not present on the page
- Detection of Ace editors from `.ace_editor` containers
- Paste event forwarding with text content
- Change event forwarding (insert/remove deltas)
- Multi-line change handling (lines joined with `\n`)
- Edge cases: missing `lines`, empty paste, unknown action types
- Clean detach (events stop firing after detach)
- Multiple editor support
- Integration: adapter attached on `start()`, detached on `stop()`
- Backward compatibility: works without aceAdapterFactory

## Known limitations

- Ace editors must have their `env.editor` property set (standard Ace setup does this automatically)
- If Ace is loaded lazily (after `start()`), editors created later won't be tracked. The adapter snapshots editors at `attach()` time.
- The capture-phase native paste listener serves as a fallback for non-Ace textareas and contenteditable elements.
