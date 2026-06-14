# Heartbeat Builder Module

## What It Does

The heartbeat module constructs `HeartbeatPayload` objects from accumulator and collector state. It provides a clean API for building heartbeat payloads and resetting state after successful sends.

## How to Verify It Works

1. Run the unit tests:
   ```bash
   cd client && deno test src/heartbeat_test.ts
   ```

2. All 10 tests should pass:
   - `createHeartbeatBuilder returns builder object`
   - `build returns HeartbeatPayload with correct structure`
   - `build includes correct student/exam/question IDs`
   - `build includes focus accumulator data`
   - `build includes input stats data`
   - `build includes key stats data`
   - `build includes copy and paste counts from collector`
   - `build includes events from collector`
   - `build sets timestamp to current time`
   - `reset clears collector events`

## API

### `createHeartbeatBuilder(studentId, examId, questionId, focus, input, keys, collector)`

Creates a new heartbeat builder instance.

**Parameters:**
- `studentId: string` - Student identifier
- `examId: string` - Exam identifier
- `questionId: string` - Question identifier
- `focus: FocusAccumulator` - Focus accumulator to read from
- `input: InputStats` - Input stats to read from
- `keys: KeyStats` - Key stats to read from
- `collector: Collector` - Event collector to read from

**Returns:** `HeartbeatBuilder` instance with the following methods:

- `build()` - Build a HeartbeatPayload from current state
- `reset()` - Reset accumulators and clear event buffer after successful send

## HeartbeatPayload Structure

```typescript
interface HeartbeatPayload {
  studentId: string;
  examId: string;
  questionId: string;
  timestamp: number;        // Unix epoch ms
  focus: FocusAccumulator;  // Copy of focus state
  input: InputStats;        // Copy of input stats
  keys: KeyStats;           // Copy of key stats
  copyCount: number;        // Total copies since last reset
  pasteCount: number;       // Total pastes since last reset
  events: ExamEvent[];      // Buffered events
}
```

## Known Limitations

- Accumulator state is copied via spread operator (shallow copy)
- The `reset()` method only clears collector events, not accumulator counters
- Timestamp is set at build time, not at the start of the heartbeat interval

## Spec Reference

See `vision.md` Section: "Heartbeat Payload" for the full specification of what data should be included in each heartbeat.

## Dependencies

- `../../shared/types.ts` - Type definitions for `HeartbeatPayload`, `FocusAccumulator`, `InputStats`, `KeyStats`
- `./collector.ts` - `Collector` interface for reading events and counts
