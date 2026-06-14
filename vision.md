# Exam Activity Monitoring Specification

## Goal

Implement a lightweight client/server monitoring system for online exams running inside a controlled browser environment (e.g. Safe Exam Browser).

The objective is **not to detect cheating automatically**, but to collect behavioral signals that can later be reviewed by instructors or used to compute integrity indicators.

The system must be:

* lightweight
* privacy-preserving
* resilient to temporary network failures
* independent of the exam business logic

The system must **never store answer content**, clipboard content, screenshots, or individual keystrokes.

Only metadata and cryptographic hashes may be stored.

---

# High-Level Architecture

## Client

A JavaScript module injected into the exam page.

Responsibilities:

* monitor browser activity
* maintain counters and timers
* record copy/paste/focus events
* estimate typing activity
* periodically send heartbeat payloads

## Server

Receives heartbeats and event batches.

Responsibilities:

* persist raw telemetry
* aggregate metrics
* reconstruct activity timelines
* compute review indicators

---

# Heartbeat Model

The client sends one heartbeat every 60 seconds.

```ts
const HEARTBEAT_INTERVAL_MS = 60000;
```

Each heartbeat contains:

* aggregated metrics for the previous interval
* raw events collected during the interval

After successful transmission:

* counters are reset
* event buffer is cleared

Session-level totals may also be maintained locally.

---

# Event Collection

Only three categories of events are collected:

1. Copy/Paste
2. Focus/Visibility
3. Typing Activity

---

# Copy / Paste Monitoring

## Copy Detection

Listen to:

```ts
document.addEventListener("copy")
```

At copy time:

* retrieve current selection
* compute SHA-256 hash
* store hash only
* store selection length only
* timestamp the event

Never store selected text.

## Paste Detection

Listen to:

```ts
document.addEventListener("paste")
```

At paste time:

* retrieve pasted text
* compute SHA-256 hash
* store hash only
* store pasted text length only
* timestamp the event

Never store pasted text.

---

# Copy Event

```ts
interface CopyEvent {
  type: "copy";
  timestamp: number;

  hash: string;
  length: number;
}
```

Example:

```json
{
  "type": "copy",
  "timestamp": 123456,
  "hash": "a3f9...",
  "length": 84
}
```

---

# Paste Event

```ts
interface PasteEvent {
  type: "paste";
  timestamp: number;

  hash: string;
  length: number;

  matchedCopyHash?: string | null;
}
```

The client should attempt to match the paste hash against previously observed copy hashes during the current session.

Example:

```json
{
  "type": "paste",
  "timestamp": 124001,
  "hash": "a3f9...",
  "matchedCopyHash": "a3f9...",
  "length": 84
}
```

Example of an unmatched paste:

```json
{
  "type": "paste",
  "timestamp": 125000,
  "hash": "b7e2...",
  "matchedCopyHash": null,
  "length": 430
}
```

This may indicate content copied from outside the monitored page.

---

# Focus / Visibility Monitoring

Monitor:

```ts
window.focus
window.blur
document.visibilitychange
```

The browser cannot reliably determine where the user switched to.

Only the following facts are observable:

* page visible / hidden
* page focused / unfocused

---

# Focus Event

```ts
interface FocusEvent {
  type: "focus" | "blur";
  timestamp: number;
}
```

---

# Focus Time Accounting

The client must continuously accumulate by regularly probing the current focus/visibility state.

```ts
interface FocusAccumulator {
  focusedTimeMs: number;
  unfocusedTimeMs: number;
  blurCount: number;
}
```

At each heartbeat:

```text
focusRatio =
focusedTimeMs /
(focusedTimeMs + unfocusedTimeMs)
```

Expected value in a locked environment:

```text
~100%
```

---

# Typing Activity Monitoring

The system must not store keys.

The system must only store counts.

Monitor:

```ts
keydown
input
```

---

# Keyboard Statistics

```ts
interface KeyStats {
  keyDownCount: number;

  ctrlCount: number;
  altCount: number;
  shiftCount: number;
}
```

No actual key values are stored.

---

# Input Statistics

Monitor all answer fields.

Track text length changes.

