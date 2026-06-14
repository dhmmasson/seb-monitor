# IIFE Entry Point Module

## What It Does

The index module is the main entry point for the SEB monitoring library. It initializes the monitoring system by reading student/exam IDs from DOM elements and provides start/stop methods for controlling the heartbeat timer.

## How to Verify It Works

1. Run the unit tests:
   ```bash
   cd client && deno test src/index_test.ts
   ```

2. All 9 tests should pass:
   - `initialize returns initialization result`
   - `initialize extracts student ID from DOM`
   - `initialize extracts exam ID from DOM`
   - `initialize uses default question ID`
   - `initialize throws when theuser element not found`
   - `initialize throws when themodule element not found`
   - `initialize throws when theexam element not found`
   - `start begins heartbeat timer`
   - `stop ends heartbeat timer`

## API

### `initialize(serverUrl, getElementById?)`

Initialize the monitoring system.

**Parameters:**
- `serverUrl: string` - URL of the monitoring server
- `getElementById?: GetElementByIdFn` - Function to get DOM elements (default: document.getElementById)

**Returns:** `InitResult` with the following properties and methods:

- `studentId: string` - Student ID extracted from DOM (`#theuser`)
- `examId: string` - Exam ID extracted from DOM (`#theexam`)
- `questionId: string` - Question ID (default: "default")
- `start()` - Start the heartbeat timer and event collection
- `stop()` - Stop the heartbeat timer and event collection

**Throws:** `Error` if required DOM elements (`#theuser`, `#themodule`, `#theexam`) are not found.

## DOM Elements

The initialization reads from these DOM elements:

| Element ID | Purpose | Example Content |
|---|---|---|
| `#theuser` | Student identifier | "John Doe" |
| `#themodule` | Module/course identifier | "CS101" |
| `#theexam` | Exam URL/identifier | "https://moodle.example.com/exam/123" |

These elements are typically injected by the Moodle/SEB integration script.

## Dependency Injection

The module accepts a `getElementById` function for dependency injection, making it easy to:
- Test without a real DOM
- Use alternative DOM querying methods
- Mock DOM elements in tests

## Spec Reference

See `vision.md` Section: "High-Level Architecture" for the full specification of client initialization.

## Dependencies

- None (pure TypeScript, no external imports)
