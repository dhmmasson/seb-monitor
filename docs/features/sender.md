# HTTP Sender Module

## What It Does

The sender module handles HTTP communication with the server, providing retry logic with exponential backoff for sending heartbeats and paste content.

## How to Verify It Works

1. Run the unit tests:
   ```bash
   cd client && deno test src/sender_test.ts
   ```

2. All 10 tests should pass:
   - `createSender returns sender object`
   - `sendHeartbeat sends POST request to correct URL`
   - `sendHeartbeat sends JSON payload`
   - `sendHeartbeat resolves on success`
   - `sendHeartbeat retries on failure`
   - `sendPasteContent sends POST request to correct URL`
   - `sendPasteContent sends JSON payload`
   - `sendPasteContent resolves on success`
   - `sendPasteContent retries on failure`
   - `sendPasteContent throws after max retries`

## API

### `createSender(baseUrl, fetchFn?, options?)`

Creates a new sender instance for HTTP communication.

**Parameters:**
- `baseUrl: string` - Base URL of the server (e.g., "http://localhost:8000")
- `fetchFn?: FetchFn` - Fetch function for dependency injection (default: global fetch)
- `options?: SenderOptions` - Sender options

**Returns:** `Sender` instance with the following methods:

- `sendHeartbeat(payload)` - Send heartbeat payload to `/api/heartbeat`
- `sendPasteContent(request)` - Send paste content to `/api/paste`

### SenderOptions

```typescript
interface SenderOptions {
  maxRetries?: number;  // Maximum retry attempts (default: 3)
}
```

## Retry Behavior

- **Exponential backoff**: 1s, 2s, 4s, etc.
- **Max retries**: Configurable (default: 3)
- **Total attempts**: maxRetries + 1 (initial + retries)

## Error Handling

- Network errors trigger retries
- HTTP errors (non-2xx status) trigger retries
- After all retries exhausted, throws the last error

## Dependency Injection

The sender accepts a `fetchFn` parameter for dependency injection, making it easy to:
- Mock HTTP calls in tests
- Use alternative HTTP clients
- Add request interceptors

## Spec Reference

See `vision.md` Section: "Server Persistence" for the full specification of API endpoints.

## Dependencies

- `../../shared/types.ts` - Type definitions for `HeartbeatPayload`, `PasteContentRequest`
