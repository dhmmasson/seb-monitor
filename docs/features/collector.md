# Event Collector Module

## What It Does

The collector module monitors browser events (copy, paste, focus, blur, keydown, input) and maintains an event buffer that is sent with each heartbeat. It provides a clean API for starting/stopping event collection and retrieving buffered events.

## How to Verify It Works

1. Run the unit tests:
   ```bash
   cd client && deno test src/collector_test.ts
   ```

2. All 6 tests should pass:
   - `createCollector returns collector object`
   - `collector starts with empty events`
   - `collector starts with zero copy count`
   - `collector starts with zero paste count`
   - `clearEvents empties the event buffer`
   - `clearEvents resets copy and paste counts`

## API

### `createCollector(focus, input, keys, sendPasteContent)`

Creates a new event collector instance.

**Parameters:**
- `focus: FocusAccumulator` - Focus accumulator to update on focus/blur events
- `input: InputStats` - Input stats to update on input events
- `keys: KeyStats` - Key stats to update on keydown events
- `sendPasteContent: SendPasteContent` - Callback to send paste content to server immediately

**Returns:** `Collector` instance with the following methods:

- `start()` - Start collecting events (attach listeners)
- `stop()` - Stop collecting events (detach listeners)
- `getEvents()` - Get buffered events (returns a copy)
- `clearEvents()` - Clear event buffer and reset counts
- `getCopyCount()` - Get total copy count since last clear
- `getPasteCount()` - Get total paste count since last clear

## Known Limitations

- Event listeners are not yet attached (implementation is minimal for current tests)
- The `started` state is tracked but not used for actual listener management
- Future tests will need to mock browser APIs (`document`, `window`) for full event collection testing

## Spec Reference

See `vision.md` Section: "Event Collection" for the full specification of what events should be collected and how they should be processed.

## Dependencies

- `../../shared/types.ts` - Type definitions for `ExamEvent`, `FocusAccumulator`, `InputStats`, `KeyStats`
