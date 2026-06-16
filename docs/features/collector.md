# Event Collector Module

## What It Does

The collector module manages the event buffer and copy/paste counts for heartbeat reporting. It provides a clean API for recording events and retrieving them for the heartbeat payload.

## How to Verify It Works

1. Run the unit tests:
   ```bash
   cd client && deno test src/collector_test.ts
   ```

2. All 13 tests should pass:
   - `createCollector returns collector object`
   - `collector starts with empty events`
   - `collector starts with zero copy count`
   - `collector starts with zero paste count`
   - `record adds event to buffer`
   - `record adds multiple events`
   - `recordCopy increments copy count`
   - `recordPaste increments paste count`
   - `getEvents returns a copy of the buffer`
   - `clearEvents empties the event buffer`
   - `clearEvents resets copy and paste counts`
   - `start and stop toggle collector state`
   - `collector records events and counts together`

## API

### `createCollector(): Collector`

Creates a new event collector instance.

**Returns:** `Collector` instance with the following methods:

- `start()` - Start collecting events (attach listeners)
- `stop()` - Stop collecting events (detach listeners)
- `getEvents()` - Get buffered events (returns a copy)
- `record(event)` - Record an event in the buffer
- `recordCopy()` - Record a copy event
- `recordPaste()` - Record a paste event
- `clearEvents()` - Clear event buffer and reset counts
- `getCopyCount()` - Get total copy count since last clear
- `getPasteCount()` - Get total paste count since last clear

## Usage

```typescript
import { createCollector } from "./collector.ts";

const collector = createCollector();
collector.start();

// Record events
collector.record({ type: "focus", timestamp: Date.now() });
collector.recordCopy();
collector.recordPaste();

// Get state for heartbeat
const events = collector.getEvents();
const copyCount = collector.getCopyCount();
const pasteCount = collector.getPasteCount();

// Reset after successful heartbeat
collector.clearEvents();
```

## Dependencies

- `../../shared/types.ts` - Type definitions for `ExamEvent`
