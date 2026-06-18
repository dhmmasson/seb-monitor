## v0.8.0 (2026-06-18)

### Feat

- **client**: replace extractPastedText with fast-diff (makes tests pass)

### Fix

- **docker**: copy package.json and install npm deps before client build
- **client**: resolve type-check errors in test mocks and type annotations

### Refactor

- **client**: extract INSERT constant in paste-detector

## v0.7.0 (2026-06-18)

### Feat

- capture and store input content hash at each heartbeat

## v0.6.0 (2026-06-18)

### Feat

- **dashboard**: show copy content in student detail view
- **dashboard**: add hash list and hash detail views with routes
- **api**: add unified /api/clipboard endpoint for copy and paste content
- **client**: use unified clipboard capture for copy and paste events
- **client**: add sendClipboardContent method to sender
- **client**: add copy hash tracking and paste matching to collector
- **db**: add event_type column and clipboard query functions
- **client**: integrate paste detector into initialize()
- **client**: implement paste detector with keyboard and beforeinput layers
- **client**: integrate Ace adapter into initialize (makes tests pass)
- **client**: implement Ace Editor adapter (makes tests pass)

### Fix

- **db**: add event_type column migration for existing databases
- **client**: global singleton guard prevents duplicate event listeners
- **client**: retry keyboard paste detection for SEB async clipboard injection
- **client**: pass aceAdapterFactory in autoStart for production use

### Refactor

- **client**: extract shared recordPasteContent function

## v0.5.0 (2026-06-17)

### Feat

- implement immediate heartbeat scheduling on copy/paste events with debounce
- **server**: add BASE_PATH env var for reverse proxy support
- **docker**: implement Dockerfile, docker-compose.yml, and .dockerignore

### Fix

- **metrics**: update focusRatio default to 1 when no heartbeats exist
- **server**: use basePath in all view hrefs and login form action
- **docker**: update PORT configuration to 44513 in .env.example and docker-compose.yml

### Refactor

- remove getFocusRatio function and related tests; update collector module for event management

## v0.4.0 (2026-06-16)

### Feat

- **server**: show heartbeat entries in student detail event timeline
- **client**: send initial heartbeat immediately on start() — registers student with server right away
- **client**: wire index.ts start/stop — full monitoring lifecycle + production demo
- **server**: URL-safe exam ID encoding with base64url — full URLs work in routes (makes test pass)
- **server**: implement exam index page showing all exams + fix demo bugs (makes test pass)
- **server**: implement auth and dashboard routes with cookie middleware (makes test pass)
- **server**: implement student detail view with charts and paste expand (makes test pass)
- **server**: implement SSR views — layout, login, exam-list (makes test pass)
- **server**: implement derived metrics computation (makes test pass)
- **server**: implement auth password hashing and cookie signing (makes test pass)

### Fix

- **client**: buffer paste content until heartbeat establishes sessionId
- **server**: PROJECT_ROOT resolves to project root, not server/ — was off by one directory level
- **client**: simplify build script — no external std import, pure URL resolution
- **client**: build script works from any directory — use import.meta.url for path resolution
- **client**: reset copyCount/pasteCount after heartbeat + reset accumulators

### Refactor

- **server**: update dashboard JSDoc for encoded exam IDs docs(server): document URL-safe exam ID encoding — validated via 12 unit tests
- **server**: update dashboard route JSDoc to reflect exam index
- **server**: api.ts uses shared route utils, dashboard uses extractParam consistently, fix demo lint
- **server**: extract shared route utils — html, json, redirect, extractParam
- **server**: extract shared queryAll to db/utils.ts, remove duplication
- **server**: extract shared escapeHtml to views/utils.ts, simplify badge logic
- **server**: use extends for ExamSummaryEntry instead of repeating fields
- **server**: extract shared helpers in auth — toBase64, fromBase64, deriveKey, hmacKey

## v0.3.0 (2026-06-15)

### Feat

- **server,client**: add question_id to heartbeats (GREEN)

### Refactor

- **client,demo**: read all config from script data-attributes

## v0.2.0 (2026-06-14)

### Feat

- **server**: implement DB schema, CRUD, and API routes (GREEN phase)

### Fix

- **server**: replace Oak with Deno.serve(), fix paste FK, wire demo sessionId

### Refactor

- **server**: add main.ts entry point, connection singleton, config

## v0.1.0 (2026-06-14)

### Feat

- **client**: implement esbuild configuration (makes tests pass)
- **client**: implement IIFE entry point (makes tests pass)
- **client**: implement HTTP sender with retry (makes tests pass)
- **client**: implement heartbeat builder (makes tests pass)
- **client**: implement event collector (makes tests pass)
- **client**: implement focus, input, and key accumulators (makes tests pass)
- **types**: add shared types for Exam Activity Monitoring system

### Refactor

- **client**: improve esbuild configuration documentation
- **client**: improve IIFE entry point documentation
- **client**: improve sender documentation and structure
- **client**: improve heartbeat builder documentation
- **client**: improve collector code documentation and structure
- **client**: use ternary operators for modifier key counting
- **client**: extract hex conversion to helper function and improve JSDoc
