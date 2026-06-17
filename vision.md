# Exam Activity Monitoring Specification

## Goal

Implement a lightweight client/server monitoring system for online exams running inside a controlled browser environment (e.g. Safe Exam Browser).

The objective is **not to detect cheating automatically**, but to collect behavioral signals that can later be reviewed by instructors or used to compute integrity indicators.

The system must be:

* lightweight
* privacy-preserving
* resilient to temporary network failures
* independent of the exam business logic

The system must **never store answer content**, screenshots, or individual keystrokes.

The system **does store paste content** server-side (hashed and linked to the student session) to allow instructors to review suspicious pastes after the exam. This is the only form of content the system retains. Copy content is still stored as hash-only.

Only metadata and cryptographic hashes may be stored for all other data.

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
* store hash and selection length in heartbeat event buffer
* **immediately send** the copy content to the server via `POST /api/clipboard` (hash + content + eventType: "copy")
* track hash for paste matching (bounded Set, max 100 entries)

The copy content is stored server-side alongside paste content in a unified `clipboard_contents` table. This allows instructors to see what was copied and match it against pastes.

## Paste Detection

Listen to:

```ts
document.addEventListener("paste")
```

At paste time:

* retrieve pasted text
* compute SHA-256 hash
* store hash and pasted text length in heartbeat event buffer
* match paste hash against previously recorded copy hashes (for `matchedCopyHash` field)
* **immediately send** the paste content to the server via `POST /api/clipboard` (hash + content + eventType: "paste")

The paste content is stored server-side linked by its SHA-256 hash and the student's session. This allows instructors to review what was pasted during exam review. The content is never sent in the heartbeat — it goes through a dedicated endpoint to ensure it is captured even if the heartbeat fails.

Never store pasted text in the heartbeat payload itself.

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

Note: The paste **content** is sent separately via `POST /api/paste` immediately upon detection. The event in the heartbeat only carries the hash and metadata.

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

# Paste Content Storage

Paste content is stored separately from the event stream. Each paste is sent immediately to the server via a dedicated API endpoint.

## Paste Content Table

```ts
interface StoredPasteContent {
  hash: string;          // SHA-256 hash of the pasted text (primary key)
  session_id: string;    // Session that performed the paste
  content: string;       // The actual pasted text (plaintext)
  length: number;        // Character count
  timestamp: number;     // When the paste occurred
  exam_id: string;       // Denormalized for easy querying
  created_at: string;
}
```

The hash serves as both the primary key and a deduplication mechanism: if the same text is pasted multiple times by the same or different students, it is stored only once, and subsequent pastes reference the existing hash.

## Paste Content API

### POST /api/paste

The client calls this endpoint immediately upon detecting a paste, **outside** the heartbeat cycle.

**Request body**:

```ts
interface PasteContentRequest {
  hash: string;        // SHA-256 of the pasted text
  content: string;     // The pasted text itself
  length: number;      // Character count
  sessionId: string;   // Server-assigned session ID
  examId: string;      // Exam identifier
  timestamp: number;   // When the paste occurred
}
```

**Server-side logic**:

1. Validate payload
2. If hash already exists in table → update `session_id` (append reference) or skip (idempotent)
3. If hash is new → insert row
4. Return `200 OK`

**Why a separate endpoint?**

Paste content is the most sensitive data the system stores. Keeping it in a dedicated endpoint and table:
* isolates it from the heartbeat flow (a failed heartbeat does not lose paste evidence)
* allows independent retention policies (paste content can be purged separately)
* makes access control auditable (dashboard queries this table explicitly)

### GET /api/paste/{hash}

Retrieve the content of a paste by its hash. **Dashboard-only** (requires authentication).

**Response**:

```json
{
  "hash": "a3f9...",
  "content": "The pasted text...",
  "length": 84,
  "sessionId": "S1",
  "timestamp": 124001
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

---

# Architecture Decisions

Record of strategic decisions taken during implementation (see also `plan.md` for operational details).

## D1: Client reads config from `<script>` data-attributes

**Decision**: All configuration (studentId, examId, serverUrl, questionId) is read from `data-*` attributes on the `<script>` tag itself, not from hidden DOM elements.

**Rationale**: The original approach relied on a hidden `<p id="stuffs">` paragraph injected by Moodle. This creates tight coupling to Moodle's DOM structure. Using `data-*` attributes on the script tag makes the library self-contained — the script tag IS the configuration.

**Moodle integration pattern**:
```html
<script src="https://monitor.example.com/seb-monitor.js"
  data-student-id="{fullname}"
  data-module-id="{module}"
  data-exam-id="{thisurl}"
  data-server-url="https://monitor.example.com"
  data-question-id="q3">
</script>
```

**Auto-discovery**: If no script element is passed to `initialize()`, the library finds itself via `document.querySelector("script[data-student-id]")`.

## D2: questionId resolution fallback chain

**Decision**: questionId is resolved via a priority chain: `data-question-id` attribute → Moodle `slot` URL param → generic `questionId` URL param → `"default"`.

**Rationale**: Moodle quiz URLs contain a `slot` parameter identifying the question (e.g., `/mod/quiz/attempt.php?attempt=123&slot=3`). By extracting this automatically, question-level tracking works without instructor configuration. The `data-question-id` attribute provides an explicit override.

## D3: Server uses Deno.serve() instead of Oak

**Decision**: The HTTP server uses Deno's built-in `Deno.serve()` with a plain `(Request) => Promise<Response>` handler, instead of the Oak framework.

**Rationale**: Oak introduced a JSR dependency that caused cache corruption issues in development environments. `Deno.serve()` is zero-dependency, simpler, and sufficient for our routing needs (4 endpoints). Route matching is done with string comparison + a simple `extractParam()` regex helper.

## D4: paste_contents has no foreign key on session_id

**Decision**: The `paste_contents` table does NOT have a `REFERENCES sessions(session_id)` constraint, unlike `heartbeats` and `events`.

**Rationale**: Per the spec, paste content is sent immediately via `POST /api/paste` when a paste event occurs — this may happen before the first heartbeat creates the session. A foreign key would cause a constraint violation. The session_id is still stored for querying, just not enforced at the DB level.

## D5: Session deduplication by (studentId, examId, day)

**Decision**: Sessions are unique per `(studentId, examId, startOfDay)`. The server generates the UUID; the client never stores or manages sessionId.

**Rationale**: When students navigate between Moodle pages (e.g., question 1 → question 2), the script reloads and re-initializes. By keying on `(studentId, examId, day)`, all heartbeats from the same student on the same exam day land in the same session — even across page navigations. The client is stateless with respect to sessions.

## D6: SQLite without external database

**Decision**: SQLite (via `deno.land/x/sqlite`) with WAL mode, file-based storage.

**Rationale**: Self-contained deployment — no separate database container. Handles 100+ concurrent students easily. The `.db` file is the entire database, trivial to backup. If scaling beyond a single server is needed later, PostgreSQL is the migration path.
