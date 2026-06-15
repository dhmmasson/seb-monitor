# AGENTS.md — Implementation Guidelines for AI Agents

This document defines how AI agents should implement the Exam Activity Monitoring system. **Read this before writing any code.**

---

## 1. Project Context

Read these files first, in order:

1. `vision.md` — the full specification (data models, APIs, privacy rules)
2. `plan.md` — architecture decisions, project structure, phased task breakdown
3. `AGENTS.md` — this file (workflow and commit rules)

If any conflict exists, `vision.md` is the source of truth for *what* to build; `plan.md` is the source of truth for *how* to build it.

---

## 2. Test-Driven Development (Mandatory)

Every feature must follow a strict **Red → Green → Refactor** cycle. No exceptions.

### 2.1 RED — Write a Failing Test

Before writing any implementation code:

1. Write a test that exercises the behavior you intend to implement.
2. The test must **fail** when run. If it passes, the behavior already exists — stop and reassess.
3. The test must be **specific** — it should fail for the right reason (assertion failure, not a crash unless the feature has not been implemented at all). Do not build stub code in this part. 
4. **Run linter and type-checker** before committing (see Section 2.5).
5. Commit this as a standalone commit.

```
test: add failing test for <feature>
```

### 2.2 GREEN — Make the Test Pass

1. Write the **minimum** implementation code that makes the failing test pass.
2. Do not add extra behavior beyond what the test requires.
3. Run the test — it must pass.
4. **Run linter and type-checker** before committing (see Section 2.5).
5. Commit this as a standalone commit.

```
feat: implement <feature> (makes test pass)
```

### 2.3 REFACTOR — Clean Up Without Changing Behavior

1. Now that the test protects the behavior, clean up the code.
2. Extract functions, rename variables, improve clarity — but do not change the test or the behavior.
3. Run the test again — it must still pass.
4. **Run linter and type-checker** before committing (see Section 2.5).
5. Commit this as a standalone commit.

```
refactor: clean up <feature> implementation
```

### 2.4 Cycle Summary

Each TDD cycle produces **3 commits**:

| Commit | Content | Verifies |
|---|---|---|
| `test: add failing test for X` | Test only, no implementation | Specification intent is captured |
| `feat: implement X` | Implementation makes test pass | Code satisfies specification |
| `refactor: clean up X` | Code quality improvement | Behavior is preserved |

---

### 2.5 Linting & Type-Checking (Mandatory Before Every Commit)

Before **each** commit in the TDD cycle, you must run:

```bash
# Client-side (Deno)
cd client && deno lint && deno check src/*.ts

# Server-side (Deno)
cd server && deno lint && deno check src/*.ts
```

**Rules**:
- All linting errors must be resolved before committing.
- All type-checking errors must be resolved before committing.
- If linting or type-checking fails, fix the issues before proceeding.
- Do not commit code with lint or type errors — even in the RED phase.

This ensures every commit in the history is clean and passes basic quality checks.

---

## 3. Validation — Document It Works

At the end of each complete TDD cycle (after the refactor commit), you must **validate** that the feature actually works as intended and **produce documentation** for it. This is the validation step — distinct from the verification step above.

### 3.1 What Counts as Validation

Validation means **proving it works** and **writing it down**. Depending on the layer, choose one:

| Layer | Validation Method |
|---|---|
| **Client-side logic** (crypto, accumulators, collectors) | Run tests in Deno; capture output as evidence |
| **Server API routes** | Start the server, send real HTTP requests, capture request/response logs |
| **Database layer** | Run integration tests; capture DB state before and after |
| **Dashboard UI** | Start the server, open the page, capture screenshots |
| **Docker** | Build the image, run the container, verify health endpoint |

### 3.2 Documentation Deliverables

Each validation commit must produce **at least one** of the following:

| Deliverable | Location | When to Use |
|---|---|---|
| Feature documentation | `docs/features/<feature>.md` | Always — describes what the feature does, how to use it, API contracts |
| Screenshot | `docs/screenshots/<feature>.png` | UI or visual features |
| Test output log | `docs/demos/<feature>.log` | Backend or CLI features |
| Demo script | `docs/demos/<feature>.sh` | Reproducible verification steps |

The `docs/features/<feature>.md` file is **mandatory**. It should contain:
- What the feature does (1–2 sentences)
- How to verify it works (commands, URLs, steps)
- Any known limitations or edge cases
- Link to the relevant spec section in `vision.md`

### 3.3 Validation Commit

