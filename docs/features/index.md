# IIFE Entry Point Module

## What It Does

The index module is the main entry point for the SEB monitoring library. When loaded as an IIFE `<script>` tag, it auto-initializes by reading configuration from `data-*` attributes, attaches all event listeners, and starts sending heartbeats.

## How to Verify It Works

```bash
cd client && deno test src/index_test.ts --no-check
```

All tests should pass.

## Usage (Production)

```html
<script src="http://monitor.example.com/seb-monitor.js"
  data-student-id="{fullname}"
  data-module-id="{module}"
  data-exam-id="{thisurl}"
  data-server-url="https://monitor.example.com"
  data-question-id="q3">
</script>
```

The library auto-starts on load. No manual initialization needed.

## API

### `initialize(scriptElement?, documentRef?)`

Initialize the monitoring system from a `<script>` tag's data attributes.

**Parameters:**
- `scriptElement?: HTMLScriptElement` — The script element (auto-discovered via `querySelector("script[data-student-id]")` if not provided)
- `documentRef?` — Document reference for auto-discovery (default: global document)

**Returns:** `InitResult` with:

- `studentId: string` — From `data-student-id`
- `examId: string` — From `data-exam-id`
- `serverUrl: string` — From `data-server-url`
- `questionId: string` — From `data-question-id` or URL params (`slot`/`questionId`)
- `start()` — Attach event listeners, send initial heartbeat, start 60s timer
- `stop()` — Detach listeners, clear timer

**Throws:** `Error` if required `data-*` attributes are missing.

## Data Attributes

| Attribute | Required | Description |
|---|---|---|
| `data-student-id` | ✅ | Student identifier (e.g. Moodle `{fullname}`) |
| `data-module-id` | ❌ | Module/course identifier |
| `data-exam-id` | ✅ | Exam URL or identifier |
| `data-server-url` | ✅ | Monitoring server URL |
| `data-question-id` | ❌ | Question ID (falls back to URL `slot` param, then "default") |

## Behavior on Start

1. Attaches DOM event listeners (focus, blur, copy, paste, keydown, input)
2. Sends an **immediate heartbeat** to register the student with the server
3. Starts a 60-second interval timer for subsequent heartbeats
4. Exposes `globalThis.__sebMonitor` for external access/debugging

## Spec Reference

See `vision.md` and `plan.md` Phase 1 for the full specification.
