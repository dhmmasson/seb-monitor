# Accumulator Module

## What It Does

Tracks focus time, text input statistics, and keyboard activity for the Exam Activity Monitoring system. These counters are maintained client-side and reset after each heartbeat transmission.

## How to Verify It Works

### Run Unit Tests

```bash
cd client && deno test src/accumulator_test.ts
```

Expected output:
```
running 16 tests from ./src/accumulator_test.ts
createFocusAccumulator returns zeroed accumulator ... ok
recordBlur increments blur count ... ok
getFocusRatio returns 1 when fully focused ... ok
getFocusRatio returns 0 when fully unfocused ... ok
getFocusRatio returns 0.5 when equally focused and unfocused ... ok
getFocusRatio returns 1 when no time recorded ... ok
createInputStats returns zeroed stats ... ok
recordInput with positive delta increments typedChars ... ok
recordInput with negative delta increments deletedChars ... ok
recordInput with positive delta after paste increments pastedChars ... ok
createKeyStats returns zeroed stats ... ok
recordKey increments keyDownCount ... ok
recordKey with ctrlKey increments ctrlCount ... ok
recordKey with altKey increments altCount ... ok
recordKey with shiftKey increments shiftCount ... ok
resetAccumulators zeros all counters ... ok

ok | 16 passed | 0 failed
```

## API

### Focus Accumulator

#### `createFocusAccumulator(): FocusAccumulator`
Creates a new focus accumulator with zeroed values.

#### `recordBlur(focus: FocusAccumulator): void`
Records a blur event (page lost focus). Increments `blurCount`.

#### `recordFocusTime(focus: FocusAccumulator, ms: number): void`
Adds milliseconds to focused time (called periodically while page is visible).

#### `recordUnfocusedTime(focus: FocusAccumulator, ms: number): void`
Adds milliseconds to unfocused time (called periodically while page is hidden).

#### `getFocusRatio(focus: FocusAccumulator): number`
Calculates focus ratio: `focusedTimeMs / (focusedTimeMs + unfocusedTimeMs)`.
Returns `1` if no time has been recorded yet.

### Input Stats

#### `createInputStats(): InputStats`
Creates a new input stats object with zeroed values.

#### `recordInput(input: InputStats, delta: number, isPaste: boolean): void`
Records a text change in an answer field.

**Parameters:**
- `delta` - Change in text length (positive for insert, negative for delete)
- `isPaste` - Whether this input immediately follows a paste event

**Logic:**
- `delta > 0` and `isPaste === true` → increments `pastedChars`
- `delta > 0` and `isPaste === false` → increments `typedChars`
- `delta < 0` → increments `deletedChars` by `abs(delta)`
- Always updates `currentLength`

### Key Stats

#### `createKeyStats(): KeyStats`
Creates a new key stats object with zeroed values.

#### `recordKey(keys: KeyStats, event: { ctrlKey?, altKey?, shiftKey? }): void`
Records a keydown event with modifier key state.
- Increments `keyDownCount`
- Increments `ctrlCount` if `ctrlKey` was pressed
- Increments `altCount` if `altKey` was pressed
- Increments `shiftCount` if `shiftKey` was pressed

**Privacy note:** Only stores counts, never actual key values.

### Reset

#### `resetAccumulators(focus: FocusAccumulator, input: InputStats, keys: KeyStats): void`
Resets all accumulators for the next heartbeat interval.
- Zeros all focus metrics
- Zeros all input counters
- Zeros all key counters
- **Preserves** `currentLength` (represents current state)

## Known Limitations

1. **Polling-based focus tracking**: Focus time is accumulated by periodic polling (every 1 second), not by measuring exact focus/blur timestamps. This may have up to 1 second of inaccuracy.

2. **Input estimation rules**: The `isPaste` flag must be set by the collector module immediately after a paste event. If the timing is off, pasted characters may be counted as typed.

3. **No persistence**: Accumulators are in-memory only. If the page refreshes, all accumulated data is lost.

## Related Spec

- **Vision.md**: Section "Focus Time Accounting" - defines focus ratio calculation
- **Vision.md**: Section "Input Estimation Rules" - defines typed/pasted/deleted counting logic
- **Vision.md**: Section "Keyboard Statistics" - defines key stats (counts only, no values)
- **Plan.md**: Phase 1 Task 1.3 - "Implement `accumulator.ts`"

## Example Usage

```typescript
import {
  createFocusAccumulator,
  createInputStats,
  createKeyStats,
  recordBlur,
  recordFocusTime,
  recordInput,
  recordKey,
  getFocusRatio,
  resetAccumulators,
} from "./accumulator.ts";

// Create accumulators
const focus = createFocusAccumulator();
const input = createInputStats();
const keys = createKeyStats();

// Simulate 58 seconds of focused time
recordFocusTime(focus, 58000);

// User types 50 characters
recordInput(input, 50, false);

// User pastes 100 characters
recordInput(input, 100, true);

// User presses some keys
recordKey(keys, {});                    // Regular key
recordKey(keys, { ctrlKey: true });     // Ctrl+C
recordKey(keys, { shiftKey: true });    // Shift+A

// Check metrics
console.log(getFocusRatio(focus)); // 1.0 (fully focused)
console.log(input.typedChars);    // 50
console.log(input.pastedChars);   // 100

// Reset for next heartbeat
resetAccumulators(focus, input, keys);
console.log(input.currentLength); // 150 (preserved)
```