```ts
interface InputStats {
  typedChars: number;
  pastedChars: number;
  deletedChars: number;

  currentLength: number;
}
```

---

# Input Estimation Rules

Given:

```text
oldLength
newLength
delta = newLength - oldLength
```

Rules:

### Typing

```text
delta > 0
and no paste event
```

Increment:

```text
typedChars += delta
```

### Deletion

```text
delta < 0
```

Increment:

```text
deletedChars += abs(delta)
```

### Paste

Immediately following a paste event:

```text
pastedChars += delta
```

This produces a reliable estimate of:

* typed content
* pasted content
* deleted content

without storing text.

---

# Unified Event Model

```ts
type ExamEvent =
  | CopyEvent
  | PasteEvent
  | FocusEvent;
```

Events are buffered locally until the next heartbeat.

---

# Heartbeat Payload

```ts
interface HeartbeatPayload {
  studentId: string;   // {fullname} from moodle
  examId: string;      // {thisurl} from moodle
  questionId: string;  // something set manually

  timestamp: number;

  focus: FocusAccumulator;

  input: InputStats;

  keys: KeyStats;

  copyCount: number;
  pasteCount: number;

  events: ExamEvent[];
}
```

Example:

```json
{
  "sessionId": "S1",
  "studentId": "U42",
  "examId": "E10",
  "questionId": "Q3",

  "timestamp": 1700000000,

  "focus": {
    "focusedTimeMs": 58000,
    "unfocusedTimeMs": 2000,
    "blurCount": 1
  },

  "input": {
    "typedChars": 340,
    "pastedChars": 120,
    "deletedChars": 25,
    "currentLength": 435
  },

  "keys": {
    "keyDownCount": 890,
    "ctrlCount": 4,
    "altCount": 0,
    "shiftCount": 82
  },

  "copyCount": 1,
  "pasteCount": 2,

  "events": [...]
}
```

---

# Server Persistence

## Session Table

```ts
interface Session {
  sessionId: string; // Generated by the server for the couple student/exam/day 

  studentId: string;
  examId: string;

  startTime: number;
}
```

---

# Heartbeat Table

```ts
interface StoredHeartbeat {
  sessionId: string;

  timestamp: number;

  focusedTimeMs: number;
  unfocusedTimeMs: number;
  blurCount: number;

  typedChars: number;
  pastedChars: number;
  deletedChars: number;

  currentLength: number;

  copyCount: number;
  pasteCount: number;

  keyDownCount: number;
}
```

---

# Event Table


```ts
interface StoredEvent {
  sessionId: string;

  timestamp: number;

  type: string;

  hash?: string;
  previousRelatedEvents : StoredEvent[] ; // 
  length?: number;
}
```



---

# Derived Metrics

The server computes metrics after the exam.

## Focus Ratio

```text
totalFocusedTime /
(totalFocusedTime + totalUnfocusedTime)
```

---

## Paste Ratio

```text
pastedChars /
(typedChars + pastedChars)
```

---

## Copy/Paste Correlation

```text
matchedPastes /
totalPastes
```

---

## Unmatched Paste Count

```text
paste events
with matchedCopyHash == null
```

These are pastes that cannot be linked to a previously observed copy operation.

---

## Cross Student Copy/Paste Detection

```text
paste events
with matchedCopyHash != null
and matchedCopyHash not in current session
```

---

## Largest Paste

Maximum:

```text
paste.length
```

observed during session.

---

## Largest Text Growth

Maximum increase in:

```text
currentLength
```

between consecutive heartbeats.

Useful for detecting sudden insertions.

---

# Non-Goals

The system will not attempt to:

* detect ChatGPT specifically
* detect Alt+Tab directly
* inspect other applications
* capture screenshots
* record answer text
* record clipboard content
* record individual keys

These actions are either impossible in a browser sandbox or intentionally excluded for privacy reasons.

---

# Security & Privacy

Requirements:

* all communications over HTTPS
* hashes computed using SHA-256
* no answer content stored
* no clipboard content stored
* no key values stored
* no personally identifiable data beyond existing exam identifiers

The telemetry collected must remain strictly behavioral and metadata-only.
