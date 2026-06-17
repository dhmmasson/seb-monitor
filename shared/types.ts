/**
 * Shared types for the Exam Activity Monitoring system.
 * These types are used by both client and server.
 * Source of truth: vision.md
 */

// ===== Event Types =====

export interface CopyEvent {
  type: "copy";
  timestamp: number;
  hash: string;
  length: number;
}

export interface PasteEvent {
  type: "paste";
  timestamp: number;
  hash: string;
  length: number;
  matchedCopyHash?: string | null;
}

export interface FocusEvent {
  type: "focus" | "blur";
  timestamp: number;
}

export type ExamEvent = CopyEvent | PasteEvent | FocusEvent;

// ===== Accumulator Types =====

export interface FocusAccumulator {
  focusedTimeMs: number;
  unfocusedTimeMs: number;
  blurCount: number;
}

export interface InputStats {
  typedChars: number;
  pastedChars: number;
  deletedChars: number;
  currentLength: number;
}

export interface KeyStats {
  keyDownCount: number;
  ctrlCount: number;
  altCount: number;
  shiftCount: number;
}

// ===== Heartbeat Payload =====

export interface HeartbeatPayload {
  studentId: string;
  examId: string;
  questionId: string;
  timestamp: number;
  focus: FocusAccumulator;
  input: InputStats;
  keys: KeyStats;
  copyCount: number;
  pasteCount: number;
  events: ExamEvent[];
}

// ===== Paste Content Request =====

export interface PasteContentRequest {
  hash: string;
  content: string;
  length: number;
  sessionId: string;
  examId: string;
  timestamp: number;
  eventType?: "copy" | "paste";
}

// ===== Clipboard Content Types =====

export interface ClipboardContentRow {
  hash: string;
  eventType: "copy" | "paste";
  sessionId: string;
  content: string;
  length: number;
  timestamp: number;
  examId: string;
  createdAt?: string;
}

export interface HashUsageStats {
  hash: string;
  usageCount: number;
  copyCount: number;
  pasteCount: number;
  firstSeen: number;
  lastSeen: number;
  examId: string;
}

// ===== Server Storage Types =====

export interface Session {
  sessionId: string;
  studentId: string;
  examId: string;
  startTime: number;
}

export interface StoredHeartbeat {
  id?: number;
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
  createdAt?: string;
}

export interface StoredEvent {
  id?: number;
  sessionId: string;
  timestamp: number;
  type: string;
  hash?: string | null;
  length?: number | null;
  matchedCopyHash?: string | null;
  createdAt?: string;
}

export interface StoredPasteContent {
  hash: string;
  eventType: "copy" | "paste";
  sessionId: string;
  content: string;
  length: number;
  timestamp: number;
  examId: string;
  createdAt?: string;
}

// ===== Derived Metrics =====

export interface SessionMetrics {
  sessionId: string;
  studentId: string;
  examId: string;
  focusRatio: number;
  pasteRatio: number;
  unmatchedPasteCount: number;
  largestPaste: number;
  largestTextGrowth: number;
  totalEvents: number;
  copyCount: number;
  pasteCount: number;
}

// ===== API Response Types =====

export interface HeartbeatResponse {
  sessionId: string;
}

export interface PasteContentResponse {
  hash: string;
  content: string;
  length: number;
  sessionId: string;
  timestamp: number;
}