After the 3-commit TDD cycle, add a **4th commit** with the validation documentation:

```
docs: document <feature> — validated via <method>
```

### 3.4 Complete Cycle = 4 Commits

| # | Commit | Purpose |
|---|---|---|
| 1 | `test: add failing test for X` | **Verification** — captures intent |
| 2 | `feat: implement X` | **Verification** — satisfies spec |
| 3 | `refactor: clean up X` | **Verification** — preserves behavior |
| 4 | `docs: document X — validated via <method>` | **Validation** — proves real-world behavior + produces documentation |

---

## 4. Commit Conventions

This project uses **Conventional Commits** (configured in `.cz.json`).

### Format

```
<type>(<scope>): <description>
```

### Types

| Type | When to Use |
|---|---|
| `test` | Adding or updating tests (RED phase) |
| `feat` | New feature or capability (GREEN phase) |
| `refactor` | Code restructuring without behavior change (REFACTOR phase) |
| `docs` | Documentation, validation evidence, and feature guides (validation step) |
| `fix` | Bug fix (still follows TDD: test first, then fix) |
| `chore` | Build, CI, config, dependency changes |

### Scopes

| Scope | Area |
|---|---|
| `client` | Browser-side monitoring library |
| `server` | Deno backend |
| `db` | Database schema and queries |
| `api` | HTTP API endpoints |
| `dashboard` | Instructor-facing UI |
| `docker` | Containerization |
| `shared` | Shared types between client and server |
| `vision` | Vision or Plan updates |


### Examples

```
test(db): add failing test for session creation
feat(db): implement session creation (makes test pass)
refactor(db): extract session lookup into separate function
docs(db): document session creation — validated via integration test + SQLite inspection
```

```
test(api): add failing test for POST /api/heartbeat
feat(api): implement POST /api/heartbeat route (makes test pass)
refactor(api): extract payload validation into middleware
docs(api): document heartbeat endpoint — validated via curl test + DB verification
```

