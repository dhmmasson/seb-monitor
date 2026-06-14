/**
 * Sender module for HTTP communication with the server.
 * Handles sending heartbeats and paste content with retry logic.
 *
 * @module sender
 */

import type { HeartbeatPayload, PasteContentRequest } from "../../shared/types.ts";

/** Options for the sender */
export interface SenderOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
}

/** Sender interface for sending data to the server */
export interface Sender {
  /** Send a heartbeat payload to the server */
  sendHeartbeat(payload: HeartbeatPayload): Promise<void>;
  /** Send paste content to the server */
  sendPasteContent(request: PasteContentRequest): Promise<void>;
}

/** Fetch function type for dependency injection */
export type FetchFn = (
  url: string | URL | Request,
  options?: RequestInit,
) => Promise<Response>;

/**
 * Create a sender for HTTP communication.
 *
 * @param baseUrl - Base URL of the server (e.g., "http://localhost:8000")
 * @param fetchFn - Fetch function for dependency injection (default: global fetch)
 * @param options - Sender options
 * @returns Sender instance
 */
export function createSender(
  _baseUrl: string,
  _fetchFn: FetchFn = globalThis.fetch,
  _options: SenderOptions = {},
): Sender {
  // TODO: Implement
  throw new Error("Not implemented");
}