check that commit are valid using `cz check -m "<message>"    

---

## 5. Privacy & Security Rules

These are **hard constraints**. Do not violate them.

1. **Never store raw answer content** in heartbeats, events, or any other data structure.
2. **Never store individual keystrokes** — only aggregate counts.
3. **Never store clipboard content in heartbeat payloads** — paste content goes exclusively through `POST /api/paste`.
4. **Paste content** is the only raw text stored. It is isolated in the `paste_contents` table and accessible only behind dashboard authentication.
5. **Copy content** is stored as SHA-256 hash only — never as text.
6. All API communication must be over HTTPS in production.
7. Dashboard access requires password authentication.

If a test or implementation would violate these rules, **stop and flag it** — do not proceed.

---

## 6. File Structure Reference

When implementing, place files in the correct location per `plan.md` Section 2:

```
client/src/     — Browser-side TypeScript (compiled to single IIFE JS)
server/src/     — Deno backend (routes, services, db, views)
server/tests/   — Server-side tests
shared/         — Types shared between client and server
```

### Naming Conventions

- **Files**: `kebab-case.ts` (e.g., `paste-content.ts`, `session-store.ts`)
- **Tests**: `<filename>_test.ts` (Deno convention)
- **Interfaces**: `PascalCase` (e.g., `HeartbeatPayload`, `PasteContentRequest`)
- **Functions**: `camelCase` (e.g., `insertHeartbeat`, `getSessionById`)
- **SQL tables**: `snake_case` (e.g., `paste_contents`, `heartbeats`)
- **Env vars**: `SCREAMING_SNAKE_CASE` (e.g., `DB_PATH`, `DASHBOARD_PASSWORD`)

---

## 7. Testing Approach

### Client-Side Tests

- Use Deno's built-in test runner (`deno test`)
- Mock browser APIs (`document`, `window`, `fetch`) where needed
- Test SHA-256 hashing against known vectors
- Test accumulator logic (focus time calculation, input estimation rules)
- Test heartbeat payload construction

### Server Tests

- Use Deno's built-in test runner
- Use an in-memory or temporary SQLite database for isolation
- Test each API route independently
- Test database CRUD operations
- Test derived metric calculations

### Integration Tests

- Start the full server
- Send real HTTP requests
- Verify database state
- Test the complete flow: client sends heartbeat → server stores → dashboard displays

### Test File Placement

```
server/tests/api_test.ts        — API route tests
server/tests/db_test.ts         — Database layer tests
server/tests/metrics_test.ts    — Derived metric tests
client/src/*_test.ts            — Co-located with source files
```

---

## 8. Implementation Order

Follow the phases in `plan.md` Section 5. Within each phase, follow the TDD cycle strictly.

### Phase 1: Client Library
1. `crypto.ts` — SHA-256 hashing
2. `accumulator.ts` — Focus time, input stats, key stats
3. `collector.ts` — Event listeners
4. `heartbeat.ts` — Timer + payload construction
5. `sender.ts` — HTTP sender with retry
6. `index.ts` — IIFE entry point

### Phase 2: Server Core
1. `db/schema.ts` — Table creation
2. `db/connection.ts` — SQLite connection
3. `db/sessions.ts` — Session CRUD
4. `db/heartbeats.ts` — Heartbeat storage
5. `db/events.ts` — Event storage
6. `db/paste_contents.ts` — Paste content storage
7. `routes/api.ts` — Heartbeat endpoint
8. `routes/paste.ts` — Paste content endpoint

### Phase 3: Docker
1. `Dockerfile`
2. `docker-compose.yml`
3. Environment configuration

### Phase 4: Dashboard
1. `routes/auth.ts` — Authentication
2. `views/layout.ts` — HTML shell
3. `views/login.ts` — Login form
4. `services/metrics.ts` — Derived metrics
5. `services/exam.ts` — Exam aggregation
6. `views/exam-list.ts` — Student table
7. `views/student-detail.ts` — Student graphs + paste content viewer

---

## 9. Running Tests

```bash
# Server tests
cd server && deno test

# Client tests (type-checking + unit tests)
cd client && deno check src/*.ts && deno test

# All tests
deno test --recursive
```

---

## 10. When You Are Stuck

1. Re-read `vision.md` — the spec is the source of truth.
2. Re-read `plan.md` — the architecture decisions are already made.
3. Write a more specific test — if you can't write the test, you don't understand the requirement yet.
4. Implement the simplest possible thing — you can refactor later.
5. If the issue is ambiguous, check `plan.md` Section 7 (Open Questions) — it may be a known open question.

---

## 11. Best Practices (Lessons Learned)

### Testing

- **Server API tests use `app.fetch(request)`** — no need to start a real server. Create the handler, call it directly with a `Request` object. This is fast and isolated.
- **In-memory SQLite for tests** — use `new DB(":memory:")` + `runMigrations(db)` in test helpers. Each test gets a fresh DB. Never share DB state between tests.
- **`prepareQuery` for all parameterized queries** — `db.query(sql)` only works without args in `deno.land/x/sqlite`. Use `db.prepareQuery(sql).all(args)` for any query with `?` params.
- **Client tests are co-located** — `client/src/foo_test.ts` next to `client/src/foo.ts`. Run with `cd client && deno test --no-check`.
- **Lint before every commit** — `deno lint` on both `client/` and `server/`. Use `--no-check` for test runs to skip type-checking speed-up.

### Running the Demo

```bash
# Start the Phase 2 server (needs unsandboxed terminal for Deno cache)
cd server && deno run --allow-net --allow-env src/main.ts &

# Open the Phase 1 demo in browser — it connects to port 8000 automatically
# demo/index.html → click "Start Monitoring"
```

**Key**: The demo HTML uses `<script id="seb-monitor-config" data-student-id="..." ...>` to configure itself — same pattern as production Moodle integration.

### Deno-Specific Notes

- **`deno:sqlite` is not always available** — use `deno.land/x/sqlite` (add as `"sqlite"` in `deno.json` imports).
- **Oak causes JSR cache issues** — use `Deno.serve()` instead. Zero external HTTP deps.
- **Corrupted Deno cache** — if you see "Failed reading cache entry", delete the corrupted SQLite files in `~/Library/Caches/deno/` or use `DENO_DIR=$(mktemp -d)` for a fresh cache.
- **`deno test --no-check`** — skip type-checking for faster test runs. Use `deno lint` separately for code quality.

### TDD Workflow

- **RED**: Write test → verify it fails → commit
- **GREEN**: Minimal implementation → verify it passes → commit
- **REFACTOR**: Clean up → verify tests still pass → commit
- **DOCS**: Write feature docs + demo → commit

Use `cz check -m "<message>"` to validate commit messages before committing.

### Commit Messages

- Use `git add server/` (or `client/`, `docs/`) — scope the staging area
- Combine related changes in one commit when they're part of a single TDD cycle
- Use `fix(server): ...` for bug fixes, `refactor(client): ...` for restructuring
- Always include test count in the commit body: "All 28 tests pass"
